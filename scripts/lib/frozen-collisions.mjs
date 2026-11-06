// MF-0043: which frozen acceptance files does a ticket's change reach that its plan has not listed?
// Pure: the CLI (`scripts/frozen-collisions.mjs`) reads the files and passes their text in.

/**
 * @typedef {{ path: string, text: string }} SourceFile
 * @typedef {{ kind: "function" | "name" | "literal", name: string }} ChangedSymbol
 * @typedef {{ code: 0 | 1 | 2, hits: string[], message: string }} CollisionResult
 */

const SYMBOLS_HEADING = "symbols changed";
const REFREEZE_HEADING = "frozen files this will re-freeze";
const BULLET = /^-\s+(function|name|literal)\s+`([^`]+)`/;
const LINE_SUFFIX = /:\d+(?:-\d+)?$/;

/** @param {string} s */
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Bodies of every section whose heading text starts with `prefix` (case-insensitive), each running to the
 * next heading of the same or a higher level.
 * @param {string} text
 * @param {string} prefix lower-case
 * @returns {string[][]} lines per section
 */
function sections(text, prefix) {
  /** @type {string[][]} */
  const found = [];
  /** @type {{ level: number, lines: string[] } | null} */
  let open = null;
  for (const line of text.split("\n")) {
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      if (open && level <= open.level) {
        found.push(open.lines);
        open = null;
      }
      if (!open && heading[2].trim().toLowerCase().startsWith(prefix)) {
        open = { level, lines: [] };
      }
      continue;
    }
    open?.lines.push(line);
  }
  if (open) found.push(open.lines);
  return found;
}

/**
 * @param {string[]} texts
 * @returns {{ ok: true, symbols: ChangedSymbol[] } | { ok: false, message: string }}
 */
function parseSymbols(texts) {
  const bodies = texts.flatMap((t) => sections(t, SYMBOLS_HEADING));
  if (bodies.length === 0) {
    return {
      ok: false,
      message: "no `## Symbols changed` section in GOAL.md or LOOP-PLAN.md",
    };
  }
  /** @type {ChangedSymbol[]} */
  const symbols = [];
  let isNone = false;
  for (const line of bodies.flat()) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("- ")) continue;
    if (trimmed === "- none") {
      isNone = true;
      continue;
    }
    const match = BULLET.exec(trimmed);
    if (!match) {
      return {
        ok: false,
        message: `cannot parse "${trimmed}" (expected - function|name|literal \`<name>\`, or - none)`,
      };
    }
    symbols.push({
      kind: /** @type {ChangedSymbol["kind"]} */ (match[1]),
      name: match[2],
    });
  }
  if (symbols.length === 0 && !isNone) {
    return {
      ok: false,
      message:
        "`## Symbols changed` is empty; list the symbols or write `- none`",
    };
  }
  return { ok: true, symbols };
}

/**
 * @param {string[]} texts
 * @returns {Set<string>}
 */
function listedPaths(texts) {
  const listed = new Set();
  for (const line of texts
    .flatMap((t) => sections(t, REFREEZE_HEADING))
    .flat()) {
    for (const m of line.matchAll(/`([^`]+)`/g)) {
      listed.add(m[1].trim().replace(LINE_SUFFIX, ""));
    }
  }
  return listed;
}

/**
 * @param {ChangedSymbol} symbol
 * @returns {(line: string, isImport: boolean) => boolean}
 */
function matcher(symbol) {
  if (symbol.kind === "literal") return (line) => line.includes(symbol.name);
  const word = new RegExp(`\\b${escapeRegExp(symbol.name)}\\b`);
  if (symbol.kind === "name") return (line) => word.test(line);
  const call = new RegExp(`\\b${escapeRegExp(symbol.name)}\\(`);
  return (line, isImport) => call.test(line) || (isImport && word.test(line));
}

/**
 * 1-based line numbers of `text` where any matcher fires. Import context covers a whole
 * `import … from "…"` statement, including the specifier lines of a multi-line one.
 * @param {string} text
 * @param {((line: string, isImport: boolean) => boolean)[]} matchers
 * @returns {number[]}
 */
function hitLines(text, matchers) {
  /** @type {number[]} */
  const lines = [];
  let inImport = false;
  text.split("\n").forEach((line, index) => {
    if (/^\s*import\b/.test(line)) inImport = true;
    if (matchers.some((m) => m(line, inImport))) lines.push(index + 1);
    if (
      inImport &&
      (/\bfrom\s*["']/.test(line) || /^\s*import\s*["']/.test(line))
    ) {
      inImport = false;
    }
  });
  return lines;
}

/**
 * Exit 2 when the symbols list is missing or malformed, 1 when an unlisted frozen file uses a changed
 * symbol, 0 otherwise. `hits` are `path:line`, sorted by path then line. The ticket's own frozen files
 * (`ownFrozen`, and any file named `mf-<number>-*`) are skipped.
 * @param {{ ticket: string, goalText: string | null, planText: string | null, ownFrozen: string[], files: SourceFile[] }} input
 * @returns {CollisionResult}
 */
export function checkCollisions({
  ticket,
  goalText,
  planText,
  ownFrozen,
  files,
}) {
  const texts = [goalText, planText]
    .filter((t) => typeof t === "string")
    .map((t) => t.replace(/\r\n/g, "\n"));
  const parsed = parseSymbols(texts);
  if (!parsed.ok) {
    return {
      code: 2,
      hits: [],
      message: `ticket:collisions: ${ticket}: ${parsed.message}`,
    };
  }
  if (parsed.symbols.length === 0) {
    return {
      code: 0,
      hits: [],
      message: `ticket:collisions: ${ticket}: no symbols changed`,
    };
  }

  const listed = listedPaths(texts);
  const own = new Set(ownFrozen);
  const ownPrefix = `${ticket.toLowerCase()}-`;
  const scanned = files.filter((f) => {
    const base = f.path.split("/").pop() ?? f.path;
    return !own.has(f.path) && !base.startsWith(ownPrefix);
  });
  const matchers = parsed.symbols.map(matcher);
  const hits = scanned
    .filter((f) => !listed.has(f.path))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
    .flatMap((f) =>
      hitLines(f.text.replace(/\r\n/g, "\n"), matchers).map(
        (n) => `${f.path}:${n}`,
      ),
    );

  if (hits.length === 0) {
    return {
      code: 0,
      hits,
      message: `ticket:collisions: ${ticket}: no unlisted collisions (${scanned.length} frozen files scanned)`,
    };
  }
  const fileCount = new Set(hits.map((h) => h.replace(/:\d+$/, ""))).size;
  return {
    code: 1,
    hits,
    message: `ticket:collisions: ${ticket}: ${hits.length} unlisted hit(s) in ${fileCount} frozen file(s); list each file under "Frozen files this will re-freeze" with its new expected value, or change the plan`,
  };
}
