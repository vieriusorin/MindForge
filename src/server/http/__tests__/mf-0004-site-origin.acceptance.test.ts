/**
 * MF-0004 acceptance (SC-4, SC-9 config half): emailed links and invite URLs use the configured
 * site origin, never one taken from request headers; the local Auth allowlist holds exact origins
 * only; local dev runs on port 3001.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ROOT = resolve(import.meta.dirname, "../../../..");
const SITE = "https://mindforge.vercel.app";
const HOSTILE = new Headers({
  origin: "https://evil.example",
  host: "evil.example",
  "x-forwarded-host": "evil.example",
  "x-forwarded-proto": "https",
});

const { signInWithOtp } = vi.hoisted(() => ({ signInWithOtp: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: async () => HOSTILE,
  cookies: async () => ({ getAll: () => [], set: () => {} }),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect ${to}`);
  },
}));
vi.mock("@/server/supabase/server", () => ({
  createServerSupabase: async () => ({ auth: { signInWithOtp } }),
}));

beforeEach(() => {
  signInWithOtp.mockReset();
  signInWithOtp.mockResolvedValue({ data: {}, error: null });
});
afterEach(() => {
  vi.unstubAllEnvs();
});

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory())
      return name === "__tests__" ? [] : sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

function configToml(): string {
  return readFileSync(join(ROOT, "supabase/config.toml"), "utf8");
}

describe("MF-0004 site origin", () => {
  it("SC-4: the magic-link redirect uses SITE_URL even when Origin / Host / X-Forwarded-Host are hostile", async () => {
    vi.stubEnv("SITE_URL", SITE);
    const { sendMagicLink } = await import("@/features/auth/actions");
    const form = new FormData();
    form.set("email", "learner@example.com");
    form.set("next", "/groups");

    const result = await sendMagicLink({ status: "idle" } as never, form);

    expect(result).toMatchObject({ status: "sent" });
    const redirectTo = new URL(
      signInWithOtp.mock.calls[0]?.[0]?.options?.emailRedirectTo,
    );
    expect(redirectTo.origin).toBe(SITE);
    expect(redirectTo.pathname).toBe("/auth/callback");
  });

  it("SC-4: siteOrigin returns the configured origin, defaults to localhost:3001 in dev, and fails closed in production", async () => {
    const { siteOrigin } = await import("@/server/http/site-origin");

    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SITE_URL", SITE);
    expect(siteOrigin()).toBe(SITE);

    vi.stubEnv("SITE_URL", "");
    expect(() => siteOrigin()).toThrow(/SITE_URL/);

    vi.stubEnv("SITE_URL", "https://mindforge.vercel.app/some/path");
    expect(() => siteOrigin()).toThrow(/SITE_URL/);

    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("SITE_URL", "");
    expect(siteOrigin()).toBe("http://localhost:3001");
  });

  it("SC-4: no app code derives an origin from request headers", () => {
    const offenders = sourceFiles(join(ROOT, "src")).filter((file) =>
      /x-forwarded-host|requestOrigin\s*\(/i.test(readFileSync(file, "utf8")),
    );
    expect(offenders.map((f) => f.slice(ROOT.length + 1))).toEqual([]);
  });

  it("SC-4: the local Auth redirect allowlist holds exact origins on port 3001, no host wildcards", () => {
    const line = configToml().match(
      /^additional_redirect_urls\s*=\s*(\[.*\])/m,
    );
    expect(line).not.toBeNull();
    const urls = JSON.parse(line?.[1] ?? "[]") as string[];
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      const origin = url.match(/^(https?:\/\/[^/]+)/)?.[1] ?? url;
      expect(origin).not.toContain("*");
      expect(["http://localhost:3001", "http://127.0.0.1:3001"]).toContain(
        origin,
      );
    }
  });

  it("SC-9: site_url and `pnpm dev` use port 3001", () => {
    expect(configToml()).toMatch(/^site_url\s*=\s*"http:\/\/localhost:3001"/m);
    const pkg = JSON.parse(
      readFileSync(join(ROOT, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    expect(pkg.scripts.dev).toMatch(/(-p|--port)\s+3001\b/);
  });
});
