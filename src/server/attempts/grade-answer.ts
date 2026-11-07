import "server-only";
import {
  checkQuestionAnswer,
  type QuestionGradeError,
  reviewStateOf,
} from "@/engine/content";
import type { Confidence } from "@/engine/memory";
import type { AnswerFeedback } from "@/engine/questions";
import type { ActionResult } from "@/lib/action-result";
import { getItemHashes } from "@/server/content/get-item-hashes";
import { getReviewContext } from "@/server/content/get-review-context";
import { recordCourseCompletion } from "@/server/paths/record-course-completion";
import { getPackQuestions } from "@/server/questions/get-pack-questions";
import { createServerSupabase } from "@/server/supabase/server";
import { isStaleVersionError } from "./is-stale-version-error";

/** Why an answer was not graded. Each caller words it for its own screen. */
export type GradeError = QuestionGradeError | "not-gradable";

export interface GradeAnswerInput {
  userId: string;
  packSlug: string;
  questionId: string;
  chosen: string[];
  /** MF-0032: the version the learner's page showed. */
  contentHash: string;
  /** MF-0067: the submission id; a retry with the same id returns the first grade. */
  clientAttemptId: string;
  /** MF-0065: the learner's tap before the reveal; absent = no tap. */
  confidence?: Confidence;
}

/**
 * MF-0009: the one grading path for every practice mode. Grades in the DATABASE
 * (`record_attempt`), then (and only then) reveals the key and every rationale. Callers have
 * already authenticated and parsed the input. MF-0032: `changed` = the deployed file (here) or the
 * registry (in the DB) holds another version than the learner read.
 */
export async function gradeAnswer({
  userId,
  packSlug,
  questionId,
  chosen,
  contentHash,
  clientAttemptId,
  confidence,
}: GradeAnswerInput): Promise<
  ActionResult<{ feedback: AnswerFeedback }, GradeError>
> {
  const [questions, hashes, review] = await Promise.all([
    getPackQuestions(packSlug),
    getItemHashes(packSlug),
    getReviewContext(userId, packSlug),
  ]);
  const question = questions.find((q) => q.id === questionId) ?? null;
  const check = checkQuestionAnswer({
    question,
    // MF-0006 SC-8: a flagged or rejected item is never graded, even if a stale page still shows it.
    reviewState: question ? reviewStateOf(review, question) : "unreviewed",
    fileHash: hashes[questionId],
    sentHash: contentHash,
  });
  if (!check.ok) return check;
  if (!question) return { ok: false, error: "not-in-pack" };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("record_attempt", {
    p_question_id: question.id,
    p_chosen: chosen,
    p_content_hash: contentHash,
    p_client_attempt_id: clientAttemptId,
    // MF-0065: stored with the grade in the same call; no tap = no key (the DB default, null)
    ...(confidence ? { p_confidence: confidence } : {}),
  });
  if (isStaleVersionError(error)) return { ok: false, error: "changed" };
  if (error || typeof data !== "boolean") {
    return { ok: false, error: "not-gradable" };
  }

  // MF-0058 SC-6: only a correct answer can raise stability, so only it can complete a course.
  if (data) {
    try {
      await recordCourseCompletion({ userId, packSlug, now: new Date() });
    } catch (error) {
      // MF-0058 SC-6: completion is a side effect of a committed attempt; it never fails the answer.
      console.error(
        "recordCourseCompletion:",
        error instanceof Error ? error.message : "unknown error",
      );
    }
  }

  return {
    ok: true,
    feedback: {
      correct: data,
      correctOptionIds: question.options
        .filter((o) => o.correct)
        .map((o) => o.id),
      rationales: Object.fromEntries(
        question.options.map((o) => [o.id, o.rationale]),
      ),
    },
  };
}
