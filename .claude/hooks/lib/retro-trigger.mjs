/**
 * when a ticket owes a retrospective. Pure; `retro-trigger.mjs` is the Stop hook.
 *
 * A ticket owes one when THIS session touched it and it is finished with evidence (complete, and
 * a PASS receipt or an evidence bundle) or parked (blocked-on-*), and its RETRO.md is missing,
 * not yet applied, or was written for a park the ticket has since got past. "Applied" is the
 * `applied:` front-matter key the orchestrator sets after acting on the retro's actions.
 */

/** How long a fresh retro-facts.json without a RETRO.md counts as a retro in progress. */
export const RETRO_IN_PROGRESS_MS = 30 * 60_000;

/** Repo-relative paths -> the ticket IDs whose planning dir or evidence they sit in. */
export function ticketsTouched(paths) {
  const ids = new Set();
  for (const p of paths) {
    const m =
      /^\.planning\/tasks\/([A-Z]{2,5}-\d{4})\//.exec(p) ??
      /^\.planning\/evidence\/([A-Z]{2,5}-\d{4})[./]/.exec(p);
    if (m) ids.add(m[1]);
  }
  return [...ids].sort();
}

/**
 * A night lane cannot write memory (sandbox) and nobody is there to see a skill edit, so under
 * `MF_AUTONOMOUS` the retro is written and marked `applied: deferred`; the next interactive
 * session that does any work applies it (`deferredRetro`).
 * @param {{ goal: Record<string, string>, retro: Record<string, string> | null,
 *   latestVerdict: string | null, hasEvidence: boolean, autonomous?: boolean,
 *   factsAgeMs?: number | null }} t
 * @returns {string | null} why a retro is due, or null
 */
export function retroDue({
  goal,
  retro,
  latestVerdict,
  hasEvidence,
  autonomous = false,
  factsAgeMs = null,
}) {
  const status = goal.goal_status ?? "";
  if (goal.tier === "spike") return null;
  const complete = /^complete/.test(status);
  const parked = /^blocked-on-/.test(status);
  if (!complete && !parked) return null;
  if (complete && latestVerdict !== "PASS" && !hasEvidence) return null;

  // `ticket:retro` ran moments ago and the retro agent has not written yet: it is in progress,
  // and blocking the stop now would only burn a turn while the agent works.
  if (!retro && factsAgeMs !== null && factsAgeMs < RETRO_IN_PROGRESS_MS) return null;
  if (!retro) return complete ? "finished, no RETRO.md" : "parked, no RETRO.md";
  if (complete && retro.outcome === "parked")
    return "finished after a parked retro: the retro must cover the whole ticket";
  if (!retro.applied) return "RETRO.md written, actions not applied";
  if (retro.applied === "deferred" && !autonomous) return "night retro, actions deferred";
  return null;
}

/** Interactive only: a merged night retro waiting to be applied, wherever it sits. */
export function deferredRetro(retro, autonomous) {
  return !autonomous && retro?.applied === "deferred";
}

/** The instruction the Stop hook hands back. One block per ticket list, same text every time. */
export function retroInstruction(due, autonomous = false) {
  const list = due.map((d) => `  - ${d.ticket}: ${d.why}`).join("\n");
  const apply = autonomous
    ? `  3. Apply nothing (night lane). Set \`applied: deferred\` in RETRO.md's front matter; the next
     interactive session applies it.`
    : `  3. Apply its actions by the automatic policy: memory-* applied; additive skill-edits applied,
     a removal or loosening held; gate -> a new reserved ticket GOAL.md, never built.
  4. Append "## Applied" to RETRO.md and set \`applied: <YYYY-MM-DD>\` in its front matter.`;
  return `Retro due — a ticket this session finished or parked has no applied retrospective:
${list}

Do it now, without asking the user (gsd-goal-loop references/retro.md, "Automatic"):
  1. Gather the facts from .planning/tasks/<ID>/ (GOAL Iteration Log, FROZEN.json history, LOOP-VERIFY,
     REVIEW.md, research/) — no ticket:retro CLI yet, MF-0080   (skip if RETRO.md exists and only step 3 is pending)
  2. Agent(retro) with the ticket ID — it writes RETRO.md.
${apply}
Then end the turn with one line per ticket: what was applied, what was held.`;
}
