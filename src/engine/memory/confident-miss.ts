import type { Attempt } from "./types";

/** MF-0065 (ADR 0007): a confident miss asks for a review at most this long after it. */
export const CONFIDENT_MISS_REVIEW_HOURS = 24;

/**
 * MF-0065 (DQ-5): when ONE skill's latest attempt is wrong + sure, its time; else null. Any later attempt on
 * the skill clears it. Derived from the attempts, never stored (D-4).
 */
export function confidentMissAt(attempts: readonly Attempt[]): Date | null {
  let latest: Attempt | null = null;
  for (const a of attempts) {
    if (!latest || a.answeredAt.getTime() >= latest.answeredAt.getTime())
      latest = a;
  }
  if (!latest || latest.correct || latest.confidence !== "sure") return null;
  return latest.answeredAt;
}
