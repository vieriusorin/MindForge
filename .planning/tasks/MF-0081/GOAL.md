---
ticket_id: MF-0081
title: "gate:planning: every .planning/tasks folder is named MF-####"
tier: high-risk                   # a gate script (scripts/check-planning.mjs)
stage: intake
branch:
builds_on: [MF-0028, MF-0051]
last_iteration: 0
goal_status: reserved             # gate action from the MF-0051 retro; never built automatically
---

> Reserved 2026-11-09 from MF-0051 (retro gate action).

## Objective

**Today.** The MF-0059 merge (#107) committed `.planning/tasks/[ELIFECYCLE] Command failed with exit code 1./GOAL.md`.
A failed command's output was used as a folder name. `pnpm gate:planning` passed it, and its trailing dot makes the
path impossible to check out on Windows, so `git pull` on main fails there. MF-0051 removed it with a plumbing
commit (`f1a4f03`).

**End state.** `pnpm gate:planning` (`scripts/check-planning.mjs`, already in CI) fails with
`FAIL .planning/tasks/<name>: task folder must be MF-####` for any directory under `.planning/tasks` whose name does
not match `/^MF-\d{4}$/`, ignoring non-directory entries. Proof case: a fixture tasks root holding a folder named
`[ELIFECYCLE] Command failed with exit code 1.` turns it RED.

## Open questions

- At pickup: run the rule read-only over every branch's `.planning/tasks` (`git ls-tree`) and list other hits.
- Should the ticket-folder writers (`ticket-github.mjs next`, the skill) also refuse a non-matching id at creation?
