/**
 * PT-0352 — the pure half of `pnpm ticket:eval` and of the runner's readiness check.
 *
 * The evaluator answers "was this ticket built the way the lifecycle says?" from artifacts alone:
 * GOAL.md, FROZEN.json, the receipts, LOOP-PLAN.md's task graph, REVIEW.md and the changed-file
 * list. It never asks the agent. Each rule is one entry in `checks`; `needsHuman` lists what is
 * legitimate but must be looked at by a person (a refreeze — the contract moved).
 */
import { createHash } from "node:crypto";

/** The role agents a plan may assign work to. Mirrors `.claude/agents/*.md`. */
export const PLAN_AGENTS = [
  "acceptance-writer",
  "schema-builder",
  "service-builder",
  "ui-builder",
];

/** `key: value` lines of a GOAL.md front matter. */
export function frontmatter(text) {
  const m = /^---\n([\s\S]*?)\n---/.exec(text ?? "");
  const out = {};
  for (const line of (m ? m[1] : "").split("\n")) {
    const kv = /^([A-Za-z_]+):\s*(.*?)\s*(#.*)?$/.exec(line);
    if (kv) out[kv[1]] = kv[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

/** `- [ ] SC-1: … Proof: …` (or `- [ ] **SC-1** …`, older GOALs) lines -> { id, text, done }. */
export function successCriteria(goalText) {
  const out = [];
  let inSc = false;
  for (const line of (goalText ?? "").split("\n")) {
    const m = /^\s*-\s*\[( |x|X)\]\s*\*{0,2}(SC-\d+)\*{0,2}:?\s*(.*)$/.exec(
      line,
    );
    if (m) {
      out.push({ id: m[2], text: m[3], done: m[1] !== " " });
      inSc = true;
    } else if (inSc && /^\s+\S/.test(line) && !/^\s*[-*]\s/.test(line)) {
      // An SC wraps: an indented line that is not a new list item continues it.
      out.at(-1).text += ` ${line.trim()}`;
    } else {
      inSc = false;
    }
  }
  return out;
}

/** `**` spans directories, `*` stays inside one segment. */
export function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*" && glob[i + 1] === "*") {
      re += ".*";
      i++;
      if (glob[i + 1] === "/") i++;
    } else if (c === "*") re += "[^/]*";
    else if (c === "?") re += "[^/]";
    else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}

/**
 * The task graph lives in LOOP-PLAN.md as one fenced block with the info string `json tasks`.
 * @returns {{ tasks: any[], errors: string[] }}
 */
export function parsePlanTasks(text) {
  const m = /```json tasks\s*\n([\s\S]*?)\n```/.exec(text ?? "");
  if (!m)
    return { tasks: [], errors: ["LOOP-PLAN.md has no ```json tasks block"] };
  try {
    const tasks = JSON.parse(m[1]);
    if (!Array.isArray(tasks))
      return { tasks: [], errors: ["the tasks block is not an array"] };
    return { tasks, errors: [] };
  } catch (e) {
    return {
      tasks: [],
      errors: [`the tasks block is not valid JSON: ${e.message}`],
    };
  }
}

/**
 * @param {any[]} tasks
 * @param {string[]} scIds every SC the GOAL declares
 * @returns {string[]} problems; empty = a graph the orchestrator can run
 */
export function validatePlan(tasks, scIds) {
  const errors = [];
  const ids = new Set(tasks.map((t) => t.id));
  for (const t of tasks) {
    if (!PLAN_AGENTS.includes(t.agent))
      errors.push(`${t.id}: unknown agent "${t.agent}"`);
    if (!Array.isArray(t.owns) || t.owns.length === 0)
      errors.push(`${t.id}: no owns globs`);
    for (const d of t.depends_on ?? []) {
      if (!ids.has(d)) errors.push(`${t.id}: depends on unknown task ${d}`);
    }
  }
  // Cycle check: Kahn's algorithm over known edges.
  const indegree = new Map(tasks.map((t) => [t.id, 0]));
  for (const t of tasks) {
    for (const d of t.depends_on ?? [])
      if (ids.has(d)) indegree.set(t.id, indegree.get(t.id) + 1);
  }
  const queue = [...indegree].filter(([, n]) => n === 0).map(([id]) => id);
  let seen = 0;
  while (queue.length) {
    const id = queue.shift();
    seen++;
    for (const t of tasks) {
      if ((t.depends_on ?? []).includes(id)) {
        indegree.set(t.id, indegree.get(t.id) - 1);
        if (indegree.get(t.id) === 0) queue.push(t.id);
      }
    }
  }
  if (seen < tasks.length) errors.push("the task graph has a cycle");
  const closed = new Set(tasks.flatMap((t) => t.closes ?? []));
  for (const sc of scIds)
    if (!closed.has(sc)) errors.push(`${sc} is closed by no task`);
  return errors;
}

/**
 * Can the runner take this ticket unattended? The design half (intent, SCs, frozen tests) must be
 * done while the user is present; the night only builds and verifies.
 * @returns {{ ready: boolean, reasons: string[] }}
 */
export function readiness({ goalText, frozen }) {
  const fm = frontmatter(goalText);
  const reasons = [];
  if (fm.autonomy !== "ready")
    reasons.push("GOAL.md front matter lacks `autonomy: ready`");
  if (fm.goal_status !== "in-progress")
    reasons.push(
      `goal_status is "${fm.goal_status ?? "missing"}", not in-progress`,
    );
  if (!["plan", "build", "test"].includes(fm.stage)) {
    reasons.push(
      `stage is "${fm.stage ?? "missing"}" — design must finish while the user is present`,
    );
  }
  if (!frozen || !Array.isArray(frozen.files) || frozen.files.length === 0) {
    reasons.push("no frozen acceptance tests (pnpm ticket:freeze)");
  }
  if (successCriteria(goalText).length === 0)
    reasons.push("GOAL.md has no Success Criteria");
  return { ready: reasons.length === 0, reasons };
}

/**
 * @param {{ goalText: string, frozen: any, receipts: any[], changedFiles: string[],
 *   planText: string | null, reviewText: string | null, currentHash: string }} input
 */
export function evaluateTicket({
  goalText,
  frozen,
  receipts,
  changedFiles,
  planText,
  reviewText,
  currentHash,
}) {
  const checks = [];
  const needsHuman = [];
  const add = (id, ok, detail) => checks.push({ id, ok, detail });

  const scs = successCriteria(goalText);
  const noProof = scs.filter((s) => !/Proof:/i.test(s.text)).map((s) => s.id);
  add(
    "sc-proof",
    scs.length > 0 && noProof.length === 0,
    scs.length === 0
      ? "no Success Criteria"
      : noProof.length
        ? `no Proof: ${noProof.join(", ")}`
        : `${scs.length} SCs, each names its proof`,
  );

  const files = frozen?.files ?? [];
  add(
    "frozen",
    files.length > 0,
    files.length
      ? `${files.length} frozen acceptance file(s)`
      : "nothing frozen",
  );

  const baseline = receipts.find((r) => r.kind === "baseline");
  const lastFrozen = files
    .map((f) => f.frozenAt)
    .sort()
    .at(-1);
  const firstVerify = receipts.findIndex((r) => r.kind === "verify");
  const baselineLate =
    Boolean(baseline) &&
    firstVerify !== -1 &&
    receipts.indexOf(baseline) > firstVerify;
  add(
    "frozen-before-baseline",
    Boolean(baseline) &&
      !baselineLate &&
      Boolean(lastFrozen) &&
      lastFrozen <= baseline.at,
    !baseline
      ? "no baseline receipt"
      : baselineLate
        ? "the first baseline was written AFTER a verify — it describes the change, not the before"
        : !lastFrozen
          ? "nothing frozen"
          : lastFrozen <= baseline.at
            ? "contract fixed before the build started"
            : `frozen at ${lastFrozen}, after the baseline at ${baseline.at}`,
  );
  const baselines = receipts.filter((r) => r.kind === "baseline").length;
  if (baselines > 1) {
    needsHuman.push(
      `${baselines} baseline receipts — only the first counts; who wrote the others?`,
    );
  }
  for (const h of frozen?.history ?? []) {
    if (h.action === "refreeze")
      needsHuman.push(
        `refreeze of ${h.path} at ${h.at}: "${h.reason ?? "no reason"}" — confirm you agreed`,
      );
  }

  const last = receipts.filter((r) => r.kind === "verify").at(-1);
  add(
    "receipt",
    Boolean(last) && last.verdict === "PASS" && last.diff_hash === currentHash,
    !last
      ? "no verify receipt"
      : last.diff_hash !== currentHash
        ? `stale: receipt is for ${String(last.diff_hash).slice(0, 12)}, tree is ${currentHash.slice(0, 12)}`
        : `latest verify ${last.verdict}`,
  );

  const { tasks, errors } = parsePlanTasks(planText);
  const planErrors = planText
    ? [
        ...errors,
        ...(errors.length
          ? []
          : validatePlan(
              tasks,
              scs.map((s) => s.id),
            )),
      ]
    : ["no LOOP-PLAN.md"];
  add(
    "plan",
    planErrors.length === 0,
    planErrors.length
      ? planErrors.join("; ")
      : `${tasks.length} tasks, acyclic, every SC closed`,
  );

  const globs = tasks.flatMap((t) => t.owns ?? []).map(globToRegExp);
  const outside = changedFiles.filter(
    (f) => !f.startsWith(".planning/") && !globs.some((g) => g.test(f)),
  );
  add(
    "scope",
    globs.length > 0 && outside.length === 0,
    outside.length
      ? `outside every task's owns: ${outside.join(", ")}`
      : `${changedFiles.length} changed file(s) inside the plan`,
  );

  const rv = frontmatter(reviewText);
  add(
    "review",
    rv.verdict === "approve" && rv.reviewed_hash === currentHash,
    !reviewText
      ? "no REVIEW.md"
      : rv.verdict !== "approve"
        ? `review verdict: ${rv.verdict ?? "missing"}`
        : rv.reviewed_hash !== currentHash
          ? "review is for a different diff"
          : "fresh-context review approved this diff",
  );

  const iterations = receipts.filter((r) => r.kind === "verify").length;
  return {
    checks,
    needsHuman,
    iterations,
    verdict: checks.every((c) => c.ok) ? "healthy" : "unhealthy",
  };
}

/**
 * What a receipt was judged AGAINST: the SC ids and texts plus the plan's task graph. Ticking an
 * SC's box does not change it; rewording an SC or widening a task's `owns` does — and then the
 * receipt and the review no longer describe the current contract.
 */
export function contractHashOf(goalText, planText) {
  const scs = successCriteria(goalText).map((s) => [s.id, s.text]);
  const { tasks } = parsePlanTasks(planText);
  return createHash("sha256")
    .update(JSON.stringify({ scs, tasks }))
    .digest("hex");
}
