import type { SupabaseClient } from "@supabase/supabase-js";
import type { StormResult } from "@/engine/storm";
import type { Database } from "@/server/db/database.types";
import { toStormResult } from "./to-storm-result";
import { StormResultRow } from "./types";

/** Below the Data API's max_rows (1000), so a full page always means "there may be more". */
const PAGE_SIZE = 500;

/**
 * Every FINISHED storm of a learner for a pack, oldest first, with its graded questions, through
 * the given (RLS-bound) client. Paged by storm, ordered by (finished_at, id) so pages never skip
 * or repeat.
 */
export async function fetchStormResults(
  client: SupabaseClient<Database>,
  userId: string,
  packSlug: string,
): Promise<StormResult[]> {
  const out: StormResult[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client
      .from("storms")
      .select(
        "kind, finished_at, storm_questions(position, question_id, skill_code, chosen, correct, voided)",
      )
      .eq("user_id", userId)
      .eq("pack_slug", packSlug)
      .not("finished_at", "is", null)
      .order("finished_at")
      .order("id")
      .order("position", { referencedTable: "storm_questions" })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`fetchStormResults: ${error.message}`);
    for (const row of data) out.push(toStormResult(StormResultRow.parse(row)));
    if (data.length < PAGE_SIZE) return out;
  }
}
