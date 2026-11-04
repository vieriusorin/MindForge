import { z } from "zod";

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);
const Email = z.email();

/**
 * MF-0029 SC-1: the seed writes only to the local stack, for a known sign-in email. Throws before any
 * write when `SUPABASE_DB_URL` is set (empty counts as unset: `pnpm db:reset` passes it empty), when
 * the DB host is not a loopback name, or when `MF_AUTHOR_EMAIL` is missing or not an email.
 */
export function assertLocalSeedTarget({
  env,
  dbUrl,
  apiUrl,
}: {
  env: Record<string, string | undefined>;
  dbUrl: string;
  /** The Auth API the admin client calls (users are created and deleted there). */
  apiUrl?: string;
}): { youEmail: string } {
  if (env.SUPABASE_DB_URL?.trim())
    throw new Error(
      "Refusing SUPABASE_DB_URL: the demo seed writes to the local stack only. Unset it.",
    );
  for (const url of apiUrl === undefined ? [dbUrl] : [dbUrl, apiUrl]) {
    let host: string;
    try {
      host = new URL(url).hostname;
    } catch {
      throw new Error(
        "The demo seed runs against the local stack only (bad URL).",
      );
    }
    if (!LOCAL_HOSTS.has(host))
      throw new Error(
        `The demo seed runs against the local stack only, not "${host}".`,
      );
  }
  const email = Email.safeParse(env.MF_AUTHOR_EMAIL?.trim().toLowerCase());
  if (!email.success)
    throw new Error(
      "Set MF_AUTHOR_EMAIL to the email you sign in to MindForge with (the seed adds you to the demo group).",
    );
  return { youEmail: email.data };
}
