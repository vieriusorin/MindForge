/**
 * the pure half of `pnpm ticket:eval` and of the runner's readiness check.
 *
 * The evaluator answers "was this ticket built the way the lifecycle says?" from artifacts alone:
 * GOAL.md, FROZEN.json, the receipts, LOOP-PLAN.md's task graph, REVIEW.md and the changed-file
 * list. It never asks the agent. Each rule is one entry in `checks`; `needsHuman` lists what is
 * legitimate but must be looked at by a person (a refreeze — the contract moved).
 */
import { createHash } from "node:crypto";
import { NEVER_GLOBS } from "../../.claude/hooks/lib/agent-scopes.mjs";

/** The role agents a plan may assign work to. Mirrors `.claude/agents/*.md`. */
export const PLAN_AGENTS = [
  "acceptance-writer",
  "schema-builder",
  "service-builder",
  "ui-builder",
];

/**
 * MF-0048: steps the main session runs itself (shipped plans use both names). The scope hook does not restrict the
 * main session, so these tasks may own NEVER paths (scripts, hooks, evidence, package files).
 */
export const MAIN_SESSION_AGENTS = ["inline", "orchestrator"];

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
 * A glob as `globToRegExp` reads it: `**` (any chars, `/` included; a following `/` is folded in), `*` and `?`
 * (no `/`), or one literal char.
 * @param {string} glob
 * @returns {({ kind: "any" | "segment" | "one" } | { kind: "char"; char: string })[]}
 */
function globTokens(glob) {
  const tokens = [];
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*" && glob[i + 1] === "*") {
      tokens.push({ kind: "any" });
      i++;
      if (glob[i + 1] === "/") i++;
    } else if (c === "*") tokens.push({ kind: "segment" });
    else if (c === "?") tokens.push({ kind: "one" });
    else tokens.push({ kind: "char", char: c });
  }
  return tokens;
}

/** Whether one char can satisfy both tokens (a star's own char class, a `?`, or a literal). */
function sharesChar(a, b) {
  if (a.kind === "char" && b.kind === "char") return a.char === b.char;
  if (a.kind === "char") return b.kind === "any" || a.char !== "/";
  if (b.kind === "char") return a.kind === "any" || b.char !== "/";
  return true; // two classes: both admit any non-`/` char
}

/**
 * MF-0048: true when some path matches both globs under `globToRegExp`'s semantics. Exact: a breadth-first search
 * over the product of the two patterns, where a star may stay put (consume a char) or step past (match empty).
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function globsOverlap(a, b) {
  const A = globTokens(a);
  const B = globTokens(b);
  const isStar = (t) => t?.kind === "any" || t?.kind === "segment";
  const seen = new Set();
  const queue = [[0, 0]];
  while (queue.length) {
    const [i, j] = /** @type {[number, number]} */ (queue.shift());
    const key = `${i},${j}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (i === A.length && j === B.length) return true;
    if (isStar(A[i])) queue.push([i + 1, j]);
    if (isStar(B[j])) queue.push([i, j + 1]);
    if (i < A.length && j < B.length && sharesChar(A[i], B[j]))
      queue.push([isStar(A[i]) ? i : i + 1, isStar(B[j]) ? j : j + 1]);
  }
  return false;
}

/**
 * The `owns` segment shapes this check reads (an allowlist, verification.md §4; MF-0048 review B1): a whole-segment
 * `**`; a Next.js route segment `(group)`, `[param]`, `[...param]`, `[[...param]]`; or a run of `[A-Za-z0-9_.@+-]`,
 * `*` and `?` that is not `.` or `..` and holds no `**`. Anything else (spaces, braces, classes, a drive colon, a
 * backslash) is unreadable, so it is an error, never a pass.
 */
const OWNS_SEGMENT =
  /^(?:\*\*|\([\w.-]+\)|\[(?:\.\.\.)?[\w-]+\]|\[\[\.\.\.[\w-]+\]\]|(?:[\w.@+-]|\*(?!\*)|\?)+)$/;

/** A brace set expanding past this many paths is unreadable (fail closed), not a slow pass. */
const MAX_BRACE_EXPANSIONS = 64;

/**
 * Plans write `dir/{a,b}/x` for alternatives (MF-0032, MF-0038, MF-0042). Expands each non-nested `{…,…}` so every
 * alternative is checked; a nested or empty set, or more than MAX_BRACE_EXPANSIONS results, is an error.
 * @param {string} glob
 * @returns {{ globs: string[] } | { error: string }}
 */
function expandBraces(glob) {
  let depth = 0;
  for (const c of glob) {
    depth += c === "{" ? 1 : c === "}" ? -1 : 0;
    if (depth > 1) return { error: "nests a brace set" };
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
    if (globs.length > MAX_BRACE_EXPANSIONS)
      return { error: `expands to more than ${MAX_BRACE_EXPANSIONS} globs` };
  }
  return { globs };
}

/**
 * Why an `owns` entry is not a glob this check can read, or null.
 * @param {unknown} glob
 * @returns {string | null}
 */
function ownsSyntaxProblem(glob) {
  if (typeof glob !== "string" || glob === "")
    return "is not a non-empty string";
  for (const segment of glob.split("/")) {
    if (segment === "") return "has an empty segment (no leading or doubled /)";
    if (segment === "." || segment === "..")
      return `has a "${segment}" segment (paths are repo-relative, never relative to another path)`;
    if (!OWNS_SEGMENT.test(segment))
      return `has an unreadable segment "${segment}" (allowed: [A-Za-z0-9_.@+-], *, ?, whole-segment **, Next.js (group) and [param])`;
  }
  return null;
}

/**
 * MF-0048: problems with a task's `owns`. Every task's globs must be readable (review B2: an exemption skips only its
 * own rule); a role-agent task's globs must also not reach a path role agents never write (`NEVER_GLOBS`, owned by
 * agent-scopes.mjs). Compared case-insensitively: `Scripts/x.mjs` is `scripts/x.mjs` on Windows and macOS.
 * @param {{ id: string; agent: string; owns?: unknown }} task
 * @returns {string[]}
 */
function ownsNeverProblems(task) {
  if (!Array.isArray(task.owns)) return [];
  const isMainSession = MAIN_SESSION_AGENTS.includes(task.agent);
  const errors = [];
  for (const glob of task.owns) {
    const expanded =
      typeof glob === "string" ? expandBraces(glob) : { globs: [glob] };
    const syntax =
      "error" in expanded
        ? expanded.error
        : expanded.globs.map(ownsSyntaxProblem).find(Boolean);
    if (syntax || "error" in expanded) {
      errors.push(`${task.id}: owns ${JSON.stringify(glob)} ${syntax}`);
      continue;
    }
    if (isMainSession) continue;
    const folded = expanded.globs.map((g) => String(g).toLowerCase());
    for (const never of NEVER_GLOBS)
      if (folded.some((g) => globsOverlap(g, never.toLowerCase())))
        errors.push(
          `${task.id}: ${task.agent} may not own ${glob}: it can match NEVER glob ${never} (role agents never write it; agent-scopes.mjs)`,
        );
  }
  return errors;
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
    if (
      !PLAN_AGENTS.includes(t.agent) &&
      !MAIN_SESSION_AGENTS.includes(t.agent)
    )
      errors.push(`${t.id}: unknown agent "${t.agent}"`);
    if (!Array.isArray(t.owns) || t.owns.length === 0)
      errors.push(`${t.id}: no owns globs`);
    errors.push(...ownsNeverProblems(t));
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
