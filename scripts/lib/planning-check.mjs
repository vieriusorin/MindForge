/**
 * MF-0028: the decision behind `pnpm gate:planning`. Pure: the CLI (`scripts/check-planning.mjs`)
 * reads `.planning/tasks/` and passes each folder's GOAL.md text in.
 */

/**
 * @typedef {{ dir: string, goalText: string | null }} TaskEntry
 *   `dir` is the folder name under `.planning/tasks/`; `goalText` is its GOAL.md, or null when absent.
 */

// Column 0 anywhere in the file, not only the front matter: a concatenating merge puts the second
// ticket's front matter in the body, which is the case this check exists for.
const TICKET_ID_LINE = /^ticket_id:(.*)$/gm;

// MF-0028 C-3: merge 71ac090 kept ONE `ticket_id:` line and the second ticket's other keys, so a
// repeated key is the signal that survives. Keys every GOAL.md carries exactly once (probe of 49
// GOALs, 2026-11-05); `last_iteration` is left out because five GOALs omit it.
const SINGLE_KEYS = ["tier", "stage", "goal_status"];

/** @param {string} raw the text after `ticket_id:` */
function ticketIdValue(raw) {
  return raw
    .replace(/\s+#.*$/, "")
    .trim()
    .replace(/^(["'])(.*)\1$/, "$2");
}

/**
 * What is wrong with one GOAL.md, or null. Several findings join into one line.
 * @param {string} dir
 * @param {string} goalText
 * @returns {string | null}
 */
function goalProblem(dir, goalText) {
  const text = goalText.replace(/\r\n/g, "\n");
  const ids = [...text.matchAll(TICKET_ID_LINE)].map((m) =>
    ticketIdValue(m[1]),
  );
  if (ids.length === 0) return `${dir}: no ticket_id line`;

  const findings = [];
  if (ids.length > 1)
    findings.push(`${ids.length} ticket_id lines (${ids.join(", ")})`);
  else if (ids[0] !== dir)
    findings.push(`ticket_id ${ids[0]} is not the folder name`);
  const repeated = SINGLE_KEYS.filter(
    (key) => (text.match(new RegExp(`^${key}:`, "gm")) ?? []).length > 1,
  );
  if (repeated.length > 0)
    findings.push(`${repeated.join(", ")} repeated at column 0`);
  if (findings.length === 0) return null;
  const merged =
    ids.length > 1 || repeated.length > 0
      ? ", likely two tickets merged into one GOAL.md"
      : "";
  return `${dir}: ${findings.join("; ")}${merged}`;
}

/**
 * One line per bad folder, each starting with `<dir>: `. Empty when every GOAL.md names exactly
 * one ticket, it is its own folder, and no front-matter key repeats. A folder with no GOAL.md
 * passes (a Stage 0 claim).
 * @param {readonly TaskEntry[]} entries
 * @returns {string[]}
 */
export function checkPlanning(entries) {
  return entries.flatMap(({ dir, goalText }) => {
    if (goalText === null) return [];
    const problem = goalProblem(dir, goalText);
    return problem === null ? [] : [problem];
  });
}

// MF-0053: shipped tickets before this one skipped the preflight line (39 of 39 past DESIGN, probe
// 2026-11-05); the rule governs tickets picked up after it, not history.
const PREFLIGHT_CUTOFF = "MF-0052";
const PAST_DESIGN = new Set(["plan", "build", "test", "handoff", "watch"]);
const PREFLIGHT_LINE = /design preflight/i;
const PNPM_SCRIPT = /pnpm (?:run )?([a-z][\w:-]*)/g;

/** @param {string} text @param {string} key */
function frontValue(text, key) {
  const match = text.match(new RegExp(`^${key}:[ \\t]*([^\\s#]+)`, "m"));
  return match ? match[1] : null;
}

/** The body of `## <name>` up to the next `## ` heading, or "" when absent. */
function sectionBody(text, name) {
  const section = text
    .split(/^## /m)
    .find(
      (part) => part.startsWith(`${name}\n`) || part.startsWith(`${name} `),
    );
  return section ?? "";
}

// Whole-name: `pnpm test` must not count as a mention of `pnpm test:db`, nor the reverse.
/** @param {string} line @param {string} script */
function mentions(line, script) {
  const escaped = script.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`pnpm (?:run )?${escaped}(?![\\w:-])`).test(line);
}

/**
 * MF-0053: one line per GOAL past DESIGN (and after MF-0052, not `reserved`) whose Success Criteria
 * name a `pnpm <script>` that no Iteration Log "design preflight" line mentions, or that has no such
 * line at all. `scriptNames` are the keys of package.json `scripts`; other `pnpm <x>` are ignored.
 * @param {readonly TaskEntry[]} entries
 * @param {readonly string[]} scriptNames
 * @returns {string[]}
 */
export function checkDesignPreflight(entries, scriptNames) {
  const known = new Set(scriptNames);
  return entries.flatMap(({ dir, goalText }) => {
    if (goalText === null || dir <= PREFLIGHT_CUTOFF) return [];
    const text = goalText.replace(/\r\n/g, "\n");
    const stage = frontValue(text, "stage");
    if (frontValue(text, "goal_status") === "reserved") return [];
    if (stage === null || !PAST_DESIGN.has(stage)) return [];

    const preflight = sectionBody(text, "Iteration Log")
      .split("\n")
      .filter((line) => PREFLIGHT_LINE.test(line));
    if (preflight.length === 0)
      return [
        `${dir}: stage ${stage} but no "design preflight" line in the Iteration Log`,
      ];

    const named = [
      ...new Set(
        [...sectionBody(text, "Success Criteria").matchAll(PNPM_SCRIPT)]
          .map((m) => m[1])
          .filter((name) => known.has(name)),
      ),
    ];
    const missing = named.filter(
      (script) => !preflight.some((line) => mentions(line, script)),
    );
    if (missing.length === 0) return [];
    const list = missing.map((script) => `pnpm ${script}`).join(", ");
    return [
      `${dir}: design preflight does not mention ${list}, named by an SC`,
    ];
  });
}

// MF-0055: hand-offs before this rule had no browser walkthrough for the user; it governs tickets
// picked up after MF-0054 (MF-0054 was in flight in another session when the rule landed).
const SEE_IT_CUTOFF = "MF-0054";
const SEE_IT_HEADING = /^## See it yourself\b/m;

/**
 * MF-0055: one line per ticket after MF-0054 at hand-off (`goal_status: complete-pending-manual-commit`)
 * whose `.planning/evidence/<ID>.md` is missing or has no `## See it yourself` section. The section
 * gives the user the URL, account and clicks to watch each SC work in the browser, or says
 * `n/a: <reason>` for a ticket with nothing on screen.
 * @param {readonly TaskEntry[]} entries
 * @param {(dir: string) => string | null} readEvidence the evidence text for a ticket, or null
 * @returns {string[]}
 */
export function checkSeeItYourself(entries, readEvidence) {
  return entries.flatMap(({ dir, goalText }) => {
    if (goalText === null || dir <= SEE_IT_CUTOFF) return [];
    const text = goalText.replace(/\r\n/g, "\n");
    if (frontValue(text, "goal_status") !== "complete-pending-manual-commit")
      return [];
    const evidence = readEvidence(dir);
    if (evidence === null)
      return [
        `${dir}: at hand-off but .planning/evidence/${dir}.md is missing`,
      ];
    if (SEE_IT_HEADING.test(evidence.replace(/\r\n/g, "\n"))) return [];
    return [
      `${dir}: evidence has no "## See it yourself" section (URL, account and clicks per SC, or "n/a: <reason>")`,
    ];
  });
}
