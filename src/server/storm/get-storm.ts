import "server-only";
import { createServerSupabase } from "@/server/supabase/server";
import { toStormSummary } from "./to-storm-summary";
import {
  STORM_SUMMARY_COLUMNS,
  StormId,
  type StormSummary,
  StormSummaryRow,
} from "./types";

/** One storm (RLS: the learner's own), or null when the id is invalid, missing or not theirs. */
export async function getStorm(stormId: string): Promise<StormSummary | null> {
  if (!StormId.safeParse(stormId).success) return null;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("storms")
    .select(STORM_SUMMARY_COLUMNS)
    .eq("id", stormId)
    .maybeSingle();
  if (error) throw new Error(`getStorm: ${error.message}`);
  return data ? toStormSummary(StormSummaryRow.parse(data)) : null;
}
