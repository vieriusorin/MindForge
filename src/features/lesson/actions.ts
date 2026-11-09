"use server";

import { redirect } from "next/navigation";
import { AnswerInput } from "@/lib/answer-input";
import { type GradeError, gradeAnswer } from "@/server/attempts/grade-answer";
import type { GradeOrderError } from "@/server/attempts/grade-order";
import { getCurrentUser } from "@/server/auth/current-user";
import { OrderAnswerInput } from "./schemas";
import type { AnswerLessonItemResult, AnswerLessonOrderResult } from "./types";

const MESSAGE = {
  "not-in-pack": "This question doesn't belong to this pack.",
  withdrawn:
    "This question was withdrawn for review. Reload the page for a fresh lesson.",
  changed:
    "This question changed since you opened it. Reload the page for a fresh lesson.",
  "not-gradable":
    "This question isn't available for grading yet. Ask an admin to sync the answer keys.",
} as const satisfies Record<GradeError, string>;

/**
 * MF-0064 D-L9: grade one lesson answer as a normal attempt, through the shared grading path
 * (`gradeAnswer` → `record_attempt`). No redirect on success; the guess step never calls this.
 */
export async function answerLessonItem(
  input: unknown,
): Promise<AnswerLessonItemResult> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/today");

  const parsed = AnswerInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Pick an answer first." };

  const result = await gradeAnswer({ userId: user.id, ...parsed.data });
  if (!result.ok) return { ok: false, error: MESSAGE[result.error] };
  return { ok: true, feedback: result.feedback };
}

const ORDER_MESSAGE = {
  "not-in-pack": "This order doesn't belong to this pack.",
  withdrawn:
    "This order was withdrawn for review. Reload the page for a fresh lesson.",
  changed:
    "This order changed since you opened it. Reload the page for a fresh lesson.",
  "invalid-order": "Place every step once, then check.",
  "not-gradable":
    "This order isn't available for grading yet. Ask an admin to sync the answer keys.",
} as const satisfies Record<GradeOrderError, string>;

/**
 * MF-0066 SC-7: grade one order answer in the DATABASE (`gradeOrder` → `record_attempt`), then reveal the
 * key order. Called through `useMutation`; no redirect on success.
 */
export async function answerLessonOrder(
  input: unknown,
): Promise<AnswerLessonOrderResult> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/today");

  const parsed = OrderAnswerInput.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: ORDER_MESSAGE["invalid-order"] };

  // Loaded on call, not at module load: tests that import this module for `answerLessonItem` mock only
  // `grade-answer`, and a static import would pull `server-only` into them (MF-0065 SC-10 acceptance).
  const { gradeOrder } = await import("@/server/attempts/grade-order");
  const result = await gradeOrder({ userId: user.id, ...parsed.data });
  if (!result.ok) return { ok: false, error: ORDER_MESSAGE[result.error] };
  return { ok: true, feedback: result.feedback };
}
