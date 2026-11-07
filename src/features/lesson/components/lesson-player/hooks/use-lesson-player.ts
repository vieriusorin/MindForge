"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { type RefObject, useEffect, useRef, useState } from "react";
import {
  canSubmit,
  feedbackMessage,
  toggleChoice,
} from "@/components/question-card";
import { type LessonProgress, lessonProgress } from "@/engine/lesson";
import type { Confidence } from "@/engine/memory";
import type { AnswerFeedback } from "@/engine/questions";
import { submissionKey } from "@/lib/attempt-id";
import { confidenceField, nextConfidence } from "@/lib/confidence";
import { useAttemptId } from "@/lib/use-attempt-id";
import { useSingleFlight } from "@/lib/use-single-flight";
import { answerLessonItem } from "../../../actions";
import { lessonDoneHref } from "../../../search-params";
import type { PlayerStep } from "../../../types";
import { earnsReask, guessLine, withReasks } from "../utils";

export interface UseLessonPlayerReturn {
  step: PlayerStep | null;
  index: number;
  progress: LessonProgress;
  isLast: boolean;
  chosen: string[];
  feedback: AnswerFeedback | null;
  announcement: string;
  /** What the graded recall says about the guess made before the lesson, if any. */
  guessNote: string | null;
  error: string | null;
  isPending: boolean;
  canSubmit: boolean;
  stepRef: RefObject<HTMLElement | null>;
  feedbackRef: RefObject<HTMLOutputElement | null>;
  toggle: (optionId: string) => void;
  /** MF-0065: the optional tap before the reveal; null when there is none. */
  confidence: Confidence | null;
  chooseConfidence: (confidence: Confidence) => void;
  /** Guess step: keep the pick in the browser (no attempt) and move on. */
  lockGuess: () => void;
  /** Guess step: move on without a pick. */
  skipGuess: () => void;
  submit: () => void;
  next: () => void;
}

export function useLessonPlayer({
  packSlug,
  skillCode,
  steps,
  startedAt,
}: {
  packSlug: string;
  skillCode: string;
  steps: readonly PlayerStep[];
  startedAt: string;
}): UseLessonPlayerReturn {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<string[]>([]);
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const [guesses, setGuesses] = useState<Record<string, string[]>>({});
  const [missedIds, setMissedIds] = useState<string[]>([]);
  const stepRef = useRef<HTMLElement | null>(null);
  const feedbackRef = useRef<HTMLOutputElement | null>(null);
  const hasAdvanced = useRef(false);
  // MF-0026: one attempt per double click (isPending updates a render late).
  const flight = useSingleFlight();
  // MF-0067: one id per submission, kept for a retry, so a resent answer is recorded once.
  const attempt = useAttemptId();

  const mutation = useMutation({
    mutationFn: answerLessonItem,
    onSettled: flight.release,
  });
  const result = mutation.data;
  const feedback = result?.ok ? result.feedback : null;
  let error: string | null = null;
  if (result && !result.ok) error = result.error;
  else if (mutation.isError) error = "Could not reach the server. Try again.";

  const allSteps = withReasks(steps, missedIds);
  const step = allSteps[index] ?? null;
  const question = step && "question" in step ? step.question : null;

  useEffect(() => {
    if (feedback) feedbackRef.current?.focus();
  }, [feedback]);

  // After moving on, focus lands on the new step, never on first load.
  useEffect(() => {
    if (hasAdvanced.current && index > 0) stepRef.current?.focus();
  }, [index]);

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

  const advance = (): void => {
    if (index + 1 >= allSteps.length) {
      router.push(
        lessonDoneHref({ packSlug, skillCode, since: new Date(startedAt) }),
      );
      return;
    }
    hasAdvanced.current = true;
    // MF-0067: the next step (a re-ask of the same item included) is a new submission with a new id.
    attempt.clear();
    mutation.reset();
    setChosen([]);
    setConfidence(null);
    setIndex((i) => i + 1);
  };

  const lockGuess = (): void => {
    if (step?.kind !== "guess" || !isSubmittable) return;
    const { id } = step.question;
    setGuesses((g) => ({ ...g, [id]: chosen }));
    advance();
  };

  // The one place a lesson answer is sent (D-L9), with MF-0067's client attempt id.
  const submit = (): void => {
    if (!step || !question || step.kind === "guess") return;
    if (!isSubmittable || !flight.tryStart()) return;
    const isReaskable = earnsReask(step);
    mutation.mutate(
      {
        packSlug,
        questionId: question.id,
        chosen,
        contentHash: question.contentHash,
        ...confidenceField(confidence),
        clientAttemptId: attempt.idFor(
          submissionKey(question.id, chosen, confidence),
        ),
      },
      {
        onSuccess: (graded) => {
          if (graded.ok && !graded.feedback.correct && isReaskable) {
            setMissedIds((m) => [...m, question.id]);
          }
        },
      },
    );
  };

  return {
    step,
    index,
    progress: lessonProgress({ index, total: allSteps.length }),
    isLast: index + 1 >= allSteps.length,
    chosen,
    feedback,
    announcement: feedback ? feedbackMessage(feedback.correct) : "",
    // MF-0064 review: the guess is named on its graded recall only, never again on a re-ask.
    guessNote:
      question && step?.kind === "recall"
        ? guessLine(guesses[question.id], feedback)
        : null,
    error,
    isPending: mutation.isPending,
    canSubmit: isSubmittable,
    stepRef,
    feedbackRef,
    toggle,
    confidence,
    chooseConfidence,
    lockGuess,
    skipGuess: advance,
    submit,
    next: advance,
  };
}
