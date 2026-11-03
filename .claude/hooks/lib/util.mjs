/**
 * MF-0001: helpers the P4T hooks imported from `scripts/lib/ticket-eval.mjs`, which this repo
 * does not have. Pure, dependency-free.
 */

/**
 * Glob → RegExp for repo-relative POSIX paths. `**` spans directories, `*` stays inside one segment.
 * @param {string} glob
 * @returns {RegExp}
 */
export function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*" && glob[i + 1] === "*") {
      re += glob[i + 2] === "/" ? "(?:.*/)?" : ".*";
      i += glob[i + 2] === "/" ? 2 : 1;
    } else if (c === "*") re += "[^/]*";
    else if (c === "?") re += "[^/]";
    else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}

/**
 * Flat `key: value` pairs from a Markdown file's YAML front matter (comments stripped).
 * @param {string} text
 * @returns {Record<string, string>}
 */
export function frontmatter(text) {
  const m = /^---\n([\s\S]*?)\n---/.exec(text);
  /** @type {Record<string, string>} */
  const out = {};
  if (!m) return out;
  for (const line of m[1].split("\n")) {
    const kv = /^([A-Za-z_][\w-]*):\s*(.*?)\s*(?:#.*)?$/.exec(line);
    if (kv) out[kv[1]] = kv[2].replace(/^["']|["']$/g, "");
  }
  return out;
}
