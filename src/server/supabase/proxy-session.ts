import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import type { Database } from "@/server/db/database.types";
import { supabasePublicEnv } from "./env";

const PROTECTED_PREFIXES = ["/groups", "/today"] as const;

/**
 * Refresh the auth session on every matched request and make an OPTIMISTIC redirect for
 * protected pages. This is not authorization: pages and actions re-check the user and RLS decides.
 */
export async function updateSession(
  request: NextRequest,
): Promise<NextResponse> {
  const { url, publishableKey } = supabasePublicEnv();
  let response = NextResponse.next({ request });
  // Headers @supabase/ssr asks us to send with refreshed/cleared cookies (no-store caching).
  // Kept separately so a redirect can carry them too (MF-0004 SC-5).
  const sessionHeaders: Record<string, string> = {};

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet)
          request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet)
          response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers)) {
          sessionHeaders[key] = value;
          response.headers.set(key, value);
        }
      },
    },
  });

  // Nothing may run between creating the client and this call: it refreshes the session.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  const { pathname, search } = request.nextUrl;
  if (
    !signedIn &&
    PROTECTED_PREFIXES.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`),
    )
  ) {
    const target = request.nextUrl.clone();
    target.pathname = "/sign-in";
    target.search = `?next=${encodeURIComponent(`${pathname}${search}`)}`;
    const redirect = NextResponse.redirect(target);
    for (const cookie of response.cookies.getAll())
      redirect.cookies.set(cookie);
    for (const [key, value] of Object.entries(sessionHeaders))
      redirect.headers.set(key, value);
    return redirect;
  }
  return response;
}
