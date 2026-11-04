---
ticket: MF-0013
outcome: pass
causes: known-trap-repeated, missing-context, tooling, wrong-plan
actions: skill-edit, gate
lesson_keys: stop-hook-windows-spawn, plan-assigns-forbidden-paths, server-owns-clock-and-read-hash, count-by-parsed-structure
applied: 2026-11-04
---
## Numbers
Hand-off, receipt DONE, tier high-risk. Review 1 had 2 blocking findings (B1 client clock finished the storm, B2 answer echoed stored hash). No `pnpm ticket:retro`; facts from GOAL, LOOP-PLAN, REVIEW and the orchestrator.

## Went right
- Test-first fix of the Windows `toRel` hook bug, approved by the user. Already is: `src/test/__tests__/gate-io-to-rel.test.ts`.
- Reviewer caught B1/B2 and the wrong `as string` argument that tests could not see. Keep: reviewer stays mandatory for high-risk.
- The DB fixture failure at freeze (wrong question count) was caught before freeze.

## Went wrong
- Plan assigned `scripts/sync-question-keys.mjs` and `.planning/evidence/**` to role agents, which `agent-scopes.mjs` forbids. The orchestrator did both by hand. cause: wrong-plan
- B2: the DESIGN rule on content hashes existed, but the plan's mapper used the stored hash. B1: the clock was trusted from the client. cause: known-trap-repeated
- Researcher counted 270 questions by counting `- id:` lines (options included); the real number is 53. cause: missing-context
- Stop hook `stop-gate.mjs` spawn ENOENT again (same key as MF-0008). MF-0023 owns it. cause: tooling
- A ui-builder ran `git stash push` then `git stash pop`, which applied the user's MF-0008 stash. cause: missing-context

## Actions (at most two)
1. gate: `.claude/hooks/lib/gate-core.mjs` plan check, run when LOOP-PLAN.md is frozen. Parse the "Files"/owner table and flag any path matched by the forbidden globs in `.claude/hooks/lib/agent-scopes.mjs` (`scripts/**`, `.planning/evidence/**`) that is assigned to a role agent. It would have flagged `scripts/sync-question-keys.mjs` under schema-builder and the evidence file under T6. Would have saved: two manual orchestrator detours and a re-plan.
2. skill-edit: `.claude/skills/gsd-goal-loop/references/templates.md`, in the LOOP-PLAN template's Divergences/risks section, add this checklist line: "Server-owned facts: time and hashes come from the server read (never the client clock, never the stored hash). Counts come from a parsed structure, not grep. Subagents never run `git stash`." Would have saved: review 1 blocking findings B1/B2, the 270-vs-53 fixture failure and the stash conflict.

## Not worth changing
- Stop hook spawn failure: MF-0023 is reserved.
- Start trust asked after the SCs were confirmed: one-off, ordering of the user's confirmation.
- The `as string` mistake: the reviewer's correction already settles it (trailing defaults keep the signature).

## Applied

2026-11-04, automatic policy:
- Action 1 (gate): reserved as **MF-0024** (`.planning/tasks/MF-0024/GOAL.md`, goal_status: reserved). Not built: gates and hooks are guarded config.
- Action 2 (skill-edit, additive): applied in `.claude/skills/gsd-goal-loop/references/templates.md`, LOOP-PLAN template, under "Riskiest step" (server-owned clock and read hash, parsed counts, owns vs NEVER globs, no git stash in builders).
- Held: nothing.
