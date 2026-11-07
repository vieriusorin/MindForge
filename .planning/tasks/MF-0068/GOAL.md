---
ticket_id: MF-0068
title: "Seed learning-path scenarios: six named demo learners and two path groups (slice B)"
tier: high-risk                   # seed writes and deletes, re-runnable
stage: handoff
branch: MF-0068
builds_on: [MF-0058, MF-0062]
last_iteration: 0
goal_status: complete-pending-manual-commit             # reserved by MF-0062 (council split, user decision D-1); picked up with /gsd-goal-loop MF-0068
---

> Reserved 2026-11-06 from MF-0062 (learning-path council, split slice). Decisions D-1..D-6 and findings live in
> `.planning/tasks/MF-0062/GOAL.md`; re-derive each fact at pickup (`## Facts`) before asking the user.

## Objective

**Today.** `pnpm dev:seed` builds one demo group per pack with five demo learners (steady, crammer, lapsed, new,
strong) and you. Nobody is enrolled in a learning path, no course completion is recorded, no group follows a path, and
every group has five others, so the path screen (`/paths/claude-developer`) only ever shows "not started" and the
group heatmap's "Not enough data yet" state is never seen.

**End state.** The same `pnpm dev:seed` also seeds six path personas on the demo domain, each enrolled in
`claude-developer` and each in a different path state the screen can show (fresh, halfway, midpath, finisher,
lapsed+path, crammer+path), plus two path groups: one with six members (heatmap ready, expeditions allowed) and one
of three (heatmap "not enough others"). Every persona's state is checked through the engine before anything is
written; the existing demo world is unchanged draw for draw; nothing path-related lands on your own account; a
re-run, a bad input and a `pnpm db:reset` keep the rules the seed already keeps. (Title: six personas + two groups.)

## Facts (re-derived 2026-11-06 from source)

- **Existing personas** (`src/dev-seed/types.ts:6`): `steady, crammer, lapsed, new, strong, you`. Five demo
  learners + you per pack world (`plan-demo-world.ts:342`). Frozen tests pin those counts: `mf-0029-plan` (6
  learners), `mf-0029-seed.db` (5 users, 6 members), `mf-0034-seed.db` (5 demo users), `mf-0052-*` (5 demo
  learners, 6 joins). They call `planDemoWorld(s)` / `seedDemoWorlds` directly with run-scoped demo domains.
- **PRNG order** (`plan-demo-world.ts:341`): one `createRandom(seed)` per pack world, drawn by learners in
  `DEMO_PERSONAS` order then `you`, then `planReviews`; storms use a second stream `createRandom(seed ^ 0x0052)`.
  Adding learners to the world would shift every later draw; a separate stream (`seed ^ 0x0068`) for the path
  personas, planned after the worlds, leaves all world draws as they are.
- **MF-0058 tables** (`supabase/migrations/20261106120000_mf0058_paths.sql`): `public.path_enrollments (user_id,
  path_slug, started_at)` and `public.course_completions (user_id, pack_slug, completed_at, pack_version)`, both
  `on delete cascade` from `auth.users`. Course complete = every skill at Sapling or above (`isCourseComplete`,
  wilting counts); a recorded completion stays complete whatever the live forest shows (`pathProgress`).
- **MF-0059 adds** (`20261106140000_mf0059_path_groups.sql`): `groups.path_slug`, the private registry
  `private.path_courses (path_slug, position, pack_slug)` written only by `db:sync-keys` (which `db:reset` runs);
  `create_path_group` sets `pack_slug` = the course at position 1 and enrolls the creator; `join_group` enrolls a
  new member of a path group. Expeditions need ≥ 4 members.
- **Path** `paths/claude-developer.yaml`: `ai-capabilities, platform-foundations, claude-code-in-action,
  agent-skills, subagents`, all `kind: course` with questions.
- **Heatmap threshold** (`src/engine/forest/group-heatmap.ts:17`, MF-0011 C-3 / MF-0021 SC-7):
  `MIN_OTHER_CONTRIBUTORS = 3` members OTHER than the viewer with at least one remembered skill; the viewer is never
  pooled. A three-member group therefore always shows "Not enough data yet" to every member.
- **ts-fsrs probe** (2026-11-06, `memoryBySkill` + `treeStage`, now = 2026-11-06T12:00Z): 1 correct 2 d ago →
  2.31 d, R 0.909 sprout; 10 correct on one day 2 d ago → 2.31 d, R 0.947 sprout (council probe holds); 2 correct
  8 d / 7 d ago → 7.32 d, R 0.903 sapling; 2 correct 40 d / 39 d ago → 7.32 d, R 0.754 sapling wilting; 1 correct
  36 d ago → 2.31 d, R 0.650 sprout wilting.
- **Runbook** `docs/runbook/dev-seed.md` lists the five demo accounts; nothing about paths.
- **"Halfway"** (D-4): lesson progress is derived, so halfway = some of a skill's questions answered, no stored row.

## Affected

- **Roles:** developers and reviewers on the LOCAL stack only (demo accounts). No app code, no schema.
- **Surfaces:** `scripts/dev-seed.ts`, `src/dev-seed/**` (new `plan-path-scenarios.ts`, `seedDemoWorlds` gains an
  optional `paths` input), `docs/runbook/dev-seed.md`. Tables written: `auth.users` (demo), `profiles`,
  `path_enrollments`, `course_completions`, `attempts`, `groups` (+ `path_slug`), `group_members`.

## Constraints

- Local only → the existing `assertLocalSeedTarget` guard runs first; nothing new reaches a hosted project.
- One seeder → the path plan rides in the same `seedDemoWorlds` call and transaction; no second script.
- Existing personas unchanged → path personas are a separate list planned from their own PRNG stream after the
  worlds; `planDemoWorld(s)` is not edited (SC-5).
- Nothing path-related on your account → planner and seeder both refuse a path row carrying your email (SC-1, SC-8).
- Failure order (SKILL.md DESIGN c) → the path checks run with the world checks before the first delete and again
  inside the transaction (SC-8).
- Figures over other people's data (heatmap, SC-4): the seed adds no figure; it only places members. What the viewer
  can deduce is unchanged from MF-0021: (a) the threshold counts others than the viewer (`MIN_OTHER_CONTRIBUTORS`
  read from the engine, not restated); (b) no count is shown; (c) worked example at the minimum: in the trio, Flora
  (fresh, viewer) sees 2 others who played → "Not enough data yet"; Hana (halfway) sees Flora (no memory, not a
  contributor) + Cora → 1 → not enough; in the six-member group every viewer sees ≥ 4 others who played → ready.
  (d) viewer invariance is MF-0021's frozen proof, not re-tested here.
- Engine owns figures → every persona target is asserted through `memoryBySkill`, `buildForest`,
  `isCourseComplete`, `pathProgress`, `summarizeGroupHeatmap`; the seed hard-codes no stage or percent.

## Decided by the user (2026-11-06, run brief)

- **U-1 Merge:** the orchestrator commits, pushes, opens the PR and merges. This session never commits.
- **U-2 Approvals:** high-risk plan approved by the orchestrator agent; a fresh-context diff reviewer runs before
  merge. `pnpm db:reset` on the LOCAL stack is allowed under the db lock. Never a hosted project.

## Decided without a question

- **"You + 2" = the viewer + 2 others, on a path group of path personas** (Flora Fresh + Hana Halfway + Cora
  Crammer), not the author's account — follows from this GOAL's "nothing path-related on the author's own account"
  and the council's "small path group" (MF-0062 seed gaps). The author sees it by signing in as `fresh@…`. Recorded
  as C-1 for the orchestrator to overturn if wanted.
- **Path personas are not members of the pack demo groups** → the frozen MF-0029/0034/0052 counts (5 demo
  learners, 6 members) hold; follows from the PRNG rule and those frozen files.
- **Which path:** every `paths/*.yaml` whose courses all have seed inputs this run, sorted by slug (today one:
  `claude-developer`). A `--pack`-narrowed run that lacks a path course plans no path scenarios and says so — follows
  from the existing rule that a narrowed run replaces the whole demo world (runbook "Run it").
- **Group pack:** both path groups sit on the path's first course (`ai-capabilities`), as `create_path_group` does;
  every member is enrolled, as `join_group` would do (MF-0059 1.9/1.10).
- **Completed_at** = one minute after the persona's last answer that made the course complete, the moment the
  MF-0058 recorder would have written it; `pack_version` = the pack file's `version`.
- **No storms, expeditions or reviews for path personas** — not named by the brief (YAGNI); expeditions remain
  startable by the big group's admin by hand.
- **Display names** ≤ 60 chars, alliterative like the existing ones: Flora Fresh, Hana Halfway, Mira Midpath, Felix
  Finisher, Luca Lapsed, Cora Crammer. Emails `fresh@`, `halfway@`, `midpath@`, `finisher@`, `lapsed-path@`,
  `crammer-path@` on the demo domain (no clash with `lapsed@`, `crammer@`).

## Success Criteria

- [x] SC-1: `planPathScenarios` plans exactly six learners with emails `<p>@<demoDomain>` for p in `fresh, halfway,
  midpath, finisher, lapsed-path, crammer-path` (that order), each enrolled once in `claude-developer`, and no
  learner, enrollment, attempt, completion or group member carries your email; a demo domain equal to your email's
  domain throws. Proof: `src/dev-seed/__tests__/mf-0068-plan.acceptance.test.ts` SC-1.
- [x] SC-2: replayed through the engine at the plan's `now` (test's own `memoryBySkill` + `buildForest` +
  `isCourseComplete` + `pathProgress`): fresh → 0 answers, completedCount 0, `next` ai-capabilities, every course
  not-started; halfway → course 1 in-progress, courses 2–5 not-started, no completion, and some skill of course 1
  with 0 < questions answered < that skill's question count; midpath → completions exactly ai-capabilities and
  platform-foundations, course 3 in-progress, 4–5 not-started, nextPosition 3; finisher → 5 completions,
  isPathComplete true, completedPercent 100; lapsed-path → completion ai-capabilities only, every ai-capabilities
  tree at Sapling or above AND wilting, no answer in the last 30 days, course 2 in-progress, nextPosition 2;
  crammer-path → no completion, course 1 in-progress, every answered course-1 skill a Sprout, some skill with ≥ 10
  correct answers inside one 24 h window. Proof: `mf-0068-plan.acceptance` SC-2 (one `it` per persona).
- [x] SC-3: every planned completion is true when written: `isCourseComplete` over that persona's answers in that
  pack up to `completedAt`, replayed at `completedAt`, is true; `completedAt < now`; `packVersion` = the pack's
  `version`; each enrollment's `startedAt` ≤ the persona's first answer and every answer < now. Proof:
  `mf-0068-plan.acceptance` SC-3.
- [x] SC-4: two path groups, both `pathSlug` claude-developer and pack ai-capabilities: "Demo path group · Claude
  Developer" with all six personas (≥ 4), and "Demo path trio · Claude Developer" with fresh, halfway, crammer-path;
  every member is enrolled; `summarizeGroupHeatmap` over the planned answers gives `not-enough-data` to every trio
  member and `ready` to every member of the big group. Proof: `mf-0068-plan.acceptance` SC-4.
- [x] SC-5: the existing demo world is unchanged: (a) `planSeed` (the CLI's one planning call) returns worlds
  deep-equal to `planDemoWorlds` called alone on the same inputs; (b) a fixture world planned by `planDemoWorld` hashes
  to the sha256 recorded from the code before this ticket. Proof: `mf-0068-plan.acceptance` SC-5.
- [x] SC-6: seeding the same plan twice through `seedDemoWorlds({ …, paths })` on a run-scoped demo domain leaves, after
  each run: 5 + 6 demo users; one enrollment each in claude-developer; completions per persona fresh 0, halfway 0,
  midpath 2, finisher 5, lapsed-path 1, crammer-path 0; per-persona attempt counts equal to the plan; two path groups
  with 6 and 3 members; and each persona's `pathProgress` read back from the DB rows equals SC-2's status per course.
  Proof: `src/dev-seed/__tests__/mf-0068-seed.db.acceptance.test.ts` SC-6 (`pnpm test:db`, under the db lock).
- [x] SC-7: your account stays path-free and your hand-played state survives: with a hand-made enrollment, a hand
  completion and a hand-played answer of yours on a path course, two seeded runs leave exactly those rows (same
  values) and add no enrollment, completion or path-group membership for you. Proof: `mf-0068-seed.db.acceptance`
  SC-7; RED shown against a variant that writes a path row for you (LOOP-VERIFY "RED at freeze").
- [x] SC-8: failure order: after a good run, a second run whose path plan is unseedable (the registry's course
  order differs from the plan's path) throws naming `pnpm db:sync-keys` and leaves the first run's demo users, path
  groups, enrollments and completions as they were (same ids); a path plan carrying your email is refused before any
  delete. Proof: `mf-0068-seed.db.acceptance` SC-8.
- [x] SC-9: `pnpm dev:seed` on the local stack prints the path personas and both path groups, and the runbook lists
  every new demo account with what it shows. Proof: real run pasted in evidence; `src/dev-seed/__tests__/
  mf-0068-runbook.acceptance.test.ts` (each persona email and both group names appear in `docs/runbook/dev-seed.md`).
- [x] SC-10: gates and browser: `pnpm typecheck && pnpm lint && pnpm test`, `pnpm test:db`, `pnpm gate:planning`,
  `pnpm gate:workspace`, `pnpm build` exit 0; after `pnpm db:reset` + `pnpm dev:seed`, signed in as fresh, midpath and
  finisher, `/paths/claude-developer` shows 0 of 5 / 2 of 5 / 5 of 5, and fresh's trio group shows "Not enough data
  yet". Proof: screenshots `.planning/evidence/MF-0068/sc-10-*.png`.

### Edge inputs (SC-2, SC-4)

| Input state | Shown result | Decided by |
|---|---|---|
| no answers at all (fresh) | every course not-started, 0 of 5 | MF-0058 `pathProgress` |
| some questions of a skill (halfway) | course in-progress, not complete | D-4 (derived) |
| 10 correct on one day (crammer) | 2.31 d < 3 d Sapling threshold → Sprout, not complete | `FOREST_THRESHOLDS`, probe |
| 2 correct a day apart, 39 d ago (lapsed) | Sapling, R 0.754 < 0.85 → wilting; completion stays recorded | MF-0058 C-1 (wilting counts) |
| heatmap others = 2 (trio) | not-enough-data | MF-0011 C-3, `MIN_OTHER_CONTRIBUTORS` |
| heatmap others ≥ 3 (big group) | ready | same |
| `--pack` run without every path course | no path scenarios, one printed line | this GOAL, Decided without a question |

## Concerns

| # | Collision | Owner | Status |
|---|-----------|-------|--------|
| C-1 | Brief says "you + 2 group"; GOAL says nothing path-related on the author. Read as viewer + 2 path personas | orchestrator | resolved by agent (Decided without a question); overturn = put the author in a non-path trio |
| C-2 | MF-0061 edits pack options in parallel: tests on real packs must derive targets from pack data, not counts | agent | resolved: SC tests use the engine and pack files at run time; the fingerprint (SC-5b) uses an in-test fixture |
| C-3 | MF-0062 builds the course map in parallel; the browser check shows today's path screen only | agent | resolved: SC-10 checks MF-0058's screen |

## Out of Scope

- Storms, expeditions, reviews for path personas; timing personas (fast+wrong) — need columns D-4/D-5 declined.
- Any app, schema or engine change. The course map (MF-0062).

## Open questions

- None.

## Iteration Log

<!-- append-only -->
- 2026-11-06 reserved from MF-0062.
- 2026-11-06 picked up in worktree `/Users/sorinvieriu/Projects/mind-forge-MF-0068` on branch MF-0068 (orchestrator claimed #103).
- 2026-11-06 design preflight: `pnpm typecheck` exit 0; `pnpm lint` exit 0; `pnpm test` exit 0 (195 files, 1085 tests); `pnpm db:reset` exit 0 (local, db lock); `pnpm test:db` exit 0 (34 files, 181 tests); `pnpm dev:seed` not run: proof run in TEST; `pnpm build` not run: no app change, run in TEST; `pnpm gate:planning` / `pnpm gate:workspace` not run: run in TEST; main CI 660f1c1 success.
- 2026-11-06 freeze: 3 acceptance files hashed in FROZEN.json; RED: plan file 10 × `Error: not implemented` (SC-5b green = regression lock, fixture hash recorded from the unchanged `planDemoWorld`); db file beforeAll `Error: not implemented`; runbook `expected … to contain fresh@mindforge-demo.test`. Full `pnpm test`: only reds are the frozen files plus 3 load-timeout cases in untouched files (key-length, mf-0044, mf-0058-path-file; machine load ~18 with parallel worktrees), re-run in TEST.
- 2026-11-06 plan: LOOP-PLAN.md written; `pnpm ticket:collisions MF-0068` exit 0 (4 frozen `seedDemoWorlds` callers listed as still holding, no re-freeze).
- 2026-11-07 build: orchestrator resumed the ticket after the plan (approval per U-2); tasks re-labelled `orchestrator` for the MF-0060 scope rule (src/dev-seed/**, scripts/**, docs/** are in no role scope).
- 2026-11-07 design preflight (addendum, found by `pnpm gate:planning` in TEST): `pnpm db:sync-keys` not run on its own: SC-8 names it only as the text of the refusal message; `pnpm db:reset` (run, exit 0) runs it.
- 2026-11-07 test: plan acceptance 11/11, db acceptance 3/3 (after `pnpm db:reset`), RED variants A (SC-7) and B (SC-8) shown failing then restored; `pnpm test:db` 35 files / 184 tests exit 0; `pnpm build` exit 0; `pnpm dev:seed` run twice exit 0; browser screenshots in `.planning/evidence/MF-0068/`.
- 2026-11-07 handoff: LOOP-VERIFY PASS; evidence `.planning/evidence/MF-0068.md`; goal_status complete-pending-manual-commit.
