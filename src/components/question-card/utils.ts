import type { Origin } from "@/engine/content";
import type { AnswerFeedback } from "@/engine/questions";
import type { OptionState } from "./types";

/** Before grading every option is plain; after it, the key shows and so does a wrong pick. */
export function optionState(
  optionId: string,
  chosen: readonly string[],
  feedback: AnswerFeedback | null,
): OptionState {
  if (!feedback) return "plain";
  if (feedback.correctOptionIds.includes(optionId)) return "key";
  return chosen.includes(optionId) ? "missed" : "plain";
}

/** CONTEXT.md Playable: only official items are vouched for; everything else carries a badge. */
export function originBadge(origin: Origin): {
  label: string;
  isOfficial: boolean;
} {
  return origin === "official"
    ? { label: "Official sample", isOfficial: true }
    : { label: "Unreviewed", isOfficial: false };
}

// MF-0010: hoisted from walk-session (second consumer: seed-planting).
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
