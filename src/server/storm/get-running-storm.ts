import "server-only";
import { createServerSupabase } from "@/server/supabase/server";
import { toStormSummary } from "./to-storm-summary";
import {
  STORM_SUMMARY_COLUMNS,
  type StormSummary,
  StormSummaryRow,
} from "./types";

/**
 * The learner's unfinished storm, or null. A past-deadline storm counts until it is finalised:
 * call `finalizeExpiredStorms()` first. Never cached.
 */
export async function getRunningStorm(
  userId: string,
): Promise<StormSummary | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("storms")
    .select(STORM_SUMMARY_COLUMNS)
    .eq("user_id", userId)
    .is("finished_at", null)
    .maybeSingle();
  if (error) throw new Error(`getRunningStorm: ${error.message}`);
  return data ? toStormSummary(StormSummaryRow.parse(data)) : null;
}
