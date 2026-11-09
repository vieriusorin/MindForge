/**
 * MF-0028: the decision behind `pnpm gate:planning`. Pure: the CLI (`scripts/check-planning.mjs`)
 * reads `.planning/tasks/` and passes each folder's GOAL.md text in.
 */
import { NEVER_GLOBS, SCOPES } from "../../.claude/hooks/lib/agent-scopes.mjs";
import { globToRegExp } from "../../.claude/hooks/lib/util.mjs";
import {
  globsOverlap,
  PLAN_AGENTS,
  parsePlanTasks,
  validatePlan,
} from "./ticket-eval.mjs";

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
const HANDOFF = "complete-pending-manual-commit";
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
    if (frontValue(text, "goal_status") !== HANDOFF) return [];
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

// MF-0060: plans and hand-offs before this rule were never judged against SCOPES (214 lines over 31 shipped plans,
// probe 2026-11-06); both rules govern tickets picked up after it.
const OWNS_CUTOFF = "MF-0060";
const SCOPES_NOTE = "SCOPES in .claude/hooks/lib/agent-scopes.mjs";

/**
 * @typedef {TaskEntry & { planText?: string | null, frozenText?: string | null, retroText?: string | null }} PlanEntry
 *   `planText` is LOOP-PLAN.md, `frozenText` FROZEN.json, `retroText` RETRO.md; null or absent when the file is absent.
 */

/**
 * @typedef {{ kind: "anydir" | "any" | "segment" | "one" } | { kind: "char", char: string }} GlobToken
 * @typedef {Set<number | string>} NfaStates
 */

/**
 * A glob as the scope hook reads it (`.claude/hooks/lib/util.mjs`): `**` + `/` is `(?:.*\/)?`, `**` is `.*`, `*` is
 * `[^/]*`, `?` is `[^/]`, anything else one literal char.
 * @param {string} glob
 * @returns {GlobToken[]}
 */
function hookGlobTokens(glob) {
  /** @type {GlobToken[]} */
  const tokens = [];
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*" && glob[i + 1] === "*") {
      const dir = glob[i + 2] === "/";
      tokens.push({ kind: dir ? "anydir" : "any" });
      i += dir ? 2 : 1;
    } else if (c === "*") tokens.push({ kind: "segment" });
    else if (c === "?") tokens.push({ kind: "one" });
    else tokens.push({ kind: "char", char: c });
  }
  return tokens;
}

/**
 * NFA states: a number `i` is "before token i"; `"<i>*"` is inside the `.*` of the `anydir` token at i.
 * @param {GlobToken[]} tokens
 * @param {Iterable<number | string>} states
 * @returns {NfaStates}
 */
function closure(tokens, states) {
  const out = new Set(states);
  const stack = [...out];
  while (stack.length) {
    const s = stack.pop();
    if (typeof s !== "number") continue;
    const t = tokens[s];
    if (t && t.kind !== "char" && t.kind !== "one" && !out.has(s + 1)) {
      out.add(s + 1);
      stack.push(s + 1);
    }
  }
  return out;
}

/**
 * @param {GlobToken[]} tokens
 * @param {NfaStates} states
 * @param {string} c
 * @returns {NfaStates}
 */
function step(tokens, states, c) {
  /** @type {(number | string)[]} */
  const next = [];
  for (const s of states) {
    if (typeof s === "string") {
      next.push(s);
      if (c === "/") next.push(Number(s.slice(0, -1)) + 1);
      continue;
    }
    const t = tokens[s];
    if (!t) continue;
    if (t.kind === "char") {
      if (t.char === c) next.push(s + 1);
    } else if (t.kind === "one") {
      if (c !== "/") next.push(s + 1);
    } else if (t.kind === "segment") {
      if (c !== "/") next.push(s);
    } else if (t.kind === "any") next.push(s);
    else {
      next.push(`${s}*`);
      if (c === "/") next.push(s + 1);
    }
  }
  return closure(tokens, next);
}

/** @param {NfaStates} set */
const stateKey = (set) => [...set].map(String).sort().join(",");

/**
 * MF-0060: the shortest repo path (non-empty, no leading, trailing or doubled `/`) that `glob` matches and no glob in
 * `scopeGlobs` matches, or null when every path the glob can match is inside the scope. Exact: a breadth-first search
 * over the glob's NFA and the subset states of the scope globs, on every literal char, `/` and one "other" char.
 * @param {string} glob
 * @param {readonly string[]} scopeGlobs
 * @returns {string | null}
 */
export function globEscapesScope(glob, scopeGlobs) {
  const g = hookGlobTokens(glob);
  const scopes = scopeGlobs.map(hookGlobTokens);
  const literals = new Set(
    [g, ...scopes].flat().flatMap((t) => (t.kind === "char" ? [t.char] : [])),
  );
  // One char no glob names stands for every such char; prefer a readable one.
  const other = [..."xyzqjkw"].find((c) => !literals.has(c)) ?? "§";
  literals.delete("/");
  const alphabet = [other, "/", ...[...literals].sort()];

  /** @type {{ gs: NfaStates, ss: NfaStates[], path: string }[]} */
  const queue = [
    { gs: closure(g, [0]), ss: scopes.map((t) => closure(t, [0])), path: "" },
  ];
  const seen = new Set();
  for (let head = 0; head < queue.length; head++) {
    const { gs, ss, path } = queue[head];
    if (
      path !== "" &&
      !path.endsWith("/") &&
      gs.has(g.length) &&
      ss.every((set, k) => !set.has(scopes[k].length))
    )
      return path;
    for (const c of alphabet) {
      if (c === "/" && (path === "" || path.endsWith("/"))) continue;
      const ng = step(g, gs, c);
      if (ng.size === 0) continue;
      const ns = ss.map((set, k) => step(scopes[k], set, c));
      const key = `${c === "/"}|${stateKey(ng)}|${ns.map(stateKey).join(";")}`;
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push({ gs: ng, ss: ns, path: path + c });
    }
  }
  return null;
}

/**
 * `dir/{a,b}/x` alternatives, as MF-0048's `validatePlan` reads them; null when a set is nested or the expansion
 * passes 64 globs (validatePlan reports those).
 * @param {string} glob
 * @returns {string[] | null}
 */
function expandOwns(glob) {
  let depth = 0;
  for (const c of glob) {
    depth += c === "{" ? 1 : c === "}" ? -1 : 0;
    if (depth > 1) return null;
  }
  let globs = [glob];
  while (globs.some((g) => /\{[^{}]*\}/.test(g))) {
    globs = globs.flatMap((g) => {
      const m = /\{([^{}]*)\}/.exec(g);
      if (!m) return [g];
      return m[1]
        .split(",")
        .map(
          (alt) => g.slice(0, m.index) + alt + g.slice(m.index + m[0].length),
        );
    });
    if (globs.length > 64) return null;
  }
  return globs.some((g) => /[{}]/.test(g)) ? null : globs;
}

/**
 * MF-0060 rule 1 for one task graph, with no ticket filter: MF-0048's per-task lines from `validatePlan` (unknown
 * agent, empty or unreadable owns, NEVER), then one line per role-agent `owns` alternative that can reach a path outside
 * `SCOPES[agent]`. A glob that can match NEVER gets only its NEVER line.
 * @param {readonly unknown[]} tasks
 * @returns {string[]}
 */
export function planOwnsProblems(tasks) {
  /** @type {string[]} */
  const out = [];
  for (const raw of tasks) {
    const task =
      /** @type {{ id?: unknown, agent?: unknown, owns?: unknown }} */ (
        raw ?? {}
      );
    out.push(
      ...validatePlan(
        [{ id: task.id, agent: task.agent, owns: task.owns, depends_on: [] }],
        [],
      ),
    );
    const agent = task.agent;
    if (typeof agent !== "string" || !PLAN_AGENTS.includes(agent)) continue;
    if (!Array.isArray(task.owns)) continue;
    const scope = SCOPES[agent];
    for (const glob of task.owns) {
      if (typeof glob !== "string") continue;
      for (const one of expandOwns(glob) ?? []) {
        const folded = one.toLowerCase();
        if (NEVER_GLOBS.some((n) => globsOverlap(folded, n.toLowerCase())))
          continue;
        const witness = globEscapesScope(one, scope);
        if (witness === null) continue;
        out.push(
          `${String(task.id)}: ${agent} may not own ${one}: ${witness} is outside its scope (${scope.join(", ")}). Give it to a task whose agent's scope holds it, or to an "orchestrator" task (${SCOPES_NOTE})`,
        );
      }
    }
  }
  return out;
}

/**
 * MF-0060 rule 1: for each ticket after MF-0060, not reserved, at stage plan or later, the `planOwnsProblems` of its
 * LOOP-PLAN task block, each line prefixed `<dir>: `. At `plan` a missing plan or block is not yet a problem; from
 * `build` on it is one line.
 * @param {readonly PlanEntry[]} entries
 * @returns {string[]}
 */
export function checkPlanOwns(entries) {
  return entries.flatMap(({ dir, goalText, planText }) => {
    if (goalText === null || dir <= OWNS_CUTOFF) return [];
    const text = goalText.replace(/\r\n/g, "\n");
    if (frontValue(text, "goal_status") === "reserved") return [];
    const stage = frontValue(text, "stage");
    if (stage === null || !PAST_DESIGN.has(stage)) return [];
    const drafting = stage === "plan";
    if (planText === null || planText === undefined)
      return drafting ? [] : [`${dir}: stage ${stage} but no LOOP-PLAN.md`];
    const { tasks, errors } = parsePlanTasks(planText.replace(/\r\n/g, "\n"));
    if (errors.length > 0)
      return drafting
        ? []
        : errors.map((e) => `${dir}: stage ${stage} but ${e}`);
    return planOwnsProblems(tasks).map((p) => `${dir}: ${p}`);
  });
}

/**
 * The paths a ticket's own records exempt from rule 2: FROZEN.json `files[].path` (acceptance tests are written before
 * any task exists) and every backticked token in RETRO.md's `## Applied` section (retro edits to skills). An
 * unreadable record exempts nothing.
 * @param {string | null | undefined} frozenText
 * @param {string | null | undefined} retroText
 * @returns {string[]}
 */
function recordedPaths(frozenText, retroText) {
  /** @type {string[]} */
  const out = [];
  try {
    const files = JSON.parse(frozenText ?? "null")?.files;
    if (Array.isArray(files))
      for (const f of files) if (typeof f?.path === "string") out.push(f.path);
  } catch {
    // Unparseable FROZEN.json: no exemption (fail closed).
  }
  const applied = /^## Applied[ \t]*\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(
    (retroText ?? "").replace(/\r\n/g, "\n"),
  );
  if (applied)
    for (const m of applied[1].matchAll(/`([^`\s]+)`/g)) out.push(m[1]);
  return out;
}

/**
 * MF-0060 rule 2 for a set of tickets, with no ticket filter: the changed files that are not planning state,
 * `package.json`, a file the tickets froze or their retro applied, and that no `owns` glob of any of their tasks matches
 * (the scope hook's glob dialect, braces expanded). Order follows `changedFiles`.
 * @param {readonly string[]} changedFiles
 * @param {readonly { tasks: readonly unknown[], frozenText?: string | null, retroText?: string | null }[]} tickets
 * @returns {string[]}
 */
export function unownedChangedFiles(changedFiles, tickets) {
  const owned = tickets
    .flatMap(({ tasks }) => tasks)
    .flatMap((t) => {
      const owns = /** @type {{ owns?: unknown } | null | undefined} */ (t)
        ?.owns;
      return Array.isArray(owns) ? owns : [];
    })
    .flatMap((g) => (typeof g === "string" ? (expandOwns(g) ?? []) : []))
    .map(globToRegExp);
  const exempt = new Set(
    tickets.flatMap(({ frozenText, retroText }) =>
      recordedPaths(frozenText, retroText),
    ),
  );
  return changedFiles.filter(
    (f) =>
      !f.startsWith(".planning/") &&
      f !== "package.json" &&
      !exempt.has(f) &&
      !owned.some((re) => re.test(f)),
  );
}

const TICKET_FOLDER = /^\.planning\/tasks\/([^/]+)\//;

/**
 * MF-0060 rule 2: each ticket after MF-0060 at hand-off whose own `.planning/tasks/<dir>/` is in `changedFiles` gets
 * one line per `unownedChangedFiles` path. Owned = the `owns` of every folder after MF-0060 in the changed set;
 * exempt = the FROZEN.json and RETRO `## Applied` files of every folder in it. `changedFiles` null
 * means git could not say (no main ref): nothing is judged.
 * @param {readonly PlanEntry[]} entries
 * @param {readonly string[] | null} changedFiles
 * @returns {string[]}
 */
export function checkChangedFilesOwned(entries, changedFiles) {
  if (changedFiles === null) return [];
  const inSet = new Set(
    changedFiles.flatMap((f) => {
      const m = TICKET_FOLDER.exec(f);
      return m ? [m[1]] : [];
    }),
  );
  const present = entries.filter(({ dir }) => inSet.has(dir));
  const judged = present.filter(({ dir, goalText }) => {
    if (goalText === null || dir <= OWNS_CUTOFF) return false;
    return (
      frontValue(goalText.replace(/\r\n/g, "\n"), "goal_status") === HANDOFF
    );
  });
  if (judged.length === 0) return [];
  // Review 1: a grandfathered folder in the set (a re-freeze of its FROZEN.json) lends its exemptions, never its
  // `owns`, or any re-freeze would launder the files an old plan owned.
  const tickets = present.map(({ dir, planText, frozenText, retroText }) => ({
    tasks:
      dir > OWNS_CUTOFF
        ? parsePlanTasks((planText ?? "").replace(/\r\n/g, "\n")).tasks
        : [],
    frozenText,
    retroText,
  }));
  const unowned = unownedChangedFiles(changedFiles, tickets);
  return judged.flatMap(({ dir }) =>
    unowned.map(
      (file) =>
        `${dir}: ${file} is changed but in no task's owns. Add it to the owns of the task that wrote it in .planning/tasks/${dir}/LOOP-PLAN.md (an "orchestrator" task for a file no role agent may write)`,
    ),
  );
}

// MF-0069: shipped plans declared parsers in free prose or not at all (3 of 54 had a Parsers section, probe
// 2026-11-09); the rule governs tickets picked up after MF-0068, MF-0069's own plan first.
const PARSERS_CUTOFF = "MF-0068";
const JUDGED_STAGES = new Set(["build", "test", "handoff", "watch"]);
const PARSER_TREES = ["scripts/**", ".claude/hooks/**", "src/engine/**"];
const TESTS_SEGMENT = /(?:^|\/)__tests__\//;
const PARSERS_HINT = '(write "None: <reason>" or one ### block per parser)';
// A label opens its own line (optionally as a list item, optionally bold); a mention inside prose does not count.
const LABEL_LINE = /^\s*(?:[-*+]\s+|\d+\.\s+)?/;
const BLOCK_LABELS = [
  "Accepted grammar",
  "Rejected inputs",
  "Exempt-path test",
  "Cross-check",
];

/**
 * The first owned glob, in task order, that may cover a file in parser territory (scripts/, .claude/hooks/,
 * src/engine/), outside a `__tests__/` path segment. Braces expand as the gate's own dialect does, a leading `./` is
 * dropped, and a glob that cannot be expanded counts as in territory (MF-0069 review B-2: fail closed). Non-array
 * owns and non-string items are left to validatePlan.
 * @param {readonly unknown[]} tasks
 * @returns {string | null}
 */
function parserTerritoryGlob(tasks) {
  for (const task of tasks) {
    const owns = /** @type {{ owns?: unknown }} */ (task)?.owns;
    if (!Array.isArray(owns)) continue;
    for (const glob of owns) {
      if (typeof glob !== "string") continue;
      const expanded = expandOwns(glob);
      if (expanded === null) return glob;
      const inTerritory = expanded
        .map((g) => g.replace(/^(?:\.\/)+/, ""))
        .some(
          (g) =>
            !TESTS_SEGMENT.test(g) &&
            PARSER_TREES.some((tree) => globsOverlap(g, tree)),
        );
      if (inTerritory) return glob;
    }
  }
  return null;
}

/**
 * The lines of the first `## Parsers` section (any spacing, an optional suffix such as `:` or `(none)`) up to the
 * next `#` or `##` heading, each with whether it sits inside a fence. A fence closes only on the same character with
 * a run at least as long as the opener; fenced lines are never headings.
 * @param {string} text LF-normalised
 * @returns {{ line: string, fenced: boolean }[] | null}
 */
function parsersSection(text) {
  /** @type {{ line: string, fenced: boolean }[] | null} */
  let section = null;
  /** @type {string | null} */
  let fence = null;
  for (const line of text.split("\n")) {
    const run = /^\s*(`{3,}|~{3,})/.exec(line)?.[1] ?? null;
    if (fence !== null) {
      section?.push({ line, fenced: true });
      const closes =
        run !== null &&
        run[0] === fence[0] &&
        run.length >= fence.length &&
        line.trim() === run;
      if (closes) fence = null;
      continue;
    }
    if (run !== null) {
      fence = run;
      section?.push({ line, fenced: true });
      continue;
    }
    const heading = /^#{1,2}\s/.test(line);
    if (heading && section !== null) break;
    if (heading && /^##\s+Parsers\b/.test(line)) section = [];
    else section?.push({ line, fenced: false });
  }
  return section;
}

/**
 * The text after a label that opens the line (list marker and bold allowed), or null when the line does not open
 * with it. `Rejected inputs` may be written without a colon.
 * @param {string} line
 * @param {string} label
 * @returns {string | null}
 */
function labelText(line, label) {
  const plain = line.replace(/\*\*/g, "").replace(LABEL_LINE, "");
  const opens =
    plain.startsWith(`${label}:`) ||
    (label === "Rejected inputs" && plain.startsWith(label));
  return opens ? plain.slice(label.length).replace(/^:/, "").trim() : null;
}

/** A label line with text after the label on the same line. */
const hasLabel = (/** @type {string[]} */ lines, /** @type {string} */ label) =>
  lines.some((l) => (labelText(l, label) ?? "") !== "");

/**
 * At least 3 data rows (header and `|---|` separators excluded) in the first Markdown table after the `Rejected
 * inputs` label line and before the next block label (MF-0069 review B-1: a table under `Cross-check:` is not it).
 * @param {string[]} lines
 */
function hasRejectedTable(lines) {
  const label = lines.findIndex(
    (l) => labelText(l, "Rejected inputs") !== null,
  );
  if (label === -1) return false;
  let start = label + 1;
  while (
    start < lines.length &&
    !lines[start].trim().startsWith("|") &&
    !BLOCK_LABELS.some((other) => labelText(lines[start], other) !== null)
  )
    start++;
  let end = start;
  while (end < lines.length && lines[end].trim().startsWith("|")) end++;
  const rows = lines
    .slice(start + 1, end)
    .filter((l) => !/^\|[\s:|-]+$/.test(l.trim()));
  return rows.length >= 3;
}

/**
 * MF-0069: one line per problem for each ticket after MF-0068, not reserved, at stage build or later, whose LOOP-PLAN
 * tasks may own a non-test file under scripts/, .claude/hooks/ or src/engine/. Its `## Parsers` section must say
 * `None: <reason>` (no blocks) or hold `### <name>` blocks, each with `Accepted grammar:`, a Rejected inputs table of
 * 3+ rows and `Exempt-path test:`, as line-opening labels outside fences. A missing plan or an unreadable task block
 * is left to `checkPlanOwns`.
 * @param {readonly PlanEntry[]} entries
 * @returns {string[]}
 */
export function checkPlanParsers(entries) {
  return entries.flatMap(({ dir, goalText, planText }) => {
    if (goalText === null || dir <= PARSERS_CUTOFF) return [];
    const goal = goalText.replace(/\r\n/g, "\n");
    if (frontValue(goal, "goal_status") === "reserved") return [];
    if (!JUDGED_STAGES.has(frontValue(goal, "stage") ?? "")) return [];
    if (planText === null || planText === undefined) return [];
    const text = planText.replace(/\r\n/g, "\n");
    const { tasks, errors } = parsePlanTasks(text);
    if (errors.length > 0) return [];
    const glob = parserTerritoryGlob(tasks);
    if (glob === null) return [];

    const section = parsersSection(text);
    if (section === null)
      return [
        `${dir}: LOOP-PLAN owns ${glob} but has no "## Parsers" section ${PARSERS_HINT}`,
      ];

    /** @type {{ name: string, lines: string[] }[]} */
    const blocks = [];
    /** @type {string[]} */
    const preface = [];
    for (const { line, fenced } of section) {
      if (fenced) continue;
      if (/^###\s/.test(line))
        blocks.push({ name: line.replace(/^###\s+/, "").trim(), lines: [] });
      else (blocks.at(-1)?.lines ?? preface).push(line);
    }

    if (blocks.length === 0) {
      const first = (preface.find((l) => l.trim() !== "") ?? "")
        .replace(/\*\*/g, "")
        .trim();
      if (!first.startsWith("None:"))
        return [
          `${dir}: Parsers section has neither "None: <reason>" nor a ### block`,
        ];
      const reason = first.slice("None:".length).trim();
      return reason === "" || reason.startsWith("<")
        ? [`${dir}: Parsers section says "None:" without a reason`]
        : [];
    }

    return blocks.flatMap(({ name, lines }) => [
      ...(hasLabel(lines, "Accepted grammar")
        ? []
        : [`${dir}: Parsers block "${name}" has no "Accepted grammar:" line`]),
      ...(hasRejectedTable(lines)
        ? []
        : [
            `${dir}: Parsers block "${name}" has no Rejected inputs table with 3 or more rows`,
          ]),
      ...(hasLabel(lines, "Exempt-path test")
        ? []
        : [`${dir}: Parsers block "${name}" has no "Exempt-path test:" line`]),
    ]);
  });
}
