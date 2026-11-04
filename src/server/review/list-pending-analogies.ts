import "server-only";
import { createServerSupabase } from "@/server/supabase/server";
import {
  INSUFFICIENT_PRIVILEGE,
  type PendingAnalogy,
  PendingAnalogyRows,
} from "./types";

/**
 * MF-0007: nature cards whose current version awaits the analogy approval. `null` when the
 * caller is not a content maintainer of the pack.
 */
export async function listPendingAnalogies(
  packSlug: string,
): Promise<PendingAnalogy[] | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("list_pending_analogies", {
    p_pack_slug: packSlug,
  });
  if (error?.code === INSUFFICIENT_PRIVILEGE) return null;
  if (error) throw new Error(`listPendingAnalogies: ${error.message}`);
  return PendingAnalogyRows.parse(data).map((r) => ({
    itemId: r.item_id,
    approvals: r.approvals,
    hashSyncedAt: r.hash_synced_at,
    canApprove: r.can_approve,
  }));
}
