import type { Question } from "../questions/types";
import { isPlayable } from "./review";
import type { ReviewState } from "./types";

/** MF-0032 SC-3: why a question answer is not sent to the database for grading. */
export const QUESTION_GRADE_ERRORS = [
  "not-in-pack",
  "withdrawn",
  "changed",
] as const;
export type QuestionGradeError = (typeof QUESTION_GRADE_ERRORS)[number];

export interface CheckQuestionAnswerInput {
  /** The question with the answered id in the deployed files, or null. */
  question: Question | null;
  reviewState: ReviewState;
  /** The deployed file's content hash of this question. */
  fileHash: string | undefined;
  /** The hash the learner's page was rendered from. */
  sentHash: string;
}

export type CheckQuestionAnswerResult =
  | { ok: true }
  | { ok: false; error: QuestionGradeError };

/** MF-0032 SC-3: may this answer be graded? Pure; the caller then calls `record_attempt`. */
export function checkQuestionAnswer({
  question,
  reviewState,
  fileHash,
  sentHash,
}: CheckQuestionAnswerInput): CheckQuestionAnswerResult {
  if (!question) return { ok: false, error: "not-in-pack" };
  // MF-0006 SC-8: a flagged or rejected item is never graded, even from a stale page.
  if (!isPlayable(reviewState, "practice"))
    return { ok: false, error: "withdrawn" };
  // The learner answered the version their page showed; refuse if the deploy moved on (or has no hash).
  if (fileHash !== sentHash) return { ok: false, error: "changed" };
  return { ok: true };
}
