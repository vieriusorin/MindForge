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
