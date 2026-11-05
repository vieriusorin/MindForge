"use client";

import { useMutation } from "@tanstack/react-query";
import { type RefObject, useEffect, useRef, useState } from "react";
import type { CuckooFeedback, PlayableCuckoo } from "@/engine/content";
import { useSingleFlight } from "@/lib/use-single-flight";
import { answerCuckoo } from "../../../actions";
import type { CuckooAnswerValues } from "../../../schemas";
import { canCheck, verdictMessage } from "../utils";

export interface UseCuckooSessionReturn {
  index: number;
  cuckoo: PlayableCuckoo | null;
  isFinished: boolean;
  isLast: boolean;
  chosenLine: number | null;
  feedback: CuckooFeedback | null;
  /** The live region's text: empty until graded, then the verdict. */
  announcement: string;
  error: string | null;
  /** The server refused to grade this snippet (withdrawn, changed, …); it can only be skipped. */
  isRefused: boolean;
  isPending: boolean;
  canCheck: boolean;
  score: number;
  answered: number;
  headingRef: RefObject<HTMLHeadingElement | null>;
  feedbackRef: RefObject<HTMLOutputElement | null>;
  doneRef: RefObject<HTMLHeadingElement | null>;
  choose: (line: number) => void;
  submit: () => void;
  next: () => void;
}

/** MF-0016: one Spot the Cuckoo round, the Duel's flow (MF-0012) with a line as the answer. */
export function useCuckooSession(
  packSlug: string,
  cuckoos: readonly PlayableCuckoo[],
): UseCuckooSessionReturn {
  const [index, setIndex] = useState(0);
  const [chosenLine, setChosenLine] = useState<number | null>(null);
  const [tally, setTally] = useState({ score: 0, answered: 0 });
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const feedbackRef = useRef<HTMLOutputElement | null>(null);
  const doneRef = useRef<HTMLHeadingElement | null>(null);
  const hasAdvanced = useRef(false);
  // MF-0012 SC-1: TanStack reports isPending a render late; the shared guard closes a double-click
  // window (MF-0026).
  const flight = useSingleFlight();

  const mutation = useMutation({
    // TanStack passes a second (context) argument holding the QueryClient; a Server Action must
    // receive only its serialisable input.
    mutationFn: (input: CuckooAnswerValues) => answerCuckoo(input),
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

  const cuckoo = cuckoos[index] ?? null;
  const isFinished = index >= cuckoos.length;

  // After grading, focus lands on the verdict the live region just announced.
  useEffect(() => {
    if (feedback) feedbackRef.current?.focus();
  }, [feedback]);

  // After "Next", focus lands on the new title (or the end of the round), never on load.
  useEffect(() => {
    if (!hasAdvanced.current) return;
    if (index >= cuckoos.length) doneRef.current?.focus();
    else headingRef.current?.focus();
  }, [index, cuckoos.length]);

  const isCheckable =
    cuckoo !== null &&
    canCheck({
      chosenLine,
      isAnswered: feedback !== null,
      isPending: mutation.isPending,
    });

  const choose = (line: number): void => {
    if (!cuckoo || feedback || mutation.isPending) return;
    setChosenLine(line);
  };

  const submit = (): void => {
    if (!cuckoo || chosenLine === null || !isCheckable || !flight.tryStart())
      return;
    mutation.mutate({
      packSlug,
      cuckooId: cuckoo.id,
      line: chosenLine,
      contentHash: cuckoo.contentHash,
    });
  };

  const next = (): void => {
    hasAdvanced.current = true;
    mutation.reset();
    setChosenLine(null);
    setIndex((i) => i + 1);
  };

  return {
    index,
    cuckoo,
    isFinished,
    isLast: index + 1 >= cuckoos.length,
    chosenLine,
    feedback,
    announcement: feedback ? verdictMessage(feedback) : "",
    error,
    isRefused: result !== undefined && !result.ok,
    isPending: mutation.isPending,
    canCheck: isCheckable,
    score: tally.score,
    answered: tally.answered,
    headingRef,
    feedbackRef,
    doneRef,
    choose,
    submit,
    next,
  };
}
