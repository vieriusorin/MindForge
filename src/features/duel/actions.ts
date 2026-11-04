"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { type GradeError, gradeAnswer } from "@/server/attempts/grade-answer";
import { getCurrentUser } from "@/server/auth/current-user";
import type { AnswerResult } from "./types";

const AnswerInput = z.strictObject({
  packSlug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  questionId: z.string().min(1).max(128),
  chosen: z
    .array(z.string().regex(/^[A-Z]$/))
    .min(1)
    .max(10),
});

const MESSAGE = {
  "not-in-pack": "This question doesn't belong to this pack.",
  withdrawn: "This question was withdrawn for review. Start a new duel.",
  "not-gradable":
    "This question isn't available for grading yet. Ask an admin to sync the answer keys.",
} as const satisfies Record<GradeError, string>;

/** Grade in the DATABASE, then (and only then) reveal the key and every rationale (MF-0009: shared `gradeAnswer`). */
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

  const result = await gradeAnswer({ userId: user.id, ...parsed.data });
  return result.ok
    ? { ok: true, feedback: result.feedback }
    : { ok: false, message: MESSAGE[result.error] };
}
