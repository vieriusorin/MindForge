import "server-only";
import { createServerSupabase } from "@/server/supabase/server";
import { StormId, StormQuestionDbRows, type StormQuestionRow } from "./types";

/**
 * A storm's questions in served order (RLS: own storms only); [] for an invalid or hidden id.
 * No key: `correct` is null until finish, and the report reads the key from the pack files only
 * once the storm is finished.
 */
export async function listStormQuestions(
  stormId: string,
): Promise<StormQuestionRow[]> {
  if (!StormId.safeParse(stormId).success) return [];
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("storm_questions")
    .select(
      "question_id, skill_code, domain_code, position, content_hash, unreviewed, chosen, correct, voided",
    )
    .eq("storm_id", stormId)
    .order("position");
  if (error) throw new Error(`listStormQuestions: ${error.message}`);
  return StormQuestionDbRows.parse(data).map((r) => ({
    questionId: r.question_id,
    skillCode: r.skill_code,
    domainCode: r.domain_code,
    position: r.position,
    contentHash: r.content_hash,
    unreviewed: r.unreviewed,
    chosen: r.chosen,
    correct: r.correct,
    voided: r.voided,
  }));
}
