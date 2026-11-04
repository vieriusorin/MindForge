"use server";

import { redirect } from "next/navigation";
import { AnswerInput } from "@/lib/answer-input";
import { type GradeError, gradeAnswer } from "@/server/attempts/grade-answer";
import { getCurrentUser } from "@/server/auth/current-user";
import type { AnswerQuestionResult } from "./types";

const MESSAGE = {
  "not-in-pack": "This question doesn't belong to this pack.",
  withdrawn: "This question was withdrawn for review. Start a new duel.",
  "not-gradable":
    "This question isn't available for grading yet. Ask an admin to sync the answer keys.",
} as const satisfies Record<GradeError, string>;

/**
 * Grade in the DATABASE, then (and only then) reveal the key and every rationale (MF-0009: shared
 * `gradeAnswer`). MF-0012: called through `useMutation`; no redirect on success.
 */
export async function answerQuestion(
  input: unknown,
): Promise<AnswerQuestionResult> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/today");

  const parsed = AnswerInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Pick an answer first." };

  const result = await gradeAnswer({ userId: user.id, ...parsed.data });
  if (!result.ok) return { ok: false, error: MESSAGE[result.error] };
  return { ok: true, feedback: result.feedback };
}
