---
ticket_id: MF-0048
title: "Plan check: task owns vs agent NEVER scopes"
tier: high-risk                   # edits scripts/lib/ticket-eval.mjs (guarded gate lib) and .claude/hooks/lib/agent-scopes.mjs (hook)
stage: handoff
branch: feat/MF-0048
builds_on: [MF-0013]
last_iteration: 0
goal_status: complete-pending-manual-commit
track: P
week: W3
depends_on: []
---

> Reserved by the MF-0013 retro (2026-11-04, lesson `plan-assigns-forbidden-paths`) as MF-0031; a merge concatenated it into the prod-prompting MF-0031 GOAL, split out and renumbered MF-0048 by MF-0024 intake on 2026-11-05. Picked up 2026-11-06.

## Objective

Today a LOOP-PLAN can give a role agent a path that `.claude/hooks/lib/agent-scopes.mjs` never lets it
write (`NEVER`: `scripts/**`, `.planning/evidence/**`, `.claude/**`, package files, FROZEN.json). MF-0013's
plan gave `scripts/sync-question-keys.mjs` to schema-builder and the evidence file to T6; both were found
only when the builder was about to write.

End state: the plan check (`validatePlan` in `scripts/lib/ticket-eval.mjs`) reports any task whose `owns` glob can
match a NEVER glob for a role agent.

## Facts (re-derived at pickup, 2026-11-06)

- F-1: `validatePlan` is called only by `evaluateTicket`, which has no caller: `package.json` has no `ticket:eval`
  script, and `scripts/` has no eval CLI. A rule added only there does not run before BUILD.
- F-2: shipped plans use `"agent": "inline"` (e.g. MF-0001, MF-0043, MF-0044) or `"orchestrator"` (3 plans, incl.
  MF-0046) for main-session steps. `PLAN_AGENTS` rejects both as `unknown agent`.
- F-3: a read-only probe of the drafted rule over all 42 shipped LOOP-PLANs finds about 70 role-agent tasks that own a
  NEVER path, MF-0013 T1/T6 among them (proof-case replay: RED). The MF-0046 T1 service-builder task owning
  `scripts/check-workspace.mjs` is another. These are findings on records that already shipped. Nothing reruns them.
- F-4: MF-0060 (#94, another contributor's, W-range MF-0060..68) plans to export the NEVER list from
  `agent-scopes.mjs` and to wire an owns-vs-scope check into `pnpm gate:planning`.

## Success Criteria (draft)

- [x] SC-1: `validatePlan` returns an error naming the task, the agent and the path for a role-agent `owns` entry that
  can match a NEVER glob: an exact path (`scripts/x.mjs`), a glob inside one (`scripts/generate/**`), or a glob that
  covers one (`**/*.json` covers `package.json`). Proof: unit test.
- [x] SC-2: MF-0013's original task graph (from `.planning/tasks/MF-0013/LOOP-PLAN.md`) yields exactly two NEVER
  errors: T1 schema-builder `scripts/sync-question-keys.mjs` and T6 service-builder `.planning/evidence/MF-0013.md`.
  Proof: unit test that reads the shipped plan.
- [x] SC-3: main-session tasks (`agent: "inline"` or `"orchestrator"`) may own NEVER paths and pass, and are no longer
  `unknown agent`. A plan with main-session steps described outside the JSON graph also passes. Proof: unit test.
- [x] SC-4: one owner for the NEVER list: `validatePlan` and `scopeDecision` read the same exported list from
  `agent-scopes.mjs`, and `scopeDecision`'s behaviour is unchanged. Proof: unit test (same list) +
  `node scripts/check-hooks.mjs` PASS.

## Constraints → how met

- Hooks and gate libs are guarded → the user approves at this checkpoint, and each guarded edit prompts.
- One NEVER owner → export it from `agent-scopes.mjs` (SC-4).
- Gate parsers fail closed (verification.md §4) → a role-agent `owns` glob whose overlap with NEVER cannot be decided
  is an error, not a pass.

## Concerns

| # | Concern | Owner | Status |
|---|---|---|---|
| C-1 | Enforcement (F-1): with no caller, the rule protects nothing until something runs it. Wiring it into `gate:planning` is MF-0060's item 1, which belongs to the other contributor. | user | resolved 2026-11-06 (user): library only; MF-0060 wires it |
| C-2 | Accept `inline` and `orchestrator` as plan agents, exempt from NEVER (F-2)? | user | resolved 2026-11-06 (user): accept both |
| C-3 | Shared file with MF-0060 (F-4): both export NEVER from `agent-scopes.mjs`. If MF-0048 lands first, MF-0060 reuses the export. | user | resolved 2026-11-06 (user): plan approved; tell MF-0060's owner in the hand-off |

## Iteration Log

- 2026-11-06 · intake→design · claimed (#78 In Progress). proof-case replay: RED (MF-0013 T1 and T6 hit NEVER in a
  read-only probe; F-3).
- 2026-11-06 · design→plan · checkpoint: C-1 library only, C-2 accept inline+orchestrator, plan approved (high-risk).
  design preflight: `pnpm typecheck` exit 0, `pnpm lint` exit 0, `pnpm test` exit 0 (on e60c02a, main CI checks
  success); `node scripts/check-hooks.mjs` PASS; no proof command wipes shared state.
- 2026-11-06 · build→test · frozen RED 4/4 (sha ddf97c77…), then green. Review round 1 changes-requested (B1 owns
  syntax was a blocklist, B2 main-session exemption skipped syntax): 11 RED-first cases, then an allowlist
  (OWNS_SEGMENT), syntax for every task, NEVER compared lowercased, NEVER_GLOBS frozen; brace sets expanded (RED 1/1
  first). Round 2 approve (reviewed_hash 32a1f79e…). Receipt: typecheck 0, lint 0, gate:planning + gate:workspace
  PASS, check-hooks PASS, pnpm test 179 files / 992 tests passed.
- 2026-11-06 · test→handoff · library only (C-1); MF-0060 wires it into gate:planning.
