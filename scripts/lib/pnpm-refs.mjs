/**
 * MF-0051: the pure half of the check-hooks rule "a referenced pnpm script must exist". The retro Stop hook told
 * agents to run `pnpm ticket:retro`, which never existed (MF-0027). `scripts/check-hooks.mjs` does the file reads.
 */

/**
 * pnpm's own commands, plus `vitest` (an installed bin). Not package.json scripts, but valid after `pnpm`. Not the
 * same fact as `goal-proofs.mjs`'s set, which lists the commands that count as an SC proof (MF-0051 review).
 * @type {ReadonlySet<string>}
 */
export const PNPM_BUILTINS = new Set([
  "add",
  "audit",
  "bin",
  "catalog",
  "config",
  "create",
  "deploy",
  "dlx",
  "env",
  "exec",
  "fetch",
  "i",
  "import",
  "init",
  "install",
  "licenses",
  "link",
  "list",
  "ls",
  "outdated",
  "pack",
  "patch",
  "patch-commit",
  "prune",
  "publish",
  "rebuild",
  "remove",
  "rm",
  "root",
  "run",
  "self-update",
  "setup",
  "start",
  "store",
  "test",
  "uninstall",
  "unlink",
  "up",
  "update",
  "upgrade",
  "vitest",
  "why",
]);

/**
 * Which files the rule reads, and how: hooks and settings as code, agents, rules, skills and the root guides as
 * Markdown (code spans and fences only). Takes a `/`-separated path relative to the repo root.
 * @param {string} rel
 * @returns {{ markdown: boolean } | null}
 */
export function isPnpmRefFile(rel) {
  if (/^\.claude\/hooks\/.+\.mjs$/.test(rel)) return { markdown: false };
  if (rel === ".claude/settings.json") return { markdown: false };
  if (/^\.claude\/(agents|rules|skills)\/.+\.md$/.test(rel))
    return { markdown: true };
  if (rel === "CLAUDE.md" || rel === "AGENTS.md") return { markdown: true };
  return null;
}

const PNPM = /\bpnpm\s+(?:run\s+)?([a-z][\w:.-]*\*?)/g;
// Any indent: a fence inside a list item sits 4+ spaces in (MF-0051 review).
const FENCE = /^\s*(`{3,}|~{3,})/;
// Joins code spans so two of them never read as one command: `\s` does not match it.
const SPAN_GAP = "\u0000";

/**
 * The code a Markdown line holds: the whole line inside a fenced block, else its inline code spans. Prose is
 * dropped, so "pnpm doesn't hoist" in a third-party skill is not a reference. An unclosed fence runs to the end.
 * @param {string[]} lines
 * @returns {string[]}
 */
function markdownCode(lines) {
  /** @type {string | null} */
  let fence = null;
  return lines.map((line) => {
    const run = FENCE.exec(line)?.[1];
    if (fence === null) {
      if (run) {
        fence = run;
        return "";
      }
      return [...line.matchAll(/(`+)(.+?)\1(?!`)/g)]
        .map((m) => m[2])
        .join(SPAN_GAP);
    }
    const closes =
      run &&
      run[0] === fence[0] &&
      run.length >= fence.length &&
      line.trim() === run;
    if (closes) fence = null;
    return closes ? "" : line;
  });
}

/**
 * A script, a built-in, or a `<prefix>:*` family with at least one script under that prefix (`pnpm gate:*`).
 * @param {string} name
 * @param {ReadonlySet<string>} scripts
 * @returns {boolean}
 */
function isKnown(name, scripts) {
  if (name.endsWith(":*")) {
    const prefix = name.slice(0, -1);
    return [...scripts].some((s) => s.startsWith(prefix));
  }
  return scripts.has(name) || PNPM_BUILTINS.has(name);
}

/**
 * Every `pnpm <name>` / `pnpm run <name>` whose name is neither a package.json script nor a pnpm built-in.
 * Trailing `.` / `:` is punctuation, not part of the name. Placeholders (`pnpm <script>`) and flags are not names.
 * @param {{ text: string, markdown: boolean, scripts: ReadonlySet<string> }} input
 * @returns {{ line: number, name: string }[]}
 */
export function unknownPnpmRefs({ text, markdown, scripts }) {
  const raw = text.split(/\r?\n/);
  const lines = markdown ? markdownCode(raw) : raw;
  return lines.flatMap((line, i) =>
    [...line.matchAll(PNPM)]
      .map((m) => (m[1].endsWith(":*") ? m[1] : m[1].replace(/[.:]+$/, "")))
      .filter((name) => !isKnown(name, scripts))
      .map((name) => ({ line: i + 1, name })),
  );
}
