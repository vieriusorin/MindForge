import "server-only";
import { createServerSupabase } from "@/server/supabase/server";
import { type Expedition, LatestExpeditionRows } from "./types";

/**
 * MF-0017: the group's most recent expedition (active or ended), or null when it never had one.
 * Throws when the viewer isn't a member (42501, the page already gates on membership) or on any
 * database error. Group-scoped: never cached.
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
  if (!row) return null;
  return {
    id: row.id,
    domainCode: row.domain_code,
    target: row.target,
    startsAt: new Date(row.starts_at).toISOString(),
    endsAt: new Date(row.ends_at).toISOString(),
  };
}
