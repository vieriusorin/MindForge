import "server-only";
import { createServerSupabase } from "@/server/supabase/server";
import { fetchRecentStorms } from "./fetch-recent-storms";
import type { RecentStorm } from "./types";

/** MF-0052 SC-11: the signed-in learner's 5 newest finished storms of a pack (RLS: own rows only). Never cached. */
export async function listMyRecentStorms(
  userId: string,
  packSlug: string,
): Promise<RecentStorm[]> {
  return fetchRecentStorms(await createServerSupabase(), userId, packSlug);
}
