/**
 * PT-0383 — the facts a retrospective starts from, read back from a ticket's artifacts and the
 * session metrics. Pure: the CLI (`scripts/ticket-retro.mjs`) does the file reads.
 *
 * The retro agent interprets; this decides nothing. It counts what the toolchain already
 * recorded — receipts, the freeze history, research classes, the review verdict, tokens — so the
 * retrospective argues from numbers instead of from the building session's memory of itself.
 * `signals` are fixed thresholds, not judgements: each one is a prompt to look, never a verdict.
 */
import { frontmatter, successCriteria } from "./ticket-eval.mjs";

/** The closed cause set a RETRO.md may name. `none` = nothing worth changing. */
export const RETRO_CAUSES = [
  "missing-context", // the fact was in the repo / memory / docs but never reached the session
  "known-trap-repeated", // a memory entry or skill rule already named it, and it bit anyway
  "wrong-plan", // the plan was wrong, not the code
  "wrong-test", // a frozen test or SC had to change
  "tooling", // a gate, hook, stack or script got in the way or lied
  "scope", // the ticket grew, or another session's work collided
  "token-waste", // the work was right but cost far more context than it needed
  "none",
];

/** The closed action set: where a lesson must land to be loaded next time. */
export const RETRO_ACTIONS = [
  "gate", // a static check or hook makes the trap impossible
  "skill-edit", // a rule added to, or removed from, a skill or reference
  "memory-update", // an existing memory entry sharpened
  "memory-add", // a new memory entry (only when no existing one covers it)
  "memory-delete", // an entry found wrong, stale or duplicated
  "none",
];

/** Thresholds behind `signals`. First guesses, like the stop rule's; tune from `--across`. */
export const SIGNAL_THRESHOLDS = {
  failedVerifies: 2,
  callsVsMedian: 2,
  cacheReadVsMedian: 2,
};

const n = (x) => (typeof x === "number" && Number.isFinite(x) ? x : 0);

/** @param {number[]} xs */
export function median(xs) {
  const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (s.length === 0) return null;
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Receipts -> what the TEST loop looked like. A check counts against the ticket only when it
 * failed with something new (`newFailures`), or failed with no baseline to compare against;
 * `preexisting` and `skip` are not the ticket's.
 * @param {any[]} receipts parsed lines of <ID>.receipts.jsonl, in order
 */
export function receiptFacts(receipts) {
  const verifies = receipts.filter((r) => r.kind === "verify");
  const firstPass = verifies.findIndex((r) => r.verdict === "PASS");
  /** @type {Record<string, number>} */
  const failingChecks = {};
  /** @type {Map<string, number>} */
  const keyCounts = new Map();
  for (const r of verifies) {
    for (const c of r.checks ?? []) {
      const own =
        c.status === "fail" &&
        (c.newFailures ? c.newFailures.length > 0 : true);
      if (own) failingChecks[c.id] = (failingChecks[c.id] ?? 0) + 1;
    }
    for (const k of new Set(r.failure_keys ?? []))
      keyCounts.set(k, (keyCounts.get(k) ?? 0) + 1);
  }
  const at = receipts.map((r) => Date.parse(r.at)).filter(Number.isFinite);
  return {
    verifyRuns: verifies.length,
    failedBeforePass: firstPass === -1 ? verifies.length : firstPass,
    passed: firstPass !== -1,
    latestVerdict: verifies.at(-1)?.verdict ?? null,
    failingChecks,
    repeatedFailures: [...keyCounts]
      .filter(([, c]) => c >= 2)
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key)),
    spanHours:
      at.length >= 2
        ? +((Math.max(...at) - Math.min(...at)) / 3_600_000).toFixed(1)
        : 0,
  };
}

/** `- class: …` lines -> the strictest class each research note reached. */
export function researchClass(text) {
  const line = /^\s*-\s*class:\s*(.*)$/m.exec(text ?? "")?.[1] ?? "";
  if (/needs-human/.test(line)) return "needs-human";
  if (/recommend/.test(line)) return "recommend";
  if (/answered/.test(line)) return "answered";
  return "uninterpreted";
}

/**
 * Sessions attributed to this ticket (the metrics hook's `ticket` field), latest row per session.
 * @param {any[]} sessions parsed sessions.jsonl
 * @param {any[]} runs parsed runs.jsonl
 */
export function usageByTicket(sessions, runs) {
  const latest = new Map();
  for (const s of sessions) latest.set(s.session_id, s);
  const cost = new Map(runs.map((r) => [r.session_id, r.total_cost_usd]));
  /** @type {Map<string, any>} */
  const out = new Map();
  for (const s of latest.values()) {
    if (!s.ticket) continue;
    const u = out.get(s.ticket) ?? {
      sessions: 0,
      activeHours: 0,
      calls: 0,
      output: 0,
      cacheRead: 0,
      costUsd: null,
      agents: {},
    };
    u.sessions++;
    u.activeHours += n(s.active_ms) / 3_600_000;
    for (const t of Object.values(s.total ?? s.models ?? {})) {
      u.calls += n(t.calls);
      u.output += n(t.output);
      u.cacheRead += n(t.cacheRead);
    }
    for (const [name, a] of Object.entries(s.agents ?? {})) {
      const agg = u.agents[name] ?? { runs: 0, calls: 0, cacheRead: 0 };
      agg.runs += n(a.runs);
      for (const t of Object.values(a.models ?? {})) {
        agg.calls += n(t.calls);
        agg.cacheRead += n(t.cacheRead);
      }
      u.agents[name] = agg;
    }
    const c = cost.get(s.session_id);
    if (typeof c === "number") u.costUsd = (u.costUsd ?? 0) + c;
    out.set(s.ticket, u);
  }
  for (const u of out.values()) u.activeHours = +u.activeHours.toFixed(1);
  return out;
}

/**
 * Everything the retro agent needs, in one object.
 * @param {{ ticket: string, goalText: string, receipts: any[], frozen: any, reviewText: string | null,
 *   researchTexts: string[], usage: Map<string, any> }} input
 */
export function retroFacts({
  ticket,
  goalText,
  receipts,
  frozen,
  reviewText,
  researchTexts,
  usage,
}) {
  const fm = frontmatter(goalText);
  const scs = successCriteria(goalText);
  const log = (goalText ?? "").split(/^## Iteration Log\s*$/m)[1] ?? "";
  const iterations = (log.match(/^###\s+Iteration\b/gm) ?? []).length;
  const failedIterations = (log.match(/^verdict:\s*FAIL\b/gm) ?? []).length;

  const refreezes = (frozen?.history ?? [])
    .filter((h) => h.action === "refreeze")
    .map((h) => ({ path: h.path, reason: h.reason ?? "" }));

  const research = {
    answered: 0,
    recommend: 0,
    "needs-human": 0,
    uninterpreted: 0,
  };
  for (const t of researchTexts) research[researchClass(t)]++;

  const review = reviewText
    ? {
        verdict: frontmatter(reviewText).verdict ?? null,
        blocking: (reviewText.match(/^\s*-\s*\[blocking\]/gm) ?? []).length,
      }
    : null;

  const own = usage.get(ticket) ?? null;
  const others = [...usage].filter(([t]) => t !== ticket).map(([, u]) => u);
  const medians = {
    calls: median(others.map((u) => u.calls)),
    cacheRead: median(others.map((u) => u.cacheRead)),
    tickets: others.length,
  };

  const r = receiptFacts(receipts);
  const signals = [];
  if (r.failedBeforePass >= SIGNAL_THRESHOLDS.failedVerifies)
    signals.push(
      `ticket:verify failed ${r.failedBeforePass}× before its first PASS`,
    );
  if (!r.passed && r.verifyRuns > 0) signals.push("no PASS receipt");
  if (r.verifyRuns === 0)
    signals.push("no verify receipt: the TEST stage left no record");
  for (const f of r.repeatedFailures)
    signals.push(`the same failure in ${f.count} receipts: ${f.key}`);
  if (failedIterations > 0)
    signals.push(`${failedIterations} failed iteration(s) in the GOAL log`);
  if (refreezes.length > 0)
    signals.push(`${refreezes.length} refreeze(s): the contract changed`);
  if (research["needs-human"] > 0)
    signals.push(
      `${research["needs-human"]} research question(s) needed a human`,
    );
  if (review?.verdict === "changes-requested")
    signals.push(`diff review requested changes (${review.blocking} blocking)`);
  if (
    own &&
    medians.calls &&
    own.calls > SIGNAL_THRESHOLDS.callsVsMedian * medians.calls
  )
    signals.push(
      `${own.calls} API calls vs a median of ${Math.round(medians.calls)}`,
    );
  if (
    own &&
    medians.cacheRead &&
    own.cacheRead > SIGNAL_THRESHOLDS.cacheReadVsMedian * medians.cacheRead
  )
    signals.push(
      `${(own.cacheRead / 1e6).toFixed(1)}M cache-read tokens vs a median of ${(medians.cacheRead / 1e6).toFixed(1)}M`,
    );
  if (!own) signals.push("no session metrics attributed to this ticket");

  return {
    ticket,
    tier: fm.tier ?? null,
    stage: fm.stage ?? null,
    goalStatus: fm.goal_status ?? null,
    successCriteria: {
      total: scs.length,
      done: scs.filter((s) => s.done).length,
    },
    iterations,
    failedIterations,
    receipts: r,
    refreezes,
    research,
    review,
    usage: own,
    medians,
    signals,
  };
}

/** A comma list in a front-matter value -> trimmed, non-empty items. */
const list = (v) =>
  (v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * Across tickets: which causes recur, and which lessons were learned more than once — a lesson
 * learned twice is the case for a gate, not a third memory entry.
 * @param {{ ticket: string, text: string }[]} retros RETRO.md files
 */
export function aggregateRetros(retros) {
  /** @type {Record<string, number>} */
  const causes = {};
  /** @type {Record<string, number>} */
  const actions = {};
  /** @type {Map<string, string[]>} */
  const lessons = new Map();
  const problems = [];
  for (const { ticket, text } of retros) {
    const fm = frontmatter(text);
    for (const c of list(fm.causes)) {
      if (!RETRO_CAUSES.includes(c))
        problems.push(`${ticket}: unknown cause "${c}"`);
      causes[c] = (causes[c] ?? 0) + 1;
    }
    for (const a of list(fm.actions)) {
      if (!RETRO_ACTIONS.includes(a))
        problems.push(`${ticket}: unknown action "${a}"`);
      actions[a] = (actions[a] ?? 0) + 1;
    }
    for (const k of list(fm.lesson_keys))
      lessons.set(k, [...(lessons.get(k) ?? []), ticket]);
  }
  return {
    tickets: retros.length,
    causes,
    actions,
    repeatedLessons: [...lessons]
      .filter(([, ts]) => ts.length >= 2)
      .map(([key, tickets]) => ({ key, tickets }))
      .sort(
        (a, b) =>
          b.tickets.length - a.tickets.length || a.key.localeCompare(b.key),
      ),
    problems,
  };
}
