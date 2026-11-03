import "server-only";
import { createServerSupabase } from "@/server/supabase/server";
import { type MyGroup, toGroupRole } from "./types";

/** Groups the user belongs to. RLS limits rows; the user filter skips co-members' rows. */
export async function listMyGroups(userId: string): Promise<MyGroup[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("group_members")
    .select("role, groups(id, name, pack_slug)")
    .eq("user_id", userId)
    .order("joined_at", { ascending: false });
  if (error) throw new Error(`listMyGroups: ${error.message}`);
  return data.flatMap((r) =>
    r.groups
      ? [
          {
            id: r.groups.id,
            name: r.groups.name,
            packSlug: r.groups.pack_slug,
            role: toGroupRole(r.role),
          },
        ]
      : [],
  );
}
