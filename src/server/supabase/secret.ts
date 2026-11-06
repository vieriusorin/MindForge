import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/server/db/database.types";
import { supabasePublicEnv } from "./env";

/**
 * ADR 0004 / MF-0011 and ADR 0006 / MF-0058: a client with the project's SECRET key. It bypasses
 * RLS, so it exists for one read and one write only: the group heatmap's cross-member attempts
 * (`group_attempts`, EXECUTE for the server role only, `get-group-heatmap.ts`) and the
 * course-completion insert (`record-course-completion.ts`). Those two files are its only importers
 * (locked by `__tests__/secret-client-importers.test.ts`). Never pass it, or anything it returns
 * unaggregated, out of `src/server/**`. The key is never a NEXT_PUBLIC_ variable.
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
