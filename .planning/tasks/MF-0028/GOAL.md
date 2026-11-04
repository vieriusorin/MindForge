---
ticket_id: MF-0028
tier: normal                      # dev tooling: a planning check in the stop gate; no app code
stage: intake
branch: main
builds_on: []
last_iteration: 0
goal_status: reserved             # created by the MF-0014 retro (gate action); never built automatically
depends_on: []
---

> Reserved by the MF-0014 retro (2026-11-04, lesson `ticket-number-collision-across-branches`).

## Objective

**Today.** Two sessions on separate branches reserved MF-0022 and MF-0023 at the same time, and merge
`71ac090` concatenated two tickets into each GOAL.md. Nothing checked the merged result; MF-0014 found
it by chance in DESIGN, which cost a user question and renumbering MF-0012's tickets (MF-0026/MF-0027).

**End state.** `scripts/check-planning.mjs`, run in the stop gate's GATES step, fails when a
`.planning/tasks/*/GOAL.md` has more than one `ticket_id:` line, or when its `ticket_id` differs from its
directory name.

## Open questions

- Hooks and gate scripts are guarded config: the user approves the hook change.
