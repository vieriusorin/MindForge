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
import { answerSeedCheck } from "../../../actions";
import type { PlantingOutcome } from "../types";
import { plantingOutcome } from "../utils";

export interface UseSeedChecksReturn {
  check: PlayableQuestion | null;
  index: number;
  isLast: boolean;
  /** Set once every check is answered. */
  outcome: PlantingOutcome | null;
  chosen: string[];
  feedback: AnswerFeedback | null;
  announcement: string;
  error: string | null;
  isPending: boolean;
  canSubmit: boolean;
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

export function useSeedChecks({
  packSlug,
  checks,
  wasSeed,
}: {
  packSlug: string;
  checks: readonly PlayableQuestion[];
  wasSeed: boolean;
}): UseSeedChecksReturn {
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<string[]>([]);
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const feedbackRef = useRef<HTMLOutputElement | null>(null);
  const doneRef = useRef<HTMLHeadingElement | null>(null);
  const hasAdvanced = useRef(false);

  // MF-0026: one attempt per double click (isPending updates a render late).
  const flight = useSingleFlight();
  // MF-0067: one id per submission, kept for a retry, so a resent answer is recorded once.
  const attempt = useAttemptId();

  const mutation = useMutation({
    mutationFn: answerSeedCheck,
    onSuccess: (result) => {
      if (result.ok && result.feedback.correct) setCorrectCount((c) => c + 1);
    },
    onSettled: flight.release,
  });
  const result = mutation.data;
  const feedback = result?.ok ? result.feedback : null;
  let error: string | null = null;
  if (result && !result.ok) error = result.error;
  else if (mutation.isError) error = "Could not reach the server. Try again.";

  const check = checks[index] ?? null;
  const isFinished = index >= checks.length;

  // Focus lands on the verdict the live region just announced.
  useEffect(() => {
    if (feedback) feedbackRef.current?.focus();
  }, [feedback]);

  // After "Next", focus lands on the new stem (or the outcome), never on first load.
  useEffect(() => {
    if (!hasAdvanced.current) return;
    if (index >= checks.length) doneRef.current?.focus();
    else headingRef.current?.focus();
  }, [index, checks.length]);

  const toggle = (optionId: string): void => {
    if (!check || feedback || mutation.isPending) return;
    setChosen((c) => toggleChoice(c, optionId, check.select));
  };

  // MF-0065: the tap belongs to the answer; it locks with the verdict and while checking.
  const chooseConfidence = (tapped: Confidence): void => {
    if (feedback || mutation.isPending) return;
    setConfidence((c) => nextConfidence(c, tapped));
  };

  const isSubmittable =
    check !== null &&
    canSubmit({
      select: check.select,
      chosenCount: chosen.length,
      isAnswered: feedback !== null,
      isPending: mutation.isPending,
    });

  const submit = (): void => {
    if (!check || !isSubmittable || !flight.tryStart()) return;
    mutation.mutate({
      packSlug,
      questionId: check.id,
      chosen,
      contentHash: check.contentHash,
      ...confidenceField(confidence),
      clientAttemptId: attempt.idFor(
        submissionKey(check.id, chosen, confidence),
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
    check,
    index,
    isLast: index + 1 >= checks.length,
    outcome:
      isFinished && checks.length > 0
        ? plantingOutcome({ wasSeed, correctCount })
        : null,
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
    confidence,
    chooseConfidence,
    submit,
    next,
  };
}
