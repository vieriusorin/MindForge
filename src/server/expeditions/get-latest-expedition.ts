import "server-only";
import { createServerSupabase } from "@/server/supabase/server";
import { toExpedition } from "./to-expedition";
import { type Expedition, LatestExpeditionRows } from "./types";

/**
 * MF-0017: the group's most recent expedition (active or ended), or null when it never had one.
 * MF-0059: `endsAt` is null for an open expedition. Throws when the viewer isn't a member (42501,
 * the page already gates on membership) or on any database error. Group-scoped: never cached.
 */
export async function getLatestExpedition(
  groupId: string,
): Promise<Expedition | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("latest_expedition", {
    p_group_id: groupId,
  });
  if (error) throw new Error(`getLatestExpedition: ${error.message}`);
  const [row] = LatestExpeditionRows.parse(data);
  return row ? toExpedition(row) : null;
}
