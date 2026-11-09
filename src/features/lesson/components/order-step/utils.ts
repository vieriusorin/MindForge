import type { FocusKey, ShownStep } from "./types";

/** Append a step to the learner's order; a step already placed (or unknown) leaves it unchanged. */
export function placeStep(
  placed: readonly string[],
  id: string,
  steps: readonly ShownStep[],
): string[] {
  if (placed.includes(id) || !steps.some((s) => s.id === id))
    return [...placed];
  return [...placed, id];
}

/** Take a step back out of the learner's order. */
export function removeStep(placed: readonly string[], id: string): string[] {
  return placed.filter((p) => p !== id);
}

/** The steps still to place, in the shown order. */
export function unplacedSteps(
  steps: readonly ShownStep[],
  placed: readonly string[],
): ShownStep[] {
  return steps.filter((s) => !placed.includes(s.id));
}

/** The placed steps, in the learner's order, with their labels. */
export function placedSteps(
  steps: readonly ShownStep[],
  placed: readonly string[],
): ShownStep[] {
  return placed.flatMap((id) => steps.filter((s) => s.id === id));
}

/** Check order is possible once every step is placed, before a verdict and while nothing is pending. */
export function canCheckOrder({
  stepCount,
  placedCount,
  isAnswered,
  isPending,
}: {
  stepCount: number;
  placedCount: number;
  isAnswered: boolean;
  isPending: boolean;
}): boolean {
  return (
    stepCount > 0 && placedCount === stepCount && !isAnswered && !isPending
  );
}

/** The verdict line announced after grading (SC-7). */
export function orderVerdict(isCorrect: boolean): string {
  return isCorrect
    ? "Correct! That is the order."
    : "Not quite. Here is the order.";
}

/**
 * Where keyboard focus goes after a step is added: the next step still to place, else the previous one,
 * else (the pool is empty) the Check order button. The added button unmounts, so focus must move.
 */
export function focusAfterAdd(
  poolBefore: readonly ShownStep[],
  id: string,
): FocusKey {
  const i = poolBefore.findIndex((s) => s.id === id);
  const rest = poolBefore.filter((s) => s.id !== id);
  if (rest.length === 0) return "check";
  const next = rest[Math.min(Math.max(i, 0), rest.length - 1)];
  return next ? `add:${next.id}` : "check";
}

/** After a step is removed it is back in the pool; focus its Add button. */
export function focusAfterRemove(id: string): FocusKey {
  return `add:${id}`;
}

/** The polite announcement after adding a step. */
export function addedLine(
  label: string,
  position: number,
  total: number,
): string {
  return `Added "${label}" as step ${position} of ${total}.`;
}

/** The polite announcement after removing a step. */
export function removedLine(
  label: string,
  placed: number,
  total: number,
): string {
  return `Removed "${label}". ${placed} of ${total} placed.`;
}
