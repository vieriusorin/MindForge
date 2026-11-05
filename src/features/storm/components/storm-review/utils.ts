import type { ReviewVerdict, StormReviewItem } from "./types";

/** What a reviewed question says about the learner's answer. Voided wins: it was not scored. */
export function reviewVerdict(
  item: Pick<StormReviewItem, "chosen" | "correct" | "voided">,
): ReviewVerdict {
  if (item.voided) return "Voided";
  if (item.chosen.length === 0) return "Not answered";
  return item.correct === true ? "Correct" : "Wrong";
}

/** Verdicts that read as a miss get the outlined badge; the label carries the meaning. */
export function isMissVerdict(verdict: ReviewVerdict): boolean {
  return verdict === "Wrong" || verdict === "Not answered";
}
