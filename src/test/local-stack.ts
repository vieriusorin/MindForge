/**
 * Test-only access to the LOCAL Supabase stack (`supabase start`). Never imported by app code.
 * The secret key here is the stack's well-known local default, used only to create and delete test users.
 */
import { execFileSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { supabaseBin } from "../../scripts/lib/supabase-bin.mjs";

interface StackEnv {
  API_URL: string;
  DB_URL: string;
  PUBLISHABLE_KEY: string;
  SECRET_KEY: string;
}

let cached: StackEnv | null = null;

/**
 * MF-0018: the project-pinned CLI (devDependency), so no global install is needed. Same resolver
 * as the scripts: on Windows the native supabase.exe, since `.bin/supabase` is a shell script.
 */
const SUPABASE = supabaseBin(process.cwd());

export function stackEnv(): StackEnv {
  if (cached) return cached;
  const out = execFileSync(SUPABASE, ["status", "-o", "json"], {
    encoding: "utf8",
  });
  const json = JSON.parse(
    out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1),
  ) as StackEnv;
  cached = json;
  return json;
}

const NO_SESSION = {
  auth: { persistSession: false, autoRefreshToken: false },
} as const;

export function anonClient(): SupabaseClient {
  const env = stackEnv();
  return createClient(env.API_URL, env.PUBLISHABLE_KEY, NO_SESSION);
}

export function adminClient(): SupabaseClient {
  const env = stackEnv();
  return createClient(env.API_URL, env.SECRET_KEY, NO_SESSION);
}

export function sql(): postgres.Sql {
  return postgres(stackEnv().DB_URL, { max: 1, onnotice: () => {} });
}

export interface TestUser {
  id: string;
  email: string;
  client: SupabaseClient;
}

const PASSWORD = "local-test-password-1";

/** Create a confirmed user via the admin API and return a client signed in as them. */
export async function createTestUser(email: string): Promise<TestUser> {
  const admin = adminClient();
  const created = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (created.error || !created.data.user)
    throw created.error ?? new Error("createUser failed");
  const client = anonClient();
  const signedIn = await client.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  if (signedIn.error) throw signedIn.error;
  return { id: created.data.user.id, email, client };
}

export async function deleteTestUser(id: string): Promise<void> {
  await adminClient().auth.admin.deleteUser(id);
}
