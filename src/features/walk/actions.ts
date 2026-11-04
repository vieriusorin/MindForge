"use server";

import { redirect } from "next/navigation";
import { type GradeError, gradeAnswer } from "@/server/attempts/grade-answer";
import { getCurrentUser } from "@/server/auth/current-user";
import { AnswerWalkInput } from "./schemas";
import type { AnswerWalkResult } from "./types";

const MESSAGE = {
  "not-in-pack": "This question doesn't belong to this pack.",
  withdrawn:
    "This question was withdrawn for review. Go back to Today to start a fresh walk.",
  "not-gradable":
    "This question isn't available for grading yet. Ask an admin to sync the answer keys.",
} as const satisfies Record<GradeError, string>;

/** MF-0009: grade one walk answer through the shared database grading. No redirect on success. */
export async function answerWalkQuestion(
  input: unknown,
): Promise<AnswerWalkResult> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/today");

  const parsed = AnswerWalkInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Pick an answer first." };

  const result = await gradeAnswer({ userId: user.id, ...parsed.data });
  if (!result.ok) return { ok: false, error: MESSAGE[result.error] };
  return { ok: true, feedback: result.feedback };
}
