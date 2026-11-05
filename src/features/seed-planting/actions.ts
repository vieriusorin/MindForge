"use server";

import { redirect } from "next/navigation";
import { AnswerInput } from "@/lib/answer-input";
import { type GradeError, gradeAnswer } from "@/server/attempts/grade-answer";
import { getCurrentUser } from "@/server/auth/current-user";
import type { AnswerSeedCheckResult } from "./types";

const MESSAGE = {
  "not-in-pack": "This question doesn't belong to this pack.",
  withdrawn:
    "This question was withdrawn for review. Reload the page for a fresh set of checks.",
  changed:
    "This question changed since you opened it. Reload the page for a fresh set of checks.",
  "not-gradable":
    "This question isn't available for grading yet. Ask an admin to sync the answer keys.",
} as const satisfies Record<GradeError, string>;

/** MF-0010: grade one quick check as a normal attempt (`record_attempt`). No redirect on success. */
export async function answerSeedCheck(
  input: unknown,
): Promise<AnswerSeedCheckResult> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/today");

  const parsed = AnswerInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Pick an answer first." };

  const result = await gradeAnswer({ userId: user.id, ...parsed.data });
  if (!result.ok) return { ok: false, error: MESSAGE[result.error] };
  return { ok: true, feedback: result.feedback };
}
