// MF-0043: which frozen test files would a plan's changed symbols break, that the plan does not list yet.
// The parsers are pure; `checkFrozenCollisions` is the read-only I/O shell over them.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { foreignFrozenPaths } from "./foreign-frozen.mjs";

/**
 * @typedef {{ path: string; line: number; symbol: string }} CollisionHit
 * @typedef {{ code: 0 | 1 | 2; hits: CollisionHit[]; message: string }} CollisionResult
 * @typedef {{ symbols: string[]; rejected: string[]; isNone: boolean }} SymbolList
 */

const SYMBOLS_HEADING = /^#{2,6}\s+Symbols changed\b/i;
const REFREEZE_HEADING = /^#{2,6}\s+Frozen files this will re-freeze\b/i;
const REFREEZE_BULLET = /^[-*]\s+Frozen files this will re-freeze\b/i;
// A name, optionally written as one call, a member, or an index by `number`, a digit or a quoted literal:
// `f(q)`, `A.b`, `X[number]`. A generic (`Promise<PackContent>`) or a name-index (`MAP[Key]`) is not taken: its
// outer name alone would hide the inner one (MF-0043 re-review), so it is rejected and the author names the type.
const NAME_FORM =
  /^([A-Za-z_$][\w$]*)(?:\([^()]*\)|(?:\.[\w$]+)+|\[(?:number|\d+|"[^"]*"|'[^']*')\])?$/;
// A closed-set member that is not a JS name: `not-in-pack`.
const HYPHENATED_LITERAL = /^[\w$]+(?:-[\w$]+)+$/;
const NONE = /^\s*(?:[-*]\s+)?none\b/i;
const ACCEPTANCE_FILE = /\.acceptance\.test\.[cm]?[jt]sx?$/;
const SKIPPED_DIRS = new Set(["node_modules", ".next"]);

/** @param {string} text */
const lf = (text) => text.replace(/\r\n/g, "\n");

/** @param {string} text @returns {string[]} */
const backticked = (text) =>
  [...text.matchAll(/`([^`\n]+)`/g)].map((m) => m[1] ?? "");

/** @param {string} line @returns {number} heading level, 0 for a non-heading */
const headingLevel = (line) => line.match(/^(#{1,6})\s/)?.[1]?.length ?? 0;

/**
 * Lines of the section a heading opens, up to (not including) its end. `keepSubheadings`: the section ends at the
 * next heading of the same or a higher level, so `### Functions` under `## Symbols changed` stays inside it
 * (MF-0043 review B2), and the other known section's heading ends it at any level (MF-0032 put
 * `### Frozen files this will re-freeze` under `##`). Otherwise it ends at the next heading of any level: a
 * re-freeze section read too wide would count a path as listed and hide a collision (MF-0043 re-review).
 * @param {{ lines: string[]; start: number; keepSubheadings: boolean }} input
 */
function headingSection({ lines, start, keepSubheadings }) {
  const level = headingLevel(lines[start] ?? "");
  const end = lines.findIndex((l, i) => {
    const next = headingLevel(l);
    if (i <= start || next === 0) return false;
    if (!keepSubheadings) return true;
    return next <= level || SYMBOLS_HEADING.test(l) || REFREEZE_HEADING.test(l);
  });
  return lines.slice(start + 1, end === -1 ? undefined : end);
}

/**
 * The name a backticked token stands for, or null when it cannot be matched as a whole word.
 * @param {string} token
 * @returns {string | null}
 */
function symbolOf(token) {
  const bare = token.trim().replace(/^(["'])(.*)\1$/, "$2");
  const name = bare.match(NAME_FORM)?.[1];
  if (name) return name;
  return HYPHENATED_LITERAL.test(bare) ? bare : null;
}

/**
 * What `## Symbols changed` lists. Every backticked token is a changed name (MF-0043 review B1): a token that
 * cannot be matched is `rejected`, never dropped. `isNone` when the section opens with "None".
 * @param {string} planText
 * @returns {SymbolList | null} null when the heading is absent
 */
export function parseSymbols(planText) {
  const lines = lf(planText).split("\n");
  const start = lines.findIndex((l) => SYMBOLS_HEADING.test(l));
  if (start === -1) return null;
  const section = headingSection({ lines, start, keepSubheadings: true });
  const firstText =
    section.find((l) => l.trim() !== "" && headingLevel(l) === 0) ?? "";
  /** @type {string[]} */
  const symbols = [];
  /** @type {string[]} */
  const rejected = [];
  for (const token of backticked(section.join("\n"))) {
    const symbol = symbolOf(token);
    const into = symbol === null ? rejected : symbols;
    const value = symbol ?? token;
    if (!into.includes(value)) into.push(value);
  }
  return { symbols, rejected, isNone: NONE.test(firstText) };
}

/**
 * Paths named in every "Frozen files this will re-freeze" section, `:line` suffix stripped.
 * A heading opens a section that runs to the next heading; a bullet starting with the phrase opens one
 * that runs over its indented continuation lines (MF-0033 / MF-0037 style).
 * @param {string} planText
 * @returns {string[]}
 */
export function parseListedPaths(planText) {
  const lines = lf(planText).split("\n");
  /** @type {string[]} */
  const sectionLines = [];
  lines.forEach((line, i) => {
    if (REFREEZE_HEADING.test(line)) {
      sectionLines.push(
        ...headingSection({ lines, start: i, keepSubheadings: false }),
      );
      return;
    }
    if (!REFREEZE_BULLET.test(line)) return;
    sectionLines.push(line);
    for (const next of lines.slice(i + 1)) {
      if (!/^\s+\S/.test(next)) break;
      sectionLines.push(next);
    }
  });
  const paths = backticked(sectionLines.join("\n"))
    .map((t) => t.replace(/:\d+(?:-\d+)?$/, ""))
    .filter((t) => t.includes("/"));
  return [...new Set(paths)];
}

/**
 * Ticket ids in the GOAL.md front matter `builds_on: [A, B]`.
 * @param {string} goalText
 * @returns {string[]}
 */
export function parseBuildsOn(goalText) {
  const list = lf(goalText).match(/^builds_on:\s*\[([^\]]*)\]/m)?.[1] ?? "";
  return list
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** @param {string} name */
const escapeRegExp = (name) => name.replace(/[$]/g, "\\$");

/**
 * Every line that uses one of the symbols as a whole word (`$` and `_` count as word characters; for a
 * hyphenated literal `-` does too, so `not-in-pack` is not found inside `x-not-in-pack`).
 * @param {{ files: { path: string; content: string }[]; symbols: string[] }} input
 * @returns {CollisionHit[]} sorted by path, then line, then symbol
 */
export function findHits({ files, symbols }) {
  const patterns = symbols.map((symbol) => {
    const word = symbol.includes("-") ? "[\\w$-]" : "[\\w$]";
    return {
      symbol,
      re: new RegExp(`(?<!${word})${escapeRegExp(symbol)}(?!${word})`),
    };
  });
  /** @type {CollisionHit[]} */
  const hits = [];
  for (const file of files) {
    lf(file.content)
      .split("\n")
      .forEach((text, i) => {
        for (const { symbol, re } of patterns) {
          if (re.test(text))
            hits.push({ path: file.path, line: i + 1, symbol });
        }
      });
  }
  return hits.sort(
    (a, b) =>
      a.path.localeCompare(b.path) ||
      a.line - b.line ||
      a.symbol.localeCompare(b.symbol),
  );
}

/** @param {string} root @returns {string[]} repo-relative, forward slashes */
function acceptanceFiles(root) {
  /** @type {string[]} */
  const found = [];
  /** @param {string} dir */
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || SKIPPED_DIRS.has(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (ACCEPTANCE_FILE.test(entry.name))
        found.push(relative(root, full).split(sep).join("/"));
    }
  };
  walk(root);
  return found;
}

/**
 * Paths in a ticket's FROZEN.json; a missing or unreadable manifest gives none (as foreign-frozen.mjs).
 * @param {string} root @param {string} ticket
 * @returns {string[]}
 */
function frozenPaths(root, ticket) {
  const manifest = join(root, ".planning", "tasks", ticket, "FROZEN.json");
  if (!existsSync(manifest)) return [];
  try {
    const { files } = JSON.parse(readFileSync(manifest, "utf8"));
    return (Array.isArray(files) ? files : [])
      .map((f) => f?.path)
      .filter((p) => typeof p === "string");
  } catch {
    return [];
  }
}

/**
 * Read-only. Code 2 for a missing ticket folder, LOOP-PLAN.md or `## Symbols changed` heading, for a token in that
 * section it cannot match, or for a section that names nothing and does not say "None."; 1 when a frozen file uses
 * a changed symbol and the plan's re-freeze section does not name it; 0 otherwise.
 * @param {{ root: string; ticket: string }} input
 * @returns {CollisionResult}
 */
export function checkFrozenCollisions({ root, ticket }) {
  const taskDir = `.planning/tasks/${ticket}`;
  if (!existsSync(join(root, taskDir)))
    return { code: 2, hits: [], message: `${taskDir}: no such ticket folder` };
  const planPath = `${taskDir}/LOOP-PLAN.md`;
  if (!existsSync(join(root, planPath)))
    return { code: 2, hits: [], message: `${planPath}: not found` };
  const planText = readFileSync(join(root, planPath), "utf8");
  const list = parseSymbols(planText);
  if (list === null)
    return {
      code: 2,
      hits: [],
      message: `${planPath}: no "## Symbols changed" heading (list the changed names, or write "None.")`,
    };
  if (list.rejected.length > 0)
    return {
      code: 2,
      hits: [],
      message: `${planPath}: Symbols changed lists ${list.rejected.map((t) => `\`${t}\``).join(", ")}, which cannot be matched as a name (write \`name\`, \`name(…)\`, \`Type.member\` or a hyphenated literal; for a generic like \`Promise<PackContent>\` list \`PackContent\`; grep anything else by hand and drop its backticks)`,
    };
  const { symbols } = list;
  if (symbols.length === 0)
    return list.isNone
      ? { code: 0, hits: [], message: "Symbols changed says None." }
      : {
          code: 2,
          hits: [],
          message: `${planPath}: Symbols changed names nothing in backticks and does not say "None."`,
        };

  const goalPath = join(root, taskDir, "GOAL.md");
  const buildsOn = existsSync(goalPath)
    ? parseBuildsOn(readFileSync(goalPath, "utf8"))
    : [];
  // Skip the ticket's own frozen files, but not a foreign file it re-froze into its manifest (MF-0021 holds
  // MF-0011's heatmap test): another ticket's FROZEN.json still owns that one.
  const foreign = new Set(
    foreignFrozenPaths(join(root, ".planning", "tasks"), ticket),
  );
  const own = new Set(
    frozenPaths(root, ticket).filter((path) => !foreign.has(path)),
  );
  const ownPrefix = `mf-${ticket.replace(/^\D+-?/, "")}-`.toLowerCase();
  const listed = new Set(parseListedPaths(planText));
  const scan = new Set([
    ...acceptanceFiles(root),
    ...buildsOn.flatMap((id) => frozenPaths(root, id)),
  ]);
  const files = [...scan]
    .filter((path) => !own.has(path) && !listed.has(path))
    .filter(
      (path) =>
        !(path.split("/").pop() ?? "").toLowerCase().startsWith(ownPrefix),
    )
    .filter((path) => existsSync(join(root, path)))
    .map((path) => ({ path, content: readFileSync(join(root, path), "utf8") }));
  const hits = findHits({ files, symbols });
  return hits.length > 0
    ? {
        code: 1,
        hits,
        message: `${hits.length} line(s) in ${new Set(hits.map((h) => h.path)).size} frozen file(s) use a changed symbol and are not listed under "Frozen files this will re-freeze"`,
      }
    : {
        code: 0,
        hits: [],
        message: `no unlisted collisions for ${symbols.join(", ")} across ${files.length} file(s)`,
      };
}
