---
ticket_id: MF-0031
tier: normal                      # dev tooling: plan check; no app code
stage: intake
branch: main
builds_on: [MF-0013]
last_iteration: 0
goal_status: reserved             # created by the MF-0013 retro (gate action); never built automatically
track: P
week: W3
depends_on: []
---

> Reserved by the MF-0013 retro (2026-11-04, lesson `plan-assigns-forbidden-paths`).

## Objective

Today a LOOP-PLAN can give a role agent a path that `.claude/hooks/lib/agent-scopes.mjs` never lets it
write (`NEVER`: `scripts/**`, `.planning/evidence/**`, `.claude/**`, package files, FROZEN.json). MF-0013's
plan gave `scripts/sync-question-keys.mjs` to schema-builder and the evidence file to T6; both were found
only when the builder was about to write.

End state: the plan check (`validatePlan` in `scripts/lib/ticket-eval.mjs`, or the freeze/plan gate in
`.claude/hooks/lib/gate-core.mjs`) reports any task whose `owns` glob matches a NEVER glob for its agent,
before BUILD starts.

## Success Criteria (draft)

- [ ] SC-1: `validatePlan` returns an error naming the task, the agent and the path for an `owns` entry that matches a NEVER glob. Proof: unit test.
- [ ] SC-2: MF-0013's original task graph (schema-builder owning `scripts/sync-question-keys.mjs`, service-builder owning `.planning/evidence/MF-0013.md`) yields both errors. Proof: unit test with that fixture.
- [ ] SC-3: a plan with orchestrator-owned steps outside the JSON graph passes. Proof: unit test.

## Constraints

- Hooks and gate scripts are guarded config: the user approves the change.
- One owner for the NEVER list: import it from `agent-scopes.mjs`, don't copy it.
