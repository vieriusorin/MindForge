"use client";

import { useMutation } from "@tanstack/react-query";
import { type RefObject, useEffect, useRef, useState } from "react";
import {
  canSubmit,
  feedbackMessage,
  toggleChoice,
} from "@/components/question-card";
import type { Confidence } from "@/engine/memory";
import type { AnswerFeedback, PlayableQuestion } from "@/engine/questions";
import { submissionKey } from "@/lib/attempt-id";
import { confidenceField, nextConfidence } from "@/lib/confidence";
import { useAttemptId } from "@/lib/use-attempt-id";
import { useSingleFlight } from "@/lib/use-single-flight";
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
  /** MF-0065: the optional tap before the reveal; null when there is none. */
  confidence: Confidence | null;
  chooseConfidence: (confidence: Confidence) => void;
  submit: () => void;
  next: () => void;
}

export function useDuelSession(
  packSlug: string,
  questions: readonly PlayableQuestion[],
): UseDuelSessionReturn {
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<string[]>([]);
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const [tally, setTally] = useState({ score: 0, answered: 0 });
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const feedbackRef = useRef<HTMLOutputElement | null>(null);
  const doneRef = useRef<HTMLHeadingElement | null>(null);
  const hasAdvanced = useRef(false);
  // MF-0012 SC-1: TanStack reports isPending on a later render, so a second click before it
  // would still see `false`. The shared guard closes that window synchronously (MF-0026).
  const flight = useSingleFlight();
  // MF-0067: one id per submission, kept for a retry, so a resent answer is recorded once.
  const attempt = useAttemptId();

  const mutation = useMutation({
    mutationFn: answerQuestion,
    onSuccess: (result) => {
      if (!result.ok) return;
      setTally((t) => ({
        score: t.score + (result.feedback.correct ? 1 : 0),
        answered: t.answered + 1,
      }));
    },
    onSettled: flight.release,
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

  // MF-0065: the tap belongs to the answer; it locks with the verdict and while checking.
  const chooseConfidence = (tapped: Confidence): void => {
    if (feedback || mutation.isPending) return;
    setConfidence((c) => nextConfidence(c, tapped));
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
    if (!question || !isSubmittable || !flight.tryStart()) return;
    mutation.mutate({
      packSlug,
      questionId: question.id,
      chosen,
      contentHash: question.contentHash,
      ...confidenceField(confidence),
      clientAttemptId: attempt.idFor(
        submissionKey(question.id, chosen, confidence),
      ),
    });
  };

  const next = (): void => {
    hasAdvanced.current = true;
    attempt.clear();
    mutation.reset();
    setChosen([]);
    setConfidence(null);
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
    confidence,
    chooseConfidence,
    submit,
    next,
  };
}
