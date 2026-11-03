import { type NextRequest, NextResponse } from "next/server";
import { safeNextPath } from "@/server/auth/safe-next";
import { createServerSupabase } from "@/server/supabase/server";

const NO_STORE = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
};

function redirectNoStore(url: URL): NextResponse {
  const response = NextResponse.redirect(url);
  for (const [k, v] of Object.entries(NO_STORE)) response.headers.set(k, v);
  return response;
}

/** Magic-link landing: exchange the PKCE code for a session, then go to a safe same-origin path. */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next =
    safeNextPath(request.nextUrl.searchParams.get("next")) ?? "/today";
  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return redirectNoStore(new URL(next, request.nextUrl.origin));
  }
  const failed = new URL("/sign-in", request.nextUrl.origin);
  failed.searchParams.set("error", "link");
  failed.searchParams.set("next", next);
  return redirectNoStore(failed);
}
