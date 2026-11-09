/**
 * MF-0049: the pure half of `pnpm check:goal-proofs <ID>`. A Success Criterion's `Proof:` must name things that exist
 * (MF-0024: SC-3 named a frozen file that never existed, found only at review). Fails closed (verification.md §4):
 * a record it cannot read, or an SC without a `Proof:`, is a problem. It does not judge whether a proof COVERS its SC.
 * Grammar: .planning/tasks/MF-0049/LOOP-PLAN.md `## Parsers`.
 */

const SC_SECTION = /^## Success Criteria\b/;
const SC_START = /^- \[[ xX]\] (?:\*\*)?(SC-\d+)\b/;
const PATH_ROOT = /^(?:src|scripts|supabase|packs|e2e)\//;
const NOT_A_PATH = /[\s<>*{}]/;
const PNPM = /^pnpm (?:run )?([a-z][\w:-]*)/;
/** pnpm commands that are not package.json scripts but are valid proofs (`pnpm vitest` runs the installed bin). */
const PNPM_BUILTINS = new Set(["exec", "dlx", "install", "vitest"]);

/**
 * The SC blocks of a GOAL.md's `## Success Criteria…` section. A block runs from its `- [ ] SC-n` line through
 * indented and blank lines, to the next SC, a column-0 line, or the next heading.
 * @param {string} goalText
 * @returns {{ id: string; text: string }[]}
 */
export function successCriteriaBlocks(goalText) {
  /** @type {{ id: string; text: string }[]} */
  const blocks = [];
  let inSection = false;
  /** @type {{ id: string; text: string } | null} */
  let current = null;
  for (const line of goalText.replace(/\r\n/g, "\n").split("\n")) {
    if (/^## /.test(line)) {
      inSection = SC_SECTION.test(line);
      current = null;
      continue;
    }
    if (!inSection) continue;
    const start = SC_START.exec(line);
    if (start) {
      current = { id: start[1], text: line };
      blocks.push(current);
    } else if (current && (line.trim() === "" || /^\s/.test(line))) {
      current.text += `\n${line}`;
    } else {
      current = null;
    }
  }
  return blocks;
}

/**
 * The text after the last `Proof:` that is not inside a backtick span, or null when there is none.
 * @param {string} text
 * @returns {string | null}
 */
export function proofPart(text) {
  const masked = text.replace(/`[^`]*`/g, (span) => " ".repeat(span.length));
  const at = masked.lastIndexOf("Proof:");
  return at < 0 ? null : text.slice(at + "Proof:".length);
}

/**
 * @param {string | null} frozenText
 * @returns {{ paths: string[]; problems: string[] }}
 */
function frozenPaths(frozenText) {
  if (frozenText === null) return { paths: [], problems: [] };
  /** @type {unknown} */
  let json;
  try {
    json = JSON.parse(frozenText);
  } catch {
    return { paths: [], problems: ["FROZEN.json is not valid JSON"] };
  }
  const files = /** @type {{ files?: unknown }} */ (json)?.files;
  if (!Array.isArray(files))
    return { paths: [], problems: ["FROZEN.json files is not an array"] };
  /** @type {string[]} */
  const paths = [];
  /** @type {string[]} */
  const problems = [];
  for (const [i, file] of files.entries()) {
    const path = /** @type {{ path?: unknown }} */ (file)?.path;
    if (typeof path === "string" && path !== "") paths.push(path);
    else problems.push(`FROZEN.json files[${i}] has no path`);
  }
  return { paths, problems };
}

/**
 * Problems with one ticket's proof references; empty means every proof resolves.
 * @param {{
 *   goalText: string | null;
 *   planText: string | null;
 *   verifyText: string | null;
 *   frozenText: string | null;
 *   scripts: Set<string>;
 *   exists: (repoPath: string) => boolean;
 *   isTrackedBasename: (name: string) => boolean;
 * }} input
 * @returns {{ problems: string[] }}
 */
export function checkGoalProofs({
  goalText,
  planText,
  verifyText,
  frozenText,
  scripts,
  exists,
  isTrackedBasename,
}) {
  if (goalText === null) return { problems: ["cannot read GOAL.md"] };
  /** @type {string[]} */
  const problems = [];
  // A bullet naming an SC in another shape is a problem, so a GOAL in an older format never reads as "no SC" alone.
  let inSection = false;
  for (const line of goalText.replace(/\r\n/g, "\n").split("\n")) {
    if (/^## /.test(line)) inSection = SC_SECTION.test(line);
    else if (
      inSection &&
      /^- (?:\[[^\]]*\] ?)?\**SC-\d+/.test(line) &&
      !SC_START.test(line)
    )
      problems.push(
        `cannot read SC line (expected \`- [ ] SC-n: …\`): ${line.trim()}`,
      );
  }
  const blocks = successCriteriaBlocks(goalText);
  if (blocks.length === 0) problems.push("no Success Criteria found");
  const seen = new Set();
  for (const { id, text } of blocks) {
    if (seen.has(id)) {
      problems.push(`${id} appears twice`);
      continue;
    }
    seen.add(id);
    const proof = proofPart(text);
    if (proof === null) {
      problems.push(`${id} has no Proof:`);
      continue;
    }
    for (const match of proof.matchAll(/`([^`]+)`/g)) {
      const token = match[1].trim();
      const pnpm = PNPM.exec(token);
      if (pnpm) {
        if (!scripts.has(pnpm[1]) && !PNPM_BUILTINS.has(pnpm[1]))
          problems.push(
            `${id}: proof command pnpm ${pnpm[1]} is not a package.json script`,
          );
        continue;
      }
      if (NOT_A_PATH.test(token)) continue;
      const path = token.replace(/:\d+$/, "");
      if (PATH_ROOT.test(path)) {
        if (!exists(path))
          problems.push(`${id}: proof path ${path} does not exist`);
      } else if (!path.includes("/") && /\.test\.tsx?$/.test(path)) {
        if (!isTrackedBasename(path))
          problems.push(
            `${id}: proof test file ${path} is not in git ls-files`,
          );
      }
    }
  }

  const frozen = frozenPaths(frozenText);
  problems.push(...frozen.problems);
  const records = [goalText, planText ?? "", verifyText ?? ""].join("\n");
  for (const path of frozen.paths) {
    const base = path.split("/").pop() ?? path;
    if (!records.includes(path) && !records.includes(base))
      problems.push(
        `frozen file ${path} is named in no record (GOAL.md, LOOP-PLAN.md, LOOP-VERIFY.md)`,
      );
  }
  return { problems };
}
