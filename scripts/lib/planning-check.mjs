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
