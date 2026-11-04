"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current-user";
import { startStormFor } from "@/server/storm/start-storm";
import { createServerSupabase } from "@/server/supabase/server";
import { AnswerStormInput, FinishStormInput, StartStormInput } from "./schemas";
import type {
  AnswerStormResult,
  FinishStormResult,
  StartStormResult,
} from "./types";
import { START_MESSAGE, stormRpcError } from "./utils/rpc-errors";

/**
 * MF-0013: compose and start a storm. Returns the id; the hook navigates. The database checks
 * the composition and owns the clock.
 */
export async function startStorm(input: unknown): Promise<StartStormResult> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/today");

  const parsed = StartStormInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: START_MESSAGE["not-ready"] };

  const result = await startStormFor({ userId: user.id, ...parsed.data });
  if (!result.ok) return { ok: false, error: START_MESSAGE[result.error] };
  return { ok: true, stormId: result.stormId };
}

/**
 * MF-0013 SC-4: store (or replace) one answer. Returns no grade: correctness is decided only when
 * the storm finishes. The DB refuses it after `ends_at` (MF013) or on a changed hash (55000).
 */
export async function answerStormQuestion(
  input: unknown,
): Promise<AnswerStormResult> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/today");

  const parsed = AnswerStormInput.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: { message: "Pick an answer first.", isStormOver: false },
    };

  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("answer_storm_question", {
    p_storm_id: parsed.data.stormId,
    p_question_id: parsed.data.questionId,
    p_chosen: parsed.data.chosen,
    p_content_hash: parsed.data.contentHash,
  });
  if (error) return { ok: false, error: stormRpcError(error) };
  return { ok: true };
}

/** MF-0013: end the storm now; the DB grades it. Idempotent: finishing a finished storm is a no-op. */
export async function finishStorm(input: unknown): Promise<FinishStormResult> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/today");

  const parsed = FinishStormInput.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: { message: "This storm doesn't exist.", isStormOver: false },
    };

  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("finish_storm", {
    p_storm_id: parsed.data.stormId,
  });
  if (error) return { ok: false, error: stormRpcError(error) };
  return { ok: true };
}
