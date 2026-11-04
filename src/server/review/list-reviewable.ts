import "server-only";
import type { ReviewCandidate } from "@/engine/content";
import { createServerSupabase } from "@/server/supabase/server";
import { ReviewableRows } from "./types";

/**
 * MF-0007: items in the caller's review queue for a pack: unreviewed, not authored by them, not
 * yet reviewed by them on the current version. Throws when the caller is in no group for the
 * pack, so check membership first. Unordered: the engine orders the queue.
 */
export async function listReviewable(
  packSlug: string,
): Promise<ReviewCandidate[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("list_reviewable", {
    p_pack_slug: packSlug,
  });
  if (error) throw new Error(`listReviewable: ${error.message}`);
  return ReviewableRows.parse(data).map((r) => ({
    itemId: r.item_id,
    skillCode: r.skill_code,
    itemType: r.item_type,
    contentHash: r.content_hash,
  }));
}
