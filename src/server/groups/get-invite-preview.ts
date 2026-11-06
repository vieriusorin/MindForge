import "server-only";
import { z } from "zod";
import { InviteCode } from "@/lib/invite-code";
import { createServerSupabase } from "@/server/supabase/server";
import type { InvitePreview } from "./types";

// The generated type says `path_slug: string`, but it is null for a pack-only group.
const InvitePreviewRows = z
  .array(z.object({ name: z.string(), path_slug: z.string().nullable() }))
  .max(1);

/**
 * MF-0059: the group an invite code points at (name and path), or null when the code is malformed,
 * unknown or reset. Signed-in callers only; per-user, never cached. Throws on a database error.
 */
export async function getInvitePreview(
  code: string,
): Promise<InvitePreview | null> {
  if (!InviteCode.safeParse(code).success) return null;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("group_invite_preview", {
    p_code: code,
  });
  if (error) throw new Error(`getInvitePreview: ${error.message}`);
  const [row] = InvitePreviewRows.parse(data);
  if (!row) return null;
  return { name: row.name, pathSlug: row.path_slug };
}
