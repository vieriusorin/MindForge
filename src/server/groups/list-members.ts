import "server-only";
import { createServerSupabase } from "@/server/supabase/server";
import { type GroupMember, toGroupRole } from "./types";

/** Members of a group with display names. Emails are deliberately not exposed. */
export async function listMembers(groupId: string): Promise<GroupMember[]> {
  const supabase = await createServerSupabase();
  const members = await supabase
    .from("group_members")
    .select("user_id, role")
    .eq("group_id", groupId)
    .order("joined_at");
  if (members.error) throw new Error(`listMembers: ${members.error.message}`);
  const ids = members.data.map((m) => m.user_id);
  const profiles = ids.length
    ? await supabase.from("profiles").select("id, display_name").in("id", ids)
    : { data: [], error: null };
  if (profiles.error)
    throw new Error(`listMembers/profiles: ${profiles.error.message}`);
  const names = new Map(profiles.data.map((p) => [p.id, p.display_name]));
  return members.data.map((m) => ({
    userId: m.user_id,
    displayName: names.get(m.user_id) ?? "Learner",
    role: toGroupRole(m.role),
  }));
}
