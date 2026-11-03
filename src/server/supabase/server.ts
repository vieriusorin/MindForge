import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { connection } from "next/server";
import type { Database } from "@/server/db/database.types";
import { supabasePublicEnv } from "./env";

/**
 * A per-request Supabase client acting AS the signed-in user (publishable key + their session
 * cookie), so every query is decided by RLS. Create one per request; never share it.
 */
export async function createServerSupabase(): Promise<
  SupabaseClient<Database>
> {
  // Per-user data is never part of a prerendered App Shell: auth checks token expiry with
  // Date.now(), and RLS-scoped rows must not be cached (Next docs: optimizing-prefetching §208).
  await connection();
  const { url, publishableKey } = supabasePublicEnv();
  const cookieStore = await cookies();
  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet)
            cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component, where cookies are read-only. proxy.ts refreshes them.
        }
      },
    },
  });
}
