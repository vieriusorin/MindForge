#!/usr/bin/env node
/**
 * MF-0046: `pnpm gate:workspace`, a static check of `pnpm-workspace.yaml`.
 * pnpm writes a placeholder (`esbuild: set this to true or false`) into `allowBuilds`; merge 71ac090 committed one,
 * and only `pnpm install --frozen-lockfile` (CI) fails on it, so CI was red at Install for 13 runs (MF-0019 retro).
 * Fails on that placeholder anywhere in the file, and on any `allowBuilds` value that is not literally `true` or
 * `false`. CI runs it before Install, so it imports `node:` modules only (no `yaml` package).
 *
 * Fails closed by an allowlist of line shapes (verification.md §4; MF-0046 review rounds 1-3 found 15 YAML forms that
 * reach `allowBuilds` past a blocklist: anchors, tags, flow maps, explicit and escaped keys, merges). Every
 * significant line must be one of:
 *   - a comment or blank line;
 *   - a column-0 bare key, with no value (a block) or a plain value: `packages:`, `nodeLinker: isolated`;
 *   - the `allowBuilds:` header (bare or quoted), then entries `  name: true|false` at one indent;
 *   - under any other key, one level of `  - item` or `  name: value` (plain or quoted, no escapes).
 * Anything else is a problem, so a legitimate but richer file fails with a named line: widen the grammar then.
 * A green gate does not mean pnpm parses the whole file (e.g. a duplicate key inside a nested map); CI's Install does.
 * `MF_WORKSPACE_FILE` overrides the path (tests). Exit 1 on any problem.
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FILE = process.env.MF_WORKSPACE_FILE
  ? resolve(process.env.MF_WORKSPACE_FILE)
  : join(ROOT, "pnpm-workspace.yaml");

const PLACEHOLDER = /set this to true or false/i;
const COMMENT = String.raw`(?:[ \t]+#.*)?[ \t]*`;
/** A plain scalar with no YAML indicator: no spaces, quotes, flow brackets, anchors, tags or comment. */
const PLAIN = String.raw`[A-Za-z0-9_./^~=<>+-](?:[^\s#'"{}\[\],&*!|:]|:(?=\S))*`;
/** A scalar we read exactly: plain, single-quoted without `''`, or double-quoted without escapes. */
const SCALAR = String.raw`(?:${PLAIN}|'[^']*'|"[^"\\]*")`;
const NAME = String.raw`(?:[A-Za-z0-9_][\w./-]*|'[^']+'|"[^"\\]+")`;

const SKIPPABLE = /^[ \t]*(?:#.*)?$/;
const HEADER = /^(['"]?)allowBuilds\1[ \t]*:(.*)$/;
const TOP_KEY = new RegExp(
  String.raw`^([A-Za-z][\w-]*):(?:[ \t]+(${SCALAR}))?${COMMENT}$`,
);
const NESTED = new RegExp(
  String.raw`^ +(?:-[ \t]+${SCALAR}|${NAME}:[ \t]+${SCALAR})${COMMENT}$`,
);
/** One allowBuilds entry: indent, a bare or quoted name, then the rest after the colon. */
const ENTRY = /^( +)(?:'([^']+)'|"([^"\\]+)"|([\w./-][\w@./-]*)):(.*)$/;
/** After an entry colon: an optional value, then an optional comment, which YAML starts only after whitespace. */
const ENTRY_REST = /^(?:[ \t]+(.*?))?(?:[ \t]+#.*)?$/;
const HEADER_REST = new RegExp(`^${COMMENT}$`);

/**
 * @param {string} text
 * @returns {{ problems: string[]; entries: number }}
 */
function checkWorkspace(text) {
  /** @type {string[]} */
  const problems = [];
  const unmarked = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const lines = unmarked.replace(/\r\n/g, "\n").split("\n");
  const at = (/** @type {number} */ i) => `${FILE}:${i + 1}`;
  const unreadable = (/** @type {number} */ i) =>
    problems.push(
      `${at(i)}: cannot read "${lines[i].trim()}" (gate:workspace reads only block maps and one-level lists/maps of plain or quoted scalars)`,
    );

  /** @type {Set<string>} */
  const topKeys = new Set();
  /** "none" before any key, "other" under a key, "allowBuilds" inside its block, "closed" after a key with a value. */
  let section = "none";
  /** @type {string | undefined} */
  let indent;
  /** @type {Set<string>} */
  let names = new Set();
  let entries = 0;

  for (const [i, line] of lines.entries()) {
    if (PLACEHOLDER.test(line))
      problems.push(
        `${at(i)}: pnpm placeholder "set this to true or false": ${line.trim()}`,
      );
    if (SKIPPABLE.test(line)) continue;

    if (/^\S/.test(line)) {
      const header = HEADER.exec(line);
      const top = header ? null : TOP_KEY.exec(line);
      const key = header ? "allowBuilds" : top?.[1];
      if (key === undefined) {
        if (
          section === "allowBuilds" &&
          indent === undefined &&
          /^-(?:[ \t]|$)/.test(line)
        )
          problems.push(
            `${at(i)}: allowBuilds must be a map of name: true|false, found a list`,
          );
        else unreadable(i);
        section = "closed";
        continue;
      }
      if (topKeys.has(key))
        problems.push(
          `${at(i)}: ${key} appears twice at the top level; YAML rejects a duplicate key`,
        );
      topKeys.add(key);
      if (header) {
        if (!HEADER_REST.test(header[2]))
          problems.push(
            `${at(i)}: allowBuilds must be a block map (one "name: true|false" per line)`,
          );
        section = "allowBuilds";
        indent = undefined;
        names = new Set();
      } else section = top?.[2] === undefined ? "other" : "closed";
      continue;
    }

    if (section === "other") {
      if (!NESTED.test(line)) unreadable(i);
      continue;
    }
    if (section !== "allowBuilds") {
      unreadable(i);
      continue;
    }

    const entry = ENTRY.exec(line);
    const value = entry ? ENTRY_REST.exec(entry[5]) : null;
    indent ??= entry?.[1];
    if (!entry || !value || entry[1] !== indent) {
      problems.push(`${at(i)}: allowBuilds: cannot read line "${line.trim()}"`);
      continue;
    }
    entries++;
    const name = entry[2] ?? entry[3] ?? entry[4];
    if (names.has(name))
      problems.push(
        `${at(i)}: allowBuilds.${name} appears twice; YAML rejects a duplicate key`,
      );
    names.add(name);
    // Only space and tab: pnpm keeps any other trailing character (U+FEFF) in the value (review minor).
    const literal = (value[1] ?? "").replace(/[ \t]+$/, "");
    if (literal !== "true" && literal !== "false")
      problems.push(
        `${at(i)}: allowBuilds.${name}: value "${literal}" is not true or false`,
      );
  }
  return { problems, entries };
}

/** @type {string | null} */
let text = null;
try {
  text = readFileSync(FILE, "utf8");
} catch (error) {
  const code = /** @type {NodeJS.ErrnoException} */ (error).code ?? "error";
  console.error(`${FILE}: cannot read the workspace file (${code})`);
  console.log("gate:workspace: 1 problem(s)");
  process.exit(1);
}

const { problems, entries } = checkWorkspace(text);
if (problems.length > 0) {
  for (const p of problems) console.error(p);
  console.log(`gate:workspace: ${problems.length} problem(s)`);
  process.exit(1);
}
console.log(`gate:workspace: ${entries} allowBuilds entries, ok`);
