/**
 * MF-0055: the decisions behind `pnpm ticket:github`, which mirrors `.planning/tasks/<ID>/GOAL.md`
 * onto the ticket's GitHub issue and the MindForge project. Pure: the CLI
 * (`scripts/ticket-github.mjs`) does every `gh` call and passes text and issue state in.
 * GOAL.md stays the source of truth; GitHub is the shared, visible copy.
 */

/** Project "Status" option per GOAL `goal_status` (closed set in the gsd-goal-loop skill). */
export const PROJECT_STATUS = /** @type {const} */ ({
  reserved: "Todo",
  "in-progress": "In Progress",
  blocked: "Blocked",
  "complete-pending-manual-commit": "In Review",
  withdrawn: "Done",
  closed: "Done",
});

/** Issue label per status; exactly one of these is on an open ticket issue. */
export const STATUS_LABELS = /** @type {const} */ ({
  reserved: "status: backlog",
  "in-progress": "status: in progress",
  blocked: "status: blocked",
  "complete-pending-manual-commit": "status: in review",
});

/** Project "Stage" option per GOAL `stage:`. */
export const STAGE_OPTION = /** @type {const} */ ({
  intake: "Intake",
  design: "Design",
  plan: "Plan",
  build: "Build",
  test: "Test",
  handoff: "Hand-off",
  watch: "Watch",
});

/** Milestone title per roadmap week (docs/plan/ROADMAP.md). */
const MILESTONE_BY_WEEK = [
  [/^W1|^W2/, "W1–W2: Playable MVP"],
  [/^W3/, "W3: Exam practice"],
  [/^W4/, "W4: Stretch"],
];

const TICKET = /MF-\d{4}/g;

// The origin line a ticket carries when another ticket split it out, reserved it, or drafted it
// ("Split out of MF-0005", "Reserved 2026-11-04 by the MF-0036 retro", "Drafted … by MF-0025").
const ORIGIN =
  /^> .*?(?:Split out of|Reserved[^.\n]*?(?:from|by)(?: the)?|Drafted[^.\n]*? by(?: the)?) (MF-\d{4})/m;

/** @param {string} head @param {string} key */
function field(head, key) {
  const match = head.match(new RegExp(`^${key}:(.*)$`, "m"));
  if (!match) return "";
  return match[1]
    .replace(/\s+#.*$/, "")
    .trim()
    .replace(/^(["'])(.*)\1$/, "$2");
}

/** The body of `## <name>` up to the next `## ` heading, trimmed; "" when absent. */
export function section(text, name) {
  const part = text
    .split(/^## /m)
    .find((p) => p.startsWith(`${name}\n`) || p.startsWith(`${name} `));
  if (!part) return "";
  return part.slice(part.indexOf("\n") + 1).trim();
}

/**
 * @typedef {{
 *   id: string, title: string, tier: string, stage: string, status: string,
 *   statusKey: keyof typeof PROJECT_STATUS | null, week: string,
 *   dependsOn: string[], parent: string | null, objective: string, successCriteria: string
 * }} Goal
 */

/**
 * Reads a GOAL.md. `statusKey` folds `blocked-on-<owner>` into `blocked`; an unknown status is null.
 * `dependsOn` is `depends_on` ∪ `builds_on`, ticket ids only, without the ticket itself.
 * @param {string} rawText
 * @returns {Goal}
 */
export function parseGoal(rawText) {
  const text = rawText.replace(/\r\n/g, "\n");
  const head = text.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
  const body = text.slice(head.length);
  const id = field(head, "ticket_id");
  const status = field(head, "goal_status");
  const statusKey = status.startsWith("blocked")
    ? "blocked"
    : Object.hasOwn(PROJECT_STATUS, status) && status !== "closed"
      ? /** @type {keyof typeof PROJECT_STATUS} */ (status)
      : null;
  const deps = `${field(head, "depends_on")} ${field(head, "builds_on")}`;
  const origin = body.match(ORIGIN)?.[1] ?? null;
  return {
    id,
    title: field(head, "title"),
    tier: field(head, "tier") || "normal",
    stage: field(head, "stage"),
    status,
    statusKey,
    week: field(head, "week"),
    dependsOn: [...new Set(deps.match(TICKET) ?? [])].filter((d) => d !== id),
    parent: origin && origin !== id ? origin : null,
    objective: section(body, "Objective"),
    successCriteria: section(body, "Success Criteria"),
  };
}

/** @param {string} week @returns {string | null} */
export function milestoneFor(week) {
  const hit = MILESTONE_BY_WEEK.find(([re]) => re.test(week.trim()));
  return hit ? hit[1] : null;
}

/**
 * The issue title. GOAL `title:` wins; otherwise the existing issue keeps its title; a new issue
 * without either uses the first sentence of the Objective's end state.
 * @param {Goal} goal
 * @param {string | null} existingTitle
 * @returns {string}
 */
export function issueTitle(goal, existingTitle) {
  if (goal.title) return `${goal.id}: ${goal.title}`;
  if (existingTitle) return existingTitle;
  const endState =
    goal.objective.match(
      /\*\*End state[^*]*\*\*\s*([\s\S]*?)(?:\n\n|$)/,
    )?.[1] ?? goal.objective;
  const sentence = endState
    .replace(/[*`]/g, "")
    .replace(/\s+/g, " ")
    .split(/(?<=[.:])\s/)[0]
    .replace(/[.:]$/, "")
    .trim();
  const short =
    sentence.length > 80 ? `${sentence.slice(0, 77).trimEnd()}…` : sentence;
  return `${goal.id}: ${short || "untitled ticket"}`;
}

/**
 * What GitHub should show for this GOAL. A closed issue is never reopened: once a PR with
 * `Closes #N` merged, the ticket is Done whatever the GOAL's stale status says.
 * @param {Goal} goal
 * @param {{ isClosed: boolean, assignees: readonly string[] }} issue
 * @returns {{ projectStatus: string | null, stage: string | null, label: string | null,
 *   close: null | "completed" | "not planned", assignMe: boolean }}
 */
export function syncPlan(goal, issue) {
  const stage =
    STAGE_OPTION[/** @type {keyof typeof STAGE_OPTION} */ (goal.stage)] ?? null;
  if (issue.isClosed)
    return {
      projectStatus: "Done",
      stage,
      label: null,
      close: null,
      assignMe: false,
    };
  if (goal.statusKey === null)
    return {
      projectStatus: null,
      stage,
      label: null,
      close: null,
      assignMe: false,
    };
  // A `reserved` GOAL on an issue someone holds is this branch's stale copy: the claim lives on the
  // claimer's branch (MF-0055: a sync from main moved the in-flight MF-0054 back to Todo). Leave it.
  if (goal.statusKey === "reserved" && issue.assignees.length > 0)
    return {
      projectStatus: null,
      stage: null,
      label: null,
      close: null,
      assignMe: false,
    };
  if (goal.statusKey === "withdrawn")
    return {
      projectStatus: "Done",
      stage,
      label: null,
      close: "not planned",
      assignMe: false,
    };
  return {
    projectStatus: PROJECT_STATUS[goal.statusKey],
    stage,
    label:
      STATUS_LABELS[/** @type {keyof typeof STATUS_LABELS} */ (goal.statusKey)],
    close: null,
    assignMe: goal.statusKey === "in-progress" && issue.assignees.length === 0,
  };
}

/**
 * Whether `me` may claim the ticket. Someone else already assigned → refused unless forced, so two
 * people never build one ticket.
 * @param {readonly string[]} assignees
 * @param {string} me
 * @param {boolean} force
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function claimDecision(assignees, me, force) {
  const others = assignees.filter((a) => a.toLowerCase() !== me.toLowerCase());
  if (others.length === 0 || force) return { ok: true };
  return {
    ok: false,
    reason: `already assigned to ${others.join(", ")}; ask them, or pass --force to take it over`,
  };
}

/**
 * The next free ticket id across local folders, every branch's GOALs and the issue titles.
 * The issue list is the shared registry: a number becomes taken the moment its issue exists.
 * @param {readonly string[]} takenIds any strings; only `MF-####` are read
 * @returns {string}
 */
export function nextTicketId(takenIds) {
  const max = takenIds
    .flatMap((s) => s.match(TICKET) ?? [])
    .reduce((m, id) => Math.max(m, Number(id.slice(3))), 0);
  return `MF-${String(max + 1).padStart(4, "0")}`;
}

/**
 * A comment line for the issue timeline when the stage or status moved, or null when nothing moved
 * or there is no earlier record to compare against.
 * @param {{ stage: string, status: string } | undefined} before
 * @param {Goal} goal
 * @returns {string | null}
 */
export function progressComment(before, goal) {
  if (!before) return null;
  const moves = [];
  if (before.stage !== goal.stage)
    moves.push(`stage \`${before.stage || "—"}\` → \`${goal.stage || "—"}\``);
  if (before.status !== goal.status)
    moves.push(
      `status \`${before.status || "—"}\` → \`${goal.status || "—"}\``,
    );
  if (moves.length === 0) return null;
  return `Progress (from \`.planning/tasks/${goal.id}/GOAL.md\`): ${moves.join(", ")}.`;
}

// Never ping real accounts from copied planning text.
const defang = (s) => s.replace(/@(?=[A-Za-z0-9])/g, "@​");

const cap = (s, n) =>
  s.length <= n
    ? s
    : `${s.slice(0, n).replace(/\n[^\n]*$/, "")}\n\n_… truncated; full text in GOAL.md_`;

/**
 * The body of a new issue. Written once at creation; later syncs change labels, fields and
 * relationships, never the body, so a human edit survives.
 * @param {Goal} goal
 * @param {string} blobBase e.g. https://github.com/<owner>/<repo>/blob/main
 * @returns {string}
 */
export function issueBody(goal, blobBase) {
  const meta = [`**Ticket:** ${goal.id}`, `**Tier:** ${goal.tier}`];
  if (goal.parent) meta.push(`**Came from:** ${goal.parent}`);
  if (goal.dependsOn.length)
    meta.push(`**Builds on:** ${goal.dependsOn.join(", ")}`);
  const parts = [
    `> Synced from \`.planning/tasks/${goal.id}/GOAL.md\` by \`pnpm ticket:github\`. GOAL.md is the source of truth.`,
    meta.join("  \n"),
    `## Objective\n\n${cap(goal.objective || "_Not written yet._", 3500)}`,
  ];
  if (goal.successCriteria)
    parts.push(`## Success Criteria\n\n${cap(goal.successCriteria, 3500)}`);
  parts.push(
    `## Records\n\n- Goal: [\`GOAL.md\`](${blobBase}/.planning/tasks/${goal.id}/GOAL.md)\n- Evidence (after hand-off): [\`${goal.id}.md\`](${blobBase}/.planning/evidence/${goal.id}.md)`,
  );
  return defang(parts.join("\n\n"));
}
