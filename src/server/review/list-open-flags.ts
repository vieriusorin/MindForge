import "server-only";
import { createServerSupabase } from "@/server/supabase/server";
import { INSUFFICIENT_PRIVILEGE, type OpenFlag, OpenFlagRows } from "./types";

/**
 * MF-0007: open flags on a pack's items, oldest first. `null` when the caller is not a content
 * maintainer of the pack: the database refuses, and that refusal is "not visible", not an error.
 */
export async function listOpenFlags(
  packSlug: string,
): Promise<OpenFlag[] | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("list_open_flags", {
    p_pack_slug: packSlug,
  });
  if (error?.code === INSUFFICIENT_PRIVILEGE) return null;
  if (error) throw new Error(`listOpenFlags: ${error.message}`);
  return OpenFlagRows.parse(data).map((r) => ({
    itemId: r.item_id,
    flagId: r.flag_id,
    comment: r.comment,
    reviewerName: r.reviewer_name,
    createdAt: r.created_at,
  }));
}
