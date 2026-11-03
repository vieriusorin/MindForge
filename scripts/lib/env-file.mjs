/**
 * MF-0018: merge KEY=value pairs into a .env file's text without touching anything else.
 * Existing keys are updated in place; missing keys are appended; comments, blank lines and other
 * keys keep their order. Idempotent.
 * @param {string} existingText current file contents ("" when the file does not exist)
 * @param {Record<string, string>} values keys to add or update
 * @returns {string}
 */
export function mergeEnv(existingText, values) {
  const lines =
    existingText === "" ? [] : existingText.replace(/\n$/, "").split("\n");
  const pending = new Map(Object.entries(values));
  const merged = lines.map((line) => {
    const key = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line)?.[1];
    if (key && pending.has(key)) {
      const value = pending.get(key);
      pending.delete(key);
      return `${key}=${value}`;
    }
    return line;
  });
  for (const [key, value] of pending) merged.push(`${key}=${value}`);
  return `${merged.join("\n")}\n`;
}
