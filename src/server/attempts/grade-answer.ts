import "server-only";
import { isPlayable, reviewStateOf } from "@/engine/content";
import type { AnswerFeedback } from "@/engine/questions";
import type { ActionResult } from "@/lib/action-result";
import { getReviewContext } from "@/server/content/get-review-context";
import { getPackQuestions } from "@/server/questions/get-pack-questions";
import { createServerSupabase } from "@/server/supabase/server";

/** Why an answer was not graded. Each caller words it for its own screen. */
export const GRADE_ERRORS = [
  "not-in-pack",
  "withdrawn",
  "not-gradable",
] as const;
export type GradeError = (typeof GRADE_ERRORS)[number];

export interface GradeAnswerInput {
  userId: string;
  packSlug: string;
  questionId: string;
  chosen: string[];
}

/**
 * MF-0009: the one grading path for every practice mode. Grades in the DATABASE
 * (`record_attempt`), then (and only then) reveals the key and every rationale. Callers have
 * already authenticated and parsed the input.
 */
export async function gradeAnswer({
  userId,
  packSlug,
  questionId,
  chosen,
}: GradeAnswerInput): Promise<
  ActionResult<{ feedback: AnswerFeedback }, GradeError>
> {
  const question = (await getPackQuestions(packSlug)).find(
    (q) => q.id === questionId,
  );
  if (!question) return { ok: false, error: "not-in-pack" };
  // MF-0006 SC-8: a flagged or rejected item is never graded, even if a stale page still shows it.
  const review = await getReviewContext(userId, packSlug);
  if (!isPlayable(reviewStateOf(review, question), "practice"))
    return { ok: false, error: "withdrawn" };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("record_attempt", {
    p_question_id: question.id,
    p_chosen: chosen,
  });
  if (error || typeof data !== "boolean") {
    return { ok: false, error: "not-gradable" };
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
