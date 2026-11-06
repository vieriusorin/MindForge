---
ticket_id: MF-0060
title: "gate:planning: plan owns must fit each agent's scope, and every changed file must be owned"
tier: high-risk                   # a gate script (scripts/lib/*-check.mjs)
stage: intake
branch: MF-0060
builds_on: [MF-0058]
last_iteration: 0
goal_status: reserved             # RETRO gate action; never built automatically
---

> Reserved 2026-11-06 from MF-0058 RETRO (action 1, gate). Second occurrence of the lesson
> `plan-assigns-forbidden-paths` (first: MF-0013). Built only when the user picks it up.

## Objective

**Today.** `pnpm gate:planning` (`scripts/check-planning.mjs`, `scripts/lib/planning-check.mjs`) checks GOAL.md shape and
the design preflight line, but not the LOOP-PLAN task graph against the role agents' write scopes. The written rule
(`.claude/skills/gsd-goal-loop/references/templates.md`, LOOP-PLAN shape) is advisory. In MF-0058 the plan gave T4
(`service-builder`) `owns` of `src/features/paths/{schemas,types}.ts`, which `SCOPES["service-builder"]` in
`.claude/hooks/lib/agent-scopes.mjs` refuses (the write was blocked mid-BUILD and moved to T6), and three changed files
(`src/features/paths/utils/path-display.ts` + its test, `.claude/rules/code-conventions.md`) sat in no task's `owns`
(MF-0058 REVIEW should-fix 3).

**End state (draft, for DESIGN).** A `checkPlanOwns` rule in `scripts/lib/planning-check.mjs`, run by `pnpm gate:planning`:
1. for every ticket past `stage: plan`, parse the LOOP-PLAN ```json tasks array; fail when an `owns` glob of a role-agent
   task falls outside `SCOPES[task.agent]` or inside `NEVER` (export `NEVER` / an `isNeverWritable` helper from
   `agent-scopes.mjs`); orchestrator-run tasks are named as such and exempt;
2. for tickets at `complete-pending-manual-commit`, fail when a file in `git diff main --name-only` (plus untracked)
   matches no task's `owns`, excluding `.planning/**` and `package.json`.

## Proof case (re-derive at pickup)

- `.planning/tasks/MF-0058/LOOP-PLAN.md`, task T4 `owns` → must turn RED.
- MF-0058's hand-off tree: `src/features/paths/utils/path-display.ts`, `.claude/rules/code-conventions.md` → RED for rule 2.
- yield: unmeasured. At DESIGN, run the drafted rule read-only over every existing LOOP-PLAN and list its hits as findings
  (the first run of a new check is a review of existing content).

## Open questions (user)

1. Rule 2 needs `git` in the gate: acceptable in CI (shallow clone has no `main`), or local-only / skipped without `main`?
2. How does a plan mark an orchestrator task so it is exempt (an `agent: "orchestrator"` value, or the existing
   "(orchestrator)" title convention)?
3. Grandfathering: tickets already past `plan` before this gate — exempt by number (like MF-0053's "after MF-0052")?

## Out of Scope

- Changing the scope hook or `SCOPES` themselves.
