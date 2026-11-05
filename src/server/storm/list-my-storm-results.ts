import "server-only";
import type { StormResult } from "@/engine/storm";
import { createServerSupabase } from "@/server/supabase/server";
import { fetchStormResults } from "./fetch-storm-results";

/** The signed-in learner's finished storms for a pack (RLS: own rows only). Never cached. */
export async function listMyStormResults(
  userId: string,
  packSlug: string,
): Promise<StormResult[]> {
  return fetchStormResults(await createServerSupabase(), userId, packSlug);
}
