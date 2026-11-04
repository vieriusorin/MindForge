import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/server/db/database.types";
import { supabasePublicEnv } from "./env";

/**
 * ADR 0004 / MF-0011: a client with the project's SECRET key. It bypasses RLS, so it exists for one
 * read only — the group heatmap's cross-member attempts (`group_attempts`, EXECUTE for the server
 * role only) — and `get-group-heatmap.ts` is its only importer (locked by
 * `__tests__/secret-client-importers.test.ts`). Never pass it, or anything it returns unaggregated,
 * out of `src/server/**`. The key is never a NEXT_PUBLIC_ variable.
 */
export function createSecretSupabase(): SupabaseClient<Database> {
  const { url } = supabasePublicEnv();
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      "Missing SUPABASE_SECRET_KEY (server-only; see .env.example and ADR 0004)",
    );
  }
  return createClient<Database>(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
