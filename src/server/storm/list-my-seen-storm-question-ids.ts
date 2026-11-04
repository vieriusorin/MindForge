import "server-only";
import { createServerSupabase } from "@/server/supabase/server";

const PAGE_SIZE = 500;

/**
 * Ids of every question served in any of the learner's storms (item ids are globally unique, so
 * no pack filter is needed). Paged under the Data API's max_rows. Never cached.
 */
export async function listMySeenStormQuestionIds(
  userId: string,
): Promise<Set<string>> {
  const supabase = await createServerSupabase();
  const seen = new Set<string>();
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("storm_questions")
      .select("question_id")
      .eq("user_id", userId)
      .order("storm_id")
      .order("question_id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`listMySeenStormQuestionIds: ${error.message}`);
    for (const r of data) seen.add(r.question_id);
    if (data.length < PAGE_SIZE) return seen;
  }
}
