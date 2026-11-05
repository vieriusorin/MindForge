"use server";

import { redirect } from "next/navigation";
import {
  type GradeCuckooError,
  gradeCuckoo,
} from "@/server/attempts/grade-cuckoo";
import { getCurrentUser } from "@/server/auth/current-user";
import { CuckooAnswerInput } from "./schemas";
import type { AnswerCuckooResult } from "./types";

const MESSAGE = {
  "not-in-pack": "This cuckoo doesn't belong to this pack.",
  withdrawn: "This cuckoo was withdrawn for review. Start a new round.",
  changed: "This cuckoo changed since you opened it. Start a new round.",
  "invalid-line": "Pick one of the snippet's lines.",
  "not-gradable":
    "This cuckoo isn't available for grading yet. Ask an admin to sync the answer keys.",
} as const satisfies Record<GradeCuckooError, string>;

/**
 * MF-0016 SC-4: grade one cuckoo answer in the DATABASE, then reveal the flaw. Called through
 * `useMutation`; no redirect on success.
 */
export async function answerCuckoo(
  input: unknown,
): Promise<AnswerCuckooResult> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/today");

  const parsed = CuckooAnswerInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Pick a line first." };

  const result = await gradeCuckoo({ userId: user.id, ...parsed.data });
  if (!result.ok) return { ok: false, error: MESSAGE[result.error] };
  return { ok: true, feedback: result.feedback };
}
