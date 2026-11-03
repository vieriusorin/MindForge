import "server-only";
import { createServerSupabase } from "@/server/supabase/server";

/** The signed-in user's own display name. RLS allows reading one's own profile. Never cached: per user. */
export async function getDisplayName(userId: string): Promise<string | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(`getDisplayName: ${error.message}`);
  return data?.display_name ?? null;
}
