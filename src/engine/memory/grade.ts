import { type Grade, Rating } from "ts-fsrs";
import type { Attempt } from "./types";

/**
 * MF-0065 (ADR 0007): the FSRS rating of one attempt. Correct + sure = Good, correct + unsure = Hard, wrong =
 * Again. No tap (legacy rows, storms, cuckoo) = Good / Again, as before the tap existed.
 */
export function ratingFor(
  attempt: Pick<Attempt, "correct" | "confidence">,
): Grade {
  if (!attempt.correct) return Rating.Again;
  return attempt.confidence === "unsure" ? Rating.Hard : Rating.Good;
}
