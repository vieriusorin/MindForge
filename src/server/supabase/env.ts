export interface SupabasePublicEnv {
  url: string;
  publishableKey: string;
}

/** Public (browser-safe) Supabase settings. Never put a secret key in a NEXT_PUBLIC_ variable. */
export function supabasePublicEnv(): SupabasePublicEnv {
  // literal access so Next can inline the values
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (see .env.example)",
    );
  }
  return { url, publishableKey };
}
