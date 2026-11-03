/**
 * MF-0004 acceptance (SC-5): when the proxy sends a dead session to /sign-in, the redirect keeps
 * the no-store cache headers and the cookie changes that @supabase/ssr handed to setAll.
 * Mocked at the facade (@supabase/ssr): the session refresh clears the cookie, as it does for a
 * dead refresh token.
 */
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const NO_STORE = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
  Expires: "0",
  Pragma: "no-cache",
};

vi.mock("@supabase/ssr", () => ({
  createServerClient: (
    _url: string,
    _key: string,
    options: {
      cookies: {
        setAll: (
          cookies: { name: string; value: string; options: object }[],
          headers: Record<string, string>,
        ) => void;
      };
    },
  ) => ({
    auth: {
      getClaims: async () => {
        options.cookies.setAll(
          [
            {
              name: "sb-test-auth-token",
              value: "",
              options: { maxAge: 0, path: "/" },
            },
          ],
          NO_STORE,
        );
        return { data: null, error: null };
      },
    },
  }),
}));

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
});

describe("MF-0004 proxy session", () => {
  it("SC-5: the redirect to /sign-in keeps the no-store headers and the cleared cookie", async () => {
    const { updateSession } = await import("@/server/supabase/proxy-session");
    const request = new NextRequest("http://localhost:3001/groups/abc?tab=x", {
      headers: { cookie: "sb-test-auth-token=stale" },
    });

    const response = await updateSession(request);

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe("/sign-in");
    expect(location.searchParams.get("next")).toBe("/groups/abc?tab=x");
    for (const [key, value] of Object.entries(NO_STORE))
      expect(response.headers.get(key)).toBe(value);
    expect(response.cookies.get("sb-test-auth-token")?.value).toBe("");
  });
});
