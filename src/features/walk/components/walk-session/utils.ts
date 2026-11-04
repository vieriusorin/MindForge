import type { WalkReason } from "@/engine/memory";

const REASON_LABEL = {
  water: "Needs water",
  new: "New seed",
  strengthen: "Strengthen",
} as const satisfies Record<WalkReason, string>;

/** The badge that tells the learner why this skill is in today's walk. */
export function reasonLabel(reason: WalkReason): string {
  return REASON_LABEL[reason];
}

/** Single-select replaces the pick; multi-select toggles it. */
export function toggleChoice(
  chosen: readonly string[],
  optionId: string,
  select: number,
): string[] {
  if (select === 1) return [optionId];
  return chosen.includes(optionId)
    ? chosen.filter((id) => id !== optionId)
    : [...chosen, optionId];
}

/** Exactly `select` options picked, not yet graded, nothing in flight. */
export function canSubmit({
  select,
  chosenCount,
  isAnswered,
  isPending,
}: {
  select: number;
  chosenCount: number;
  isAnswered: boolean;
  isPending: boolean;
}): boolean {
  return chosenCount === select && !isAnswered && !isPending;
}

/** What the live region says once the database has graded the answer. */
export function feedbackMessage(isCorrect: boolean): string {
  return isCorrect
    ? "Correct! Recalled and recorded."
    : "Not quite. Read why, then carry on.";
}
