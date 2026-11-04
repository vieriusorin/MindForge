"use client";

import { useMutation } from "@tanstack/react-query";
import { type RefObject, useEffect, useRef, useState } from "react";
import {
  canSubmit,
  feedbackMessage,
  toggleChoice,
} from "@/components/question-card";
import type { AnswerFeedback, PlayableQuestion } from "@/engine/questions";
import { answerQuestion } from "../../../actions";

export interface UseDuelSessionReturn {
  index: number;
  question: PlayableQuestion | null;
  isFinished: boolean;
  isLast: boolean;
  chosen: string[];
  feedback: AnswerFeedback | null;
  /** The live region's text: empty until graded, then the verdict. */
  announcement: string;
  error: string | null;
  isPending: boolean;
  canSubmit: boolean;
  score: number;
  answered: number;
  headingRef: RefObject<HTMLHeadingElement | null>;
  feedbackRef: RefObject<HTMLOutputElement | null>;
  doneRef: RefObject<HTMLHeadingElement | null>;
  toggle: (optionId: string) => void;
  submit: () => void;
  next: () => void;
}

export function useDuelSession(
  packSlug: string,
  questions: readonly PlayableQuestion[],
): UseDuelSessionReturn {
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<string[]>([]);
  const [tally, setTally] = useState({ score: 0, answered: 0 });
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const feedbackRef = useRef<HTMLOutputElement | null>(null);
  const doneRef = useRef<HTMLHeadingElement | null>(null);
  const hasAdvanced = useRef(false);
  // MF-0012 SC-1: TanStack reports isPending on a later render, so a second click before it
  // would still see `false`. The ref closes that window synchronously.
  const isInFlight = useRef(false);

  const mutation = useMutation({
    mutationFn: answerQuestion,
    onSuccess: (result) => {
      if (!result.ok) return;
      setTally((t) => ({
        score: t.score + (result.feedback.correct ? 1 : 0),
        answered: t.answered + 1,
      }));
    },
    onSettled: () => {
      isInFlight.current = false;
    },
  });
  const result = mutation.data;
  const feedback = result?.ok ? result.feedback : null;
  let error: string | null = null;
  if (result && !result.ok) error = result.error;
  else if (mutation.isError) error = "Could not reach the server. Try again.";

  const question = questions[index] ?? null;
  const isFinished = index >= questions.length;

  // SC-2: after grading, focus lands on the verdict the live region just announced.
  useEffect(() => {
    if (feedback) feedbackRef.current?.focus();
  }, [feedback]);

  // SC-2: after "Next", focus lands on the new stem (or the end of the duel), never on load.
  useEffect(() => {
    if (!hasAdvanced.current) return;
    if (index >= questions.length) doneRef.current?.focus();
    else headingRef.current?.focus();
  }, [index, questions.length]);

  const toggle = (optionId: string): void => {
    if (!question || feedback || mutation.isPending) return;
    setChosen((c) => toggleChoice(c, optionId, question.select));
  };

  const isSubmittable =
    question !== null &&
    canSubmit({
      select: question.select,
      chosenCount: chosen.length,
      isAnswered: feedback !== null,
      isPending: mutation.isPending,
    });

  const submit = (): void => {
    if (!question || !isSubmittable || isInFlight.current) return;
    isInFlight.current = true;
    mutation.mutate({ packSlug, questionId: question.id, chosen });
  };

  const next = (): void => {
    hasAdvanced.current = true;
    mutation.reset();
    setChosen([]);
    setIndex((i) => i + 1);
  };

  return {
    index,
    question,
    isFinished,
    isLast: index + 1 >= questions.length,
    chosen,
    feedback,
    announcement: feedback ? feedbackMessage(feedback.correct) : "",
    error,
    isPending: mutation.isPending,
    canSubmit: isSubmittable,
    score: tally.score,
    answered: tally.answered,
    headingRef,
    feedbackRef,
    doneRef,
    toggle,
    submit,
    next,
  };
}
