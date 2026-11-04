"use client";

import { useMutation } from "@tanstack/react-query";
import { type RefObject, useEffect, useRef, useState } from "react";
import type { AnswerFeedback } from "@/engine/questions";
import { answerWalkQuestion } from "../../../actions";
import type { WalkStep } from "../../../types";
import { canSubmit, feedbackMessage, toggleChoice } from "../utils";

export interface UseWalkSessionReturn {
  step: WalkStep | null;
  index: number;
  isFinished: boolean;
  isLast: boolean;
  chosen: string[];
  feedback: AnswerFeedback | null;
  /** The live region's text: empty until graded, then the verdict. */
  announcement: string;
  error: string | null;
  isPending: boolean;
  canSubmit: boolean;
  headingRef: RefObject<HTMLHeadingElement | null>;
  feedbackRef: RefObject<HTMLOutputElement | null>;
  doneRef: RefObject<HTMLHeadingElement | null>;
  toggle: (optionId: string) => void;
  submit: () => void;
  next: () => void;
}

export function useWalkSession(
  packSlug: string,
  steps: readonly WalkStep[],
): UseWalkSessionReturn {
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<string[]>([]);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const feedbackRef = useRef<HTMLOutputElement | null>(null);
  const doneRef = useRef<HTMLHeadingElement | null>(null);
  const hasAdvanced = useRef(false);

  const mutation = useMutation({ mutationFn: answerWalkQuestion });
  const result = mutation.data;
  const feedback = result?.ok ? result.feedback : null;
  let error: string | null = null;
  if (result && !result.ok) error = result.error;
  else if (mutation.isError) error = "Could not reach the server. Try again.";

  const step = steps[index] ?? null;
  const isFinished = index >= steps.length;

  // SC-5: after grading, focus lands on the verdict the live region just announced.
  useEffect(() => {
    if (feedback) feedbackRef.current?.focus();
  }, [feedback]);

  // SC-5: after "Next", focus lands on the new stem (or the end of the walk), never on load.
  useEffect(() => {
    if (!hasAdvanced.current) return;
    if (index >= steps.length) doneRef.current?.focus();
    else headingRef.current?.focus();
  }, [index, steps.length]);

  const toggle = (optionId: string): void => {
    if (!step || feedback || mutation.isPending) return;
    setChosen((c) => toggleChoice(c, optionId, step.question.select));
  };

  const isSubmittable =
    step !== null &&
    canSubmit({
      select: step.question.select,
      chosenCount: chosen.length,
      isAnswered: feedback !== null,
      isPending: mutation.isPending,
    });

  const submit = (): void => {
    if (!step || !isSubmittable) return;
    mutation.mutate({ packSlug, questionId: step.question.id, chosen });
  };

  const next = (): void => {
    hasAdvanced.current = true;
    mutation.reset();
    setChosen([]);
    setIndex((i) => i + 1);
  };

  return {
    step,
    index,
    isFinished,
    isLast: index + 1 >= steps.length,
    chosen,
    feedback,
    announcement: feedback ? feedbackMessage(feedback.correct) : "",
    error,
    isPending: mutation.isPending,
    canSubmit: isSubmittable,
    headingRef,
    feedbackRef,
    doneRef,
    toggle,
    submit,
    next,
  };
}
