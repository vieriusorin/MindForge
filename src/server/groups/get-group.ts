import "server-only";
import { createServerSupabase } from "@/server/supabase/server";
import type { GroupDetail } from "./types";

/** One group, or null when it doesn't exist OR the user isn't a member (RLS hides it). */
export async function getGroup(groupId: string): Promise<GroupDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(groupId)) return null;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("groups")
    .select(
      "id, name, pack_slug, invite_code, created_by, path_slug, discussion_url",
    )
    .eq("id", groupId)
    .maybeSingle();
  if (error) throw new Error(`getGroup: ${error.message}`);
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    packSlug: data.pack_slug,
    inviteCode: data.invite_code,
    createdBy: data.created_by,
    pathSlug: data.path_slug,
    discussionUrl: data.discussion_url,
  };
}
