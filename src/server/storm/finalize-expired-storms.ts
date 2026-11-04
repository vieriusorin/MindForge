import "server-only";
import { createServerSupabase } from "@/server/supabase/server";

/**
 * MF-0013: finalises the signed-in learner's storms whose deadline has passed. The one write in
 * the storm read path, by decision (2026-11-04): nothing runs at the deadline itself, so a storm
 * is graded lazily, before the next storm read. Idempotent. Throws on a database error.
 */
export async function finalizeExpiredStorms(): Promise<void> {
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("finalize_expired_storms");
  if (error) throw new Error(`finalizeExpiredStorms: ${error.message}`);
}
