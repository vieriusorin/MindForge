"use client";

import { useMutation } from "@tanstack/react-query";
import { type RefObject, useEffect, useRef, useState } from "react";
import type { OrderFeedback } from "@/engine/content";
import { submissionKey } from "@/lib/attempt-id";
import { useAttemptId } from "@/lib/use-attempt-id";
import { useSingleFlight } from "@/lib/use-single-flight";
import { answerLessonOrder } from "../../../actions";
import type { FocusKey, OrderPlayerStep, ShownStep } from "../types";
import {
  addedLine,
  canCheckOrder,
  focusAfterAdd,
  focusAfterRemove,
  orderVerdict,
  placedSteps,
  placeStep,
  removedLine,
  removeStep,
  unplacedSteps,
} from "../utils";

export interface UseOrderStepReturn {
  /** Steps still to place, in the shown order. */
  pool: ShownStep[];
  /** The learner's order so far. */
  answer: ShownStep[];
  feedback: OrderFeedback | null;
  verdict: string;
  error: string | null;
  isPending: boolean;
  isLocked: boolean;
  canCheck: boolean;
  feedbackRef: RefObject<HTMLOutputElement | null>;
  /** Wraps the step; focus moves inside it by `data-focus-key` after each move. */
  containerRef: RefObject<HTMLDivElement | null>;
  /** The polite announcement of the last move. */
  moveLine: string;
  add: (id: string) => void;
  remove: (id: string) => void;
  check: () => void;
}

/** MF-0066 SC-7: the order step's state, its one graded answer (MF-0067 attempt id) and its verdict. */
export function useOrderStep({
  step,
  packSlug,
}: {
  step: OrderPlayerStep;
  packSlug: string;
}): UseOrderStepReturn {
  const { order } = step;
  const [placed, setPlaced] = useState<string[]>([]);
  const [moveLine, setMoveLine] = useState("");
  // MF-0066 D-2: a move counter, so two moves in a row that target the same control still refocus it.
  const [focusMove, setFocusMove] = useState<{
    key: FocusKey;
    n: number;
  } | null>(null);
  const feedbackRef = useRef<HTMLOutputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  // MF-0026: one attempt per double click (isPending updates a render late).
  const flight = useSingleFlight();
  // MF-0067: one id per submission, kept for a retry of the same order.
  const attempt = useAttemptId();

  const mutation = useMutation({
    mutationFn: answerLessonOrder,
    onSettled: flight.release,
  });
  const result = mutation.data;
  const feedback = result?.ok ? result.feedback : null;
  let error: string | null = null;
  if (result && !result.ok) error = result.error;
  else if (mutation.isError) error = "Could not reach the server. Try again.";

  useEffect(() => {
    if (feedback) feedbackRef.current?.focus();
  }, [feedback]);

  // MF-0066 review: the pressed button unmounts on every move, so focus moves to a sensible control.
  useEffect(() => {
    if (!focusMove) return;
    containerRef.current
      ?.querySelector<HTMLElement>(
        `[data-focus-key="${CSS.escape(focusMove.key)}"]`,
      )
      ?.focus();
  }, [focusMove]);
  const moveFocusTo = (key: FocusKey): void =>
    setFocusMove((m) => ({ key, n: (m?.n ?? 0) + 1 }));

  const isLocked = feedback !== null || mutation.isPending;
  const canCheck = canCheckOrder({
    stepCount: order.steps.length,
    placedCount: placed.length,
    isAnswered: feedback !== null,
    isPending: mutation.isPending,
  });

  const total = order.steps.length;
  const labelOf = (id: string): string =>
    order.steps.find((s) => s.id === id)?.label ?? id;

  const add = (id: string): void => {
    if (isLocked || placed.includes(id)) return;
    const next = placeStep(placed, id, order.steps);
    moveFocusTo(focusAfterAdd(unplacedSteps(order.steps, placed), id));
    setMoveLine(addedLine(labelOf(id), next.length, total));
    setPlaced(next);
  };

  const remove = (id: string): void => {
    if (isLocked) return;
    const next = removeStep(placed, id);
    moveFocusTo(focusAfterRemove(id));
    setMoveLine(removedLine(labelOf(id), next.length, total));
    setPlaced(next);
  };

  const check = (): void => {
    if (!canCheck || !flight.tryStart()) return;
    mutation.mutate({
      packSlug,
      orderId: order.id,
      order: placed,
      contentHash: order.contentHash,
      clientAttemptId: attempt.idFor(submissionKey(order.id, placed)),
    });
  };

  return {
    pool: unplacedSteps(order.steps, placed),
    answer: placedSteps(order.steps, placed),
    feedback,
    verdict: feedback ? orderVerdict(feedback.correct) : "",
    error,
    isPending: mutation.isPending,
    isLocked,
    canCheck,
    feedbackRef,
    containerRef,
    moveLine,
    add,
    remove,
    check,
  };
}
