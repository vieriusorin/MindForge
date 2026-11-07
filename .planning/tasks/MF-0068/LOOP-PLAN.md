---
phase: 0-planning
ticket_id: MF-0068
status: executing
verdict: IN_PROGRESS
started_at: "2026-11-06"
resume_with: /gsd-goal-loop
---

# Loop Plan — Iteration 0

## Discovery summary

- The seed is `scripts/dev-seed.ts` (CLI) → `planDemoWorlds` (`src/dev-seed/plan-demo-world.ts`, pure) →
  `seedDemoWorlds` (`src/dev-seed/seed-demo-world.ts`, writes). Precedent: MF-0052 added storms/expeditions as new
  plan fields + guards that run for all worlds before the first delete and again inside the transaction.
- Demo users are deleted by email suffix through the admin API; every path table (`path_enrollments`,
  `course_completions`, `group_members`, groups via `created_by`) cascades from `auth.users`, so path personas on
  the demo domain are replaced by the same delete. Your rows are touched only through the manifest ids.
- `private.path_courses` is the registry `create_path_group` / `advance_group_course` read; `db:sync-keys` writes it.
- Gates: `src/dev-seed/**` sits on no allowlist; frozen MF-0029/0034/0052/0054 tests call `planDemoWorld(s)` /
  `seedDemoWorlds` directly and pin 5 demo learners per world.

## Symbols changed

- `seedDemoWorlds` gains an optional input for the path plan (absent = old behaviour; no caller changes).

## Frozen files this will re-freeze

None needs a new expected value. `pnpm ticket:collisions MF-0068` lists these call sites of `seedDemoWorlds`; each
was read and still holds, because none passes a path plan, so the old behaviour and every count they assert is
unchanged:

| File:line | Change (new expected value) | Reason |
|---|---|---|
| `src/dev-seed/__tests__/mf-0034-seed.db.acceptance.test.ts:17` | none (still holds: 5 demo users, one group per pack) | no path plan passed |
| `src/dev-seed/__tests__/mf-0052-regressions.db.acceptance.test.ts:18` | none (still holds: SC-3 storm counts) | no path plan passed |
| `src/dev-seed/__tests__/mf-0052-seed.db.acceptance.test.ts:30` | none (still holds: 6 joins, 5 demo learners) | no path plan passed |
| `src/dev-seed/__tests__/mf-0054-seed-pins.db.acceptance.test.ts:20` | none (still holds: your pins) | no path plan passed |

## SC coverage

| SC | Steps | Proof |
|----|-------|-------|
| SC-1..SC-4 | 1 | `mf-0068-plan.acceptance` SC-1..SC-4 |
| SC-5 | 1, 2 | `mf-0068-plan.acceptance` SC-5 (a, b) |
| SC-6..SC-8 | 3 | `mf-0068-seed.db.acceptance` (pnpm test:db) |
| SC-9 | 4, 5 | real `pnpm dev:seed` run; `mf-0068-runbook.acceptance` |
| SC-10 | 6 | gates + browser screenshots |

## Steps

1. `src/dev-seed/plan-path-scenarios.ts` — `planPathScenarios`: own PRNG `createRandom(seed ^ 0x0068)`; per-persona
   schedules in days before `now` (fresh: enrolled 2 h ago, no answers; halfway: day 2, half the questions of the
   first half of course 1's skills; midpath: courses 1–2 two correct sessions a day apart, course 3 one correct per
   first-domain skill; finisher: all five courses complete; lapsed-path: course 1 on days 40/39, course 2 partial on
   day 36; crammer-path: 10 correct per course-1 skill on day 2). Completion = last answer + 1 min, asserted with
   `isCourseComplete` at that time; every persona target re-checked with `pathProgress` before return (throws).
   Two path groups on course 1. Refuses a demo domain equal to your email's domain and any row with your email.
2. `src/dev-seed/plan-seed.ts` — `planSeed`: `planDemoWorlds` unchanged, then the first path (by slug) whose
   courses are all among the packs; others listed in `skippedPaths`.
3. `src/dev-seed/seed-demo-world.ts` — `paths`: pure checks (demo domain, never you, no clash with world learners)
   and DB checks (registry order equals the plan's path, every course pack registered, every planned answer a synced
   question of its pack and skill, not rejected) run before the first delete and again inside the transaction; then
   create the six users, write enrollments, answers, completions, path groups and members in the same transaction.
4. `scripts/dev-seed.ts` — load `paths/*.yaml`, call `planSeed`, pass `paths`, print personas, groups, skipped paths.
5. `docs/runbook/dev-seed.md` — the path personas table (account, what it shows) and both groups.
6. TEST: full ladder; `pnpm db:reset` + `pnpm dev:seed` + browser as fresh, midpath, finisher.

## Riskiest step

Step 3, the writes on a re-runnable seed. State the seed does NOT own that survives a re-run or `pnpm db:reset`:

- (a) ids kept on disk: none added. The manifest still holds only your seeded attempt/storm ids; path rows live on
  demo users and go with them. After `db:reset` everything is gone and the registry is re-synced by the reset.
- (b) decisions of other actors between runs: your hand-made enrollment, completion and answers (SC-7, RED shown
  against a variant that enrolls you in the trio); items a maintainer rejected or a real user flagged
  (`listSeedExcludedItems` feeds the planner; the guard refuses a rejected question); hand-played answers of a demo
  persona are replaced by design (runbook).
- (c) failure order: every path check runs with the world checks before the first `deleteUser`, and again inside
  the transaction. SC-8 makes the second input bad (registry order; your email) and asserts the first run's users,
  groups and completions keep their ids (RED shown against a variant that checks after the delete).

## Rejected options

- Add the personas to `PERSONAS` / the pack worlds — shifts every PRNG draw and breaks five frozen count files.
- A second script for paths — two seeders, and a failure in the second leaves a half-replaced world.
- Insert through `create_path_group` / `join_group` RPCs — need a session per persona and cannot backdate.
- Put you in the trio — "nothing path-related on your account" (C-1).

## Verify

- `pnpm typecheck && pnpm lint && pnpm test`, `pnpm test:db`, `pnpm gate:planning`, `pnpm gate:workspace`,
  `pnpm build` (no ticket:verify script; receipts by hand in LOOP-VERIFY.md).
- browser: `/paths/claude-developer` as fresh / midpath / finisher; the trio's group page as fresh.

## Tasks

```json tasks
[
  { "id": "T1", "title": "path planner + planSeed + inner tests", "agent": "orchestrator",
    "owns": ["src/dev-seed/plan-path-scenarios.ts", "src/dev-seed/plan-seed.ts", "src/dev-seed/types.ts", "src/dev-seed/__tests__/**"],
    "depends_on": [], "closes": ["SC-1", "SC-2", "SC-3", "SC-4", "SC-5"],
    "done_when": ["pnpm vitest run src/dev-seed/__tests__/mf-0068-plan.acceptance.test.ts", "pnpm typecheck"],
    "context": ["skill:typescript-strict", "skill:testing-strategy"] },
  { "id": "T2", "title": "seeder writes + guards", "agent": "orchestrator",
    "owns": ["src/dev-seed/seed-demo-world.ts"],
    "depends_on": ["T1"], "closes": ["SC-6", "SC-7", "SC-8"],
    "done_when": ["pnpm test:db"],
    "context": ["skill:supabase-postgres-best-practices"] },
  { "id": "T3", "title": "CLI + runbook", "agent": "orchestrator",
    "owns": ["scripts/dev-seed.ts", "docs/runbook/dev-seed.md"],
    "depends_on": ["T2"], "closes": ["SC-9"],
    "done_when": ["pnpm dev:seed", "pnpm vitest run src/dev-seed/__tests__/mf-0068-runbook.acceptance.test.ts"],
    "context": [] },
  { "id": "T4", "title": "verify: full ladder, build, browser, LOOP-VERIFY", "agent": "orchestrator",
    "owns": [".planning/tasks/MF-0068/LOOP-VERIFY.md"],
    "depends_on": ["T3"], "closes": ["SC-10"],
    "done_when": ["pnpm typecheck && pnpm lint && pnpm test", "pnpm test:db", "pnpm build", "pnpm gate:planning", "pnpm gate:workspace"],
    "context": [] }
]
```
