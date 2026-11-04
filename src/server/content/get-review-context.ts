import "server-only";
import { type ReviewContext, reviewContextFromRows } from "@/engine/content";
import { ReviewStateRows } from "@/server/review/types";
import { createServerSupabase } from "@/server/supabase/server";

/**
 * MF-0006 SC-8, the review seam: what this learner may be served from a pack. MF-0007: read from
 * `review_states`, which answers for the session's user (auth.uid()); `_userId` keeps the seam's
 * signature. Per-user (spoiled), so never cached. Throws on a database error.
 */
export async function getReviewContext(
  _userId: string,
  packSlug: string,
): Promise<ReviewContext> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("review_states", {
    p_pack_slug: packSlug,
  });
  if (error) throw new Error(`getReviewContext: ${error.message}`);
  return reviewContextFromRows(
    ReviewStateRows.parse(data).map((r) => ({
      itemId: r.item_id,
      state: r.state,
      reviewedAt: r.reviewed_at,
    })),
  );
}
