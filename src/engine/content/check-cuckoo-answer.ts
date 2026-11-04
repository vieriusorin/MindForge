import { isPlayable } from "./review";
import type { Cuckoo, ReviewState } from "./types";

/** MF-0016 SC-4: why a cuckoo answer is not sent to the database for grading. */
export const CUCKOO_GRADE_ERRORS = [
  "not-in-pack",
  "withdrawn",
  "changed",
  "invalid-line",
] as const;
export type CuckooGradeError = (typeof CUCKOO_GRADE_ERRORS)[number];

export interface CheckCuckooAnswerInput {
  /** The cuckoo with the answered id in the deployed files, or null. */
  cuckoo: Cuckoo | null;
  reviewState: ReviewState;
  /** The deployed file's content hash of this cuckoo. */
  fileHash: string | undefined;
  /** The hash the learner's page was rendered from (C-4). */
  sentHash: string;
  /** The 1-based line the learner picked. */
  line: number;
}

export type CheckCuckooAnswerResult =
  | { ok: true }
  | { ok: false; error: CuckooGradeError };

/** MF-0016 SC-4: may this answer be graded? Pure; the caller then calls `record_attempt`. */
export function checkCuckooAnswer({
  cuckoo,
  reviewState,
  fileHash,
  sentHash,
  line,
}: CheckCuckooAnswerInput): CheckCuckooAnswerResult {
  if (!cuckoo) return { ok: false, error: "not-in-pack" };
  // MF-0006 SC-8: a flagged or rejected item is never graded, even from a stale page.
  if (!isPlayable(reviewState, "practice"))
    return { ok: false, error: "withdrawn" };
  // C-4: the learner judged the version their page showed; refuse if the deploy moved on.
  if (fileHash !== sentHash) return { ok: false, error: "changed" };
  if (!Number.isInteger(line) || line < 1 || line > cuckoo.lines.length)
    return { ok: false, error: "invalid-line" };
  return { ok: true };
}
