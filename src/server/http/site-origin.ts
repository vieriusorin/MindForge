/**
 * MF-0004: the site origin for links we send out (magic-link redirects, invite URLs).
 *
 * It comes from configuration (`SITE_URL`, server-only), never from the Origin, Host or
 * forwarded-host request headers: those are client-controlled, and a forged one would put an attacker's host
 * in a victim's sign-in email. Production fails closed when `SITE_URL` is missing or isn't a bare
 * origin. Elsewhere the default is the local dev server.
 *
 */
import "server-only";

const DEV_ORIGIN = "http://localhost:3001";

export function siteOrigin(): string {
  const raw = process.env.SITE_URL?.trim();
  if (!raw) {
    if (process.env.NODE_ENV === "production")
      throw new Error(
        "SITE_URL is not set (e.g. https://mindforge.vercel.app)",
      );
    return DEV_ORIGIN;
  }
  return parseOrigin(raw);
}

function parseOrigin(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("SITE_URL is not a valid URL");
  }
  const bare = url.href === `${url.origin}/`;
  if (!["http:", "https:"].includes(url.protocol) || !bare)
    throw new Error(
      "SITE_URL must be a bare http(s) origin, without a path, query or hash",
    );
  return url.origin;
}
