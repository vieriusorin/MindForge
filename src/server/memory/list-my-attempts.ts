import "server-only";
import type { Attempt } from "@/engine/memory";
import { createServerSupabase } from "@/server/supabase/server";
import { fetchAttempts } from "./fetch-attempts";

/** The signed-in learner's graded attempts for a pack (RLS: own rows only). Never cached. */
export async function listMyAttempts(
  userId: string,
  packSlug: string,
): Promise<Attempt[]> {
  return fetchAttempts(await createServerSupabase(), userId, packSlug);
}
