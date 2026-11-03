const PROBE_ORIGIN = "http://mindforge.invalid";

/**
 * Only same-origin relative paths may be used as a post-sign-in redirect target.
 * Rejects protocol-relative (`//x`), backslash tricks (`/\x`), absolute URLs, control characters
 * and encoded slashes/backslashes, which some layers decode before redirecting.
 */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\"))
    return null;
  // biome-ignore lint/suspicious/noControlCharactersInRegex: rejecting control characters is the point
  if (/[\u0000-\u001f\u007f\\]/.test(raw)) return null;
  if (/%2f|%5c/i.test(raw)) return null;
  let url: URL;
  try {
    url = new URL(raw, PROBE_ORIGIN);
  } catch {
    return null;
  }
  if (url.origin !== PROBE_ORIGIN) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}
