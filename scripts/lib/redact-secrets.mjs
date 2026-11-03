const REDACTED = "<redacted>";
/** A field / label naming a credential. */
const SECRET_NAME = /key|secret/i;
/** Credential-shaped values: Supabase API keys and JWTs. */
const TOKEN =
  /sb_(?:secret|publishable)_[A-Za-z0-9_-]+|eyJ[\w-]+\.[\w-]+\.[\w-]*/g;
/** "<label with key|secret><: or │> <long value>" in the CLI's text and table output. */
const LABELLED = /^(.*\b(?:key|secret)\b[^:│]*[:│]\s*)(\S{16,})/i;

/**
 * MF-0018: hide credentials in one line of Supabase CLI output, so `pnpm dev:setup` never prints
 * keys that could end up in a pasted or committed log. URLs and other lines pass through as-is.
 * @param {string} line
 * @returns {string}
 */
export function redactSecrets(line) {
  const trimmed = line.trim();
  if (trimmed.startsWith("{")) {
    try {
      const obj = JSON.parse(trimmed);
      for (const k of Object.keys(obj))
        if (SECRET_NAME.test(k) && typeof obj[k] === "string")
          obj[k] = REDACTED;
      return JSON.stringify(obj);
    } catch {
      // not JSON — fall through to the text rules
    }
  }
  return line.replace(TOKEN, REDACTED).replace(LABELLED, `$1${REDACTED}`);
}
