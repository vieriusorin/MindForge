import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/server/db/database.types";
import { toRecentStorm } from "./to-recent-storm";
import {
  RECENT_STORM_COLUMNS,
  type RecentStorm,
  RecentStormRow,
} from "./types";

/**
 * MF-0052 SC-11: a learner's newest FINISHED storms of a pack (at most `limit`), ordered by
 * (finished_at, id) descending, each with its graded questions in storm order, through the given
 * (RLS-bound) client. Throws on a Supabase error.
 */
export async function fetchRecentStorms(
  client: SupabaseClient<Database>,
  userId: string,
  packSlug: string,
  limit = 5,
): Promise<RecentStorm[]> {
  const { data, error } = await client
    .from("storms")
    .select(RECENT_STORM_COLUMNS)
    .eq("user_id", userId)
    .eq("pack_slug", packSlug)
    .not("finished_at", "is", null)
    .order("finished_at", { ascending: false })
    .order("id", { ascending: false })
    .order("position", { referencedTable: "storm_questions" })
    .limit(limit);
  if (error) throw new Error(`fetchRecentStorms: ${error.message}`);
  return data.map((row) => toRecentStorm(RecentStormRow.parse(row)));
}
