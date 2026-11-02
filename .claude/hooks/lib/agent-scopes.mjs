/**
 * PT-0352 — what each role agent may write. Pure; `agent-scope.mjs` is the PreToolUse hook that
 * applies it, keyed on the `agent_type` field Claude Code adds to hook input inside a subagent.
 *
 * The split that matters: the agent that writes the acceptance tests is never the one that makes
 * them pass, reviewers and researchers write only their own report, and no role agent can touch
 * receipts, gates, hooks or settings — the things that decide whether work counts as done.
 *
 * The main session and agents not listed here are unrestricted by this hook (PT-0315's guard
 * still applies to everyone). Bash writes are not seen by an Edit/Write hook; `ticket:eval`'s
 * scope check catches those after the fact against the plan's `owns`.
 */
import { globToRegExp } from "../../../scripts/lib/ticket-eval.mjs";

const TASK = ".planning/tasks/*";

/** @type {Record<string, string[]>} agent type -> writable globs */
export const SCOPES = {
  "ticket-planner": [`${TASK}/LOOP-PLAN.md`, `${TASK}/GOAL.md`],
  "acceptance-writer": ["**/__tests__/**", "e2e/**", `${TASK}/LOOP-VERIFY.md`],
  "schema-builder": [
    "src/server/db/**",
    "drizzle/**",
    "supabase/**",
    "supabase-test/**",
    `${TASK}/LOOP-PLAN.md`,
  ],
  "service-builder": [
    "src/server/services/**",
    "src/server/authz/**",
    "src/lib/**",
    "src/types/**",
    "src/i18n/**",
    "src/modules/*/actions.ts",
    "src/modules/*/actions/**",
    `${TASK}/LOOP-PLAN.md`,
  ],
  "ui-builder": [
    "src/modules/**",
    "src/app/**",
    "src/components/**",
    "src/i18n/**",
    "src/lib/**",
    `${TASK}/LOOP-PLAN.md`,
  ],
  verifier: [],
  "diff-reviewer": [`${TASK}/REVIEW.md`],
  researcher: [`${TASK}/research/**`],
  "research-interpreter": [`${TASK}/research/**`],
};

/** Never writable by a role agent, whatever its globs say. */
const NEVER = [
  ".planning/evidence/**",
  `${TASK}/FROZEN.json`,
  ".claude/**",
  "scripts/**",
  ".github/**",
  ".husky/**",
  "package.json",
  "pnpm-lock.yaml",
].map(globToRegExp);

const compiled = Object.fromEntries(
  Object.entries(SCOPES).map(([k, globs]) => [k, globs.map(globToRegExp)]),
);

/**
 * @param {string | undefined} agentType
 * @param {string} rel repo-relative POSIX path
 * @returns {string | null} why the write is refused, or null when allowed
 */
export function scopeDecision(agentType, rel) {
  if (!agentType || !(agentType in compiled)) return null;
  // Builders' own unit tests sit under __tests__ in their area; the e2e tree is acceptance-only.
  if (NEVER.some((re) => re.test(rel))) {
    return `${agentType} may not write ${rel}: receipts, frozen manifests, hooks, scripts, CI and package files decide what counts as done`;
  }
  if (compiled[agentType].some((re) => re.test(rel))) return null;
  const allowed = SCOPES[agentType];
  return `${agentType} may not write ${rel}. Its scope is ${allowed.length ? allowed.join(", ") : "read-only"}. If the plan needs this file, report it back to the orchestrator instead of working around the scope.`;
}
