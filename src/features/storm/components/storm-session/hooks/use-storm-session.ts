"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toggleChoice } from "@/components/question-card";
import { answerStormQuestion, finishStorm } from "../../../actions";
import type { StormSessionProps, UseStormSessionReturn } from "../types";
import {
  countdownAnnouncement,
  finishWarning,
  formatCountdown,
  initialChoices,
  questionStatus,
  remainingSeconds,
  storedAnswerChange,
  unansweredCount,
} from "../utils";

const NETWORK_ERROR = "Could not reach the server. Try again.";
const TIME_UP_REFRESH_MS = 5000;

export function useStormSession({
  stormId,
  endsAt,
  questions,
}: Pick<
  StormSessionProps,
  "stormId" | "endsAt" | "questions"
>): UseStormSessionReturn {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [choices, setChoices] = useState(() => initialChoices(questions));
  // null until mounted: the server render and hydration show a placeholder, not a stale time.
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [isOver, setIsOver] = useState(false);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  // The question whose stem last had focus: the first one never steals focus on load.
  const focusedIndex = useRef(0);
  const hasRequestedFinish = useRef(false);

  const finishMutation = useMutation({
    mutationFn: finishStorm,
    onSuccess: (result) => {
      if (result.ok) {
        router.refresh();
        return;
      }
      hasRequestedFinish.current = false;
    },
    onError: () => {
      hasRequestedFinish.current = false;
    },
  });
  const { mutate: mutateFinish } = finishMutation;

  // One finish request at a time, whether from the button or an MF013 refusal (the DB clock).
  const requestFinish = useCallback((): void => {
    if (hasRequestedFinish.current) return;
    hasRequestedFinish.current = true;
    mutateFinish({ stormId });
  }, [mutateFinish, stormId]);

  const saveMutation = useMutation({
    mutationFn: answerStormQuestion,
    onSuccess: (result) => {
      if (result.ok || !result.error.isStormOver) return;
      setIsOver(true);
      requestFinish();
    },
  });

  // MF-0013: the countdown is re-derived from the DB deadline every second.
  useEffect(() => {
    const tick = (): void => setNowMs(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = nowMs === null ? null : remainingSeconds(endsAt, nowMs);
  const isTimeUp = remaining === 0;
  // A stable function (the app router's own), so the effect below runs once per lock.
  const refreshPage = router.refresh;

  // MF-0013: 0 s on the client clock only locks and asks the page again. The page's
  // finalizeExpiredStorms() grades the storm once the DB's ends_at has passed; finishing here
  // would let a fast client clock cut the storm short. While still shown as running, ask again.
  useEffect(() => {
    if (!isTimeUp) return;
    refreshPage();
    const id = setInterval(refreshPage, TIME_UP_REFRESH_MS);
    return () => clearInterval(id);
  }, [isTimeUp, refreshPage]);

  // After a jump, focus lands on the new stem (the card remounts per question).
  useEffect(() => {
    if (focusedIndex.current === index) return;
    focusedIndex.current = index;
    headingRef.current?.focus();
  }, [index]);

  const current = questions[index];
  if (!current) throw new Error("StormSession: a storm has no questions");
  const chosen = choices[current.question.id] ?? [];

  const isFinishing =
    finishMutation.isPending || finishMutation.data?.ok === true;
  const isLocked = isTimeUp || isOver || isFinishing;

  const saveResult = saveMutation.data;
  const finishResult = finishMutation.data;
  let error: string | null = null;
  if (finishResult && !finishResult.ok) error = finishResult.error.message;
  else if (finishMutation.isError) error = NETWORK_ERROR;
  else if (saveResult && !saveResult.ok) error = saveResult.error.message;
  else if (saveMutation.isError) error = NETWORK_ERROR;

  const toggle = (optionId: string): void => {
    if (isLocked) return;
    const { question, contentHash } = current;
    const nextChosen = toggleChoice(chosen, optionId, question.select);
    setChoices((c) => ({ ...c, [question.id]: nextChosen }));
    // The DB binds a stored answer to the hash the learner read; `[]` clears it.
    const stored = storedAnswerChange(chosen, nextChosen, question.select);
    if (stored === null) return;
    saveMutation.mutate({
      stormId,
      questionId: question.id,
      chosen: [...stored],
      contentHash,
    });
  };

  const goTo = (target: number): void => {
    if (target < 0 || target >= questions.length) return;
    setIndex(target);
  };

  return {
    current,
    positionLabel: `Question ${index + 1} of ${questions.length}`,
    chosen,
    navigator: questions.map((q, i) => ({
      questionId: q.question.id,
      number: i + 1,
      status: questionStatus(choices[q.question.id] ?? [], q.question.select),
      isCurrent: i === index,
    })),
    countdownLabel: formatCountdown(remaining),
    announcement: countdownAnnouncement(remaining),
    isLocked,
    isSaving: saveMutation.isPending,
    isFinishing,
    isFirst: index === 0,
    isLast: index === questions.length - 1,
    error,
    finishWarning: finishWarning(unansweredCount(questions, choices)),
    headingRef,
    toggle,
    previous: () => goTo(index - 1),
    next: () => goTo(index + 1),
    goTo,
    finish: requestFinish,
  };
}
