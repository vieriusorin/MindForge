"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { isPlayable, reviewStateOf } from "@/engine/content";
import { getCurrentUser } from "@/server/auth/current-user";
import { getReviewContext } from "@/server/content/get-review-context";
import { getPackQuestions } from "@/server/questions/get-pack-questions";
import { createServerSupabase } from "@/server/supabase/server";
import type { AnswerResult } from "./types";

const AnswerInput = z.strictObject({
  packSlug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  questionId: z.string().min(1).max(128),
  chosen: z
    .array(z.string().regex(/^[A-Z]$/))
    .min(1)
    .max(10),
});

/** Grade in the DATABASE, then (and only then) reveal the key and every rationale. */
export async function answerQuestion(
  packSlug: string,
  questionId: string,
  chosen: string[],
): Promise<AnswerResult> {
  const user = await getCurrentUser();
  if (!user)
    redirect(`/sign-in?next=${encodeURIComponent(`/play/${packSlug}/duel`)}`);

  const parsed = AnswerInput.safeParse({ packSlug, questionId, chosen });
  if (!parsed.success) return { ok: false, message: "Pick an answer first." };

  const question = (await getPackQuestions(parsed.data.packSlug)).find(
    (q) => q.id === parsed.data.questionId,
  );
  if (!question)
    return { ok: false, message: "This question doesn't belong to this pack." };
  // MF-0006 SC-8: a flagged or rejected item is never graded, even if a stale page still shows it.
  const review = await getReviewContext(user.id, parsed.data.packSlug);
  if (!isPlayable(reviewStateOf(review, question), "practice"))
    return {
      ok: false,
      message: "This question was withdrawn for review. Start a new duel.",
    };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("record_attempt", {
    p_question_id: question.id,
    p_chosen: parsed.data.chosen,
  });
  if (error || typeof data !== "boolean") {
    return {
      ok: false,
      message:
        "This question isn't available for grading yet. Ask an admin to sync the answer keys.",
    };
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
