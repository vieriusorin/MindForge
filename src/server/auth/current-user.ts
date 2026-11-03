import "server-only";
import { createServerSupabase } from "@/server/supabase/server";

export interface CurrentUser {
  id: string;
  email: string | null;
}

/** The verified signed-in user (JWT checked via getClaims), or null. Never trusts getSession(). */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (error || typeof sub !== "string") return null;
  const email = data?.claims?.email;
  return { id: sub, email: typeof email === "string" ? email : null };
}
