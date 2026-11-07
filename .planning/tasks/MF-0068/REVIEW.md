---
verdict: approve
verdict_detail: "0 blocker, 0 should-fix, 5 notes, 2 nits. Re-run, failure order, PRNG, persona states, heatmap privacy and the local-only guard all hold; DB acceptance 3/3 after a fresh db:reset."
reviewed_hash: 0820183c68165231ca3101d6936b947b2cf63e378cf3f961643d17af9f9bc7a1
reviewed_at: 2026-11-07T10:18:28Z
---

# MF-0068 diff review (fresh context)

Scope: `git diff HEAD` (660f1c1) plus untracked, excluding `.planning`. Files: `scripts/dev-seed.ts`,
`src/dev-seed/{seed-demo-world,types,plan-path-scenarios,plan-seed}.ts`, `docs/runbook/dev-seed.md`, four test files.

## What I ran

- FROZEN.json: all three acceptance files match their recorded sha256.
- `vitest run` mf-0068-plan, mf-0068-runbook, plan-path-scenarios: 3 files, 17 tests passed.
- db lock acquired, `pnpm db:reset` (local), `vitest run --project db src/dev-seed/__tests__/mf-0068-seed.db.acceptance.test.ts`:
  3/3 passed (the `db` project glob `src/**/__tests__/**/*.db.*test.ts` picks the file up). Lock released.
- `pnpm typecheck` exit 0; `biome check scripts/dev-seed.ts src/dev-seed` clean.
- MF-0060 plan check (`check-planning.mjs` against this worktree): `69 ticket folders checked, ok`. Every changed
  non-`.planning` file is matched by an `orchestrator` task's `owns` (T1 owns the planner, `plan-seed.ts`, `types.ts`,
  `__tests__/**`; T2 `seed-demo-world.ts`; T3 the CLI and runbook).

## Focus questions

(a) State the seed does not own. The seed still identifies its rows in one way only: users whose email ends with
`@mindforge-demo.test` (`seed-demo-world.ts:447`). This is unchanged, and `.test` is a reserved TLD, so no real user can
hold it. Every new path row (enrollments, completions, attempts, both path groups through `groups.created_by ... on
delete cascade`, memberships) hangs off a path persona on that domain, so the existing delete removes it and nothing
else. No new id goes into the manifest. Your rows: `assertPathPlanShape` (`:191-226`) refuses any planned path row that
carries your email or any email that is not a planned persona on the demo domain. It runs before the first read. The
writer resolves ids only for planned emails. No code path deletes by path slug or pack. SC-7 checks this against your
hand-made enrollment, completion and answer. Its RED (variant A) is recorded and is real: the test compares exact
values.

(b) Failure order. Shape check first (pure), then `assertPathsSeedable(sql)` (`:441`), alongside the world and storm
checks and before the delete at `:445-452`. It runs again in the transaction (`:644`) ahead of `writePathScenarios`.
Inside the transaction, the inserts that could still fail are the PK on `(user_id, path_slug)` / `(user_id, pack_slug)`
(the planner emits one row per pair) and the FKs the pre-check already covers (registered pack, synced question).
SC-8 is real. A reordered plan path fails the registry comparison and throws `db:sync-keys`. A plan naming you is
refused by the shape check. Both then assert the same user ids, the same group ids and your unchanged rows. The
`naming` case uses a bare `toThrow()`, but the id equality check would catch a post-delete throw anyway.

(c) PRNG. `plan-demo-world.ts` is not in the diff. `planSeed` calls `planDemoWorlds` first, unchanged. The path
personas draw from their own stream, `createRandom((seed ^ 0x0068) >>> 0)` (`plan-path-scenarios.ts:406`), which is
distinct from the storms' `0x0052`. Only halfway draws from it. SC-5a (deep-equal) and SC-5b (fixture hash recorded
before the change) test what the ticket intends.

(d) Persona states. Every persona is replayed through `memoryBySkill` + `buildForest` + `pathProgress` at the plan's
`now`, and the planner throws if a status differs (`assertTargets`, `:331-367`). Each completion is asserted with
`isCourseComplete` at `completedAt` = last answer + 1 min (`:210-215`). Halfway's partial progress is derived; no row is
stored. Lapsed: course 1 on days 40/39, course 2 on day 36, so wilting comes from the clock (SC-2 asserts `wilting` per
tree). Crammer: 10 correct per skill in one session. A Sprout is not asserted in the planner itself, but if FSRS ever
made it a Sapling the course would read "complete" and `assertTargets` would throw. SC-6 reads back from the DB at real
`now` and gets the same statuses.

(e) Privacy. The trio is fresh (no memory) + halfway + crammer. Viewer fresh has 2 contributing others; halfway and
crammer have 1 each. All three are below `MIN_OTHER_CONTRIBUTORS = 3`, so every trio member gets "not enough data". In
the six-member group, 5 personas have ai-capabilities memory, so any viewer has ≥ 4 contributing others: ready. The
server read (`get-group-heatmap.ts` → `countableAttempts`) does not filter by `joined_at`, so the trio's late joins
don't change this. The browser screenshot confirms it. No figure is added.

(f) C-1. Sensible. "Nothing path-related on your account" is a hard GOAL constraint, and MF-0062's seed gap only asks
for a "small path group". You see the trio by signing in as `fresh@`. It is recorded for the orchestrator to overturn.

(g) Production reach. Nothing under `src/app|server|features|components|lib` imports `src/dev-seed`.
`assertLocalSeedTarget` (unchanged) still runs in the CLI before any DB client exists. It refuses `SUPABASE_DB_URL` and
non-loopback DB/API hosts. The new code reads `paths/*.yaml` and writes only through the same `sql`/`admin` clients.

## Findings

1. [note] `src/dev-seed/plan-path-scenarios.ts:88,96-99`: the path planner drops `excludeItemIds` (your reviews, every
   flag resolution, real users' flags) from the personas' practice answers. `planDemoWorld` applies that list only to
   reviews and storm questions. Every skill has 6 questions today, so the whole `pnpm dev:seed` aborts in planning
   with "skill X of Y has no playable question" only once all 6 questions of one course skill have been reviewed or
   resolved by you. Nothing is deleted (it throws before any write). But the pack worlds then can't be re-seeded until
   the exclusion is narrowed. Acceptable fail-loud. Consider excluding only rejected and flagged items here, which is
   what `assertPathsSeedable` actually requires.
2. [note] `scripts/dev-seed.ts:201-204` / runbook "A `--pack` run …": a narrowed run still deletes every demo user,
   path personas included, and plans none. The printed line says "No path scenarios for …" but not that the
   existing path personas and both path groups are gone. The runbook's "Run it" rule (a narrowed run replaces the
   whole world) covers this implicitly.
3. [note] Re-run and hand-made memberships: if you join "Demo path group" by its invite code, `join_group` enrolls you
   in `claude-developer`. That enrollment is yours and survives. On the next run the group is deleted with its creator
   (finisher), so your membership, and any pin on it, disappears silently. This is the same class as the pack demo
   groups, but you are re-added to those and not to this one. Worth one runbook line if anyone will try this.
4. [note] `src/dev-seed/plan-path-scenarios.ts:425-435`: big-group `joinedAt` = each persona's enrollment time, so
   lapsed (45 d) and midpath (12 d) "joined" before the creator, finisher (20 d), and every join predates
   `groups.created_at` (= now). It is cosmetic today (no read compares them). An expedition started by hand on this
   group counts answers since each `joined_at`, which is the intent.
5. [note] `src/dev-seed/__tests__/mf-0068-seed.db.acceptance.test.ts:355` (frozen): the "plan naming you" refusal is
   asserted with a bare `toThrow()`. It is adequately backed by the id equality checks that follow (a post-delete throw
   would change the user ids), so no change is needed. Recorded so nobody reads it as message-pinned.
6. [nit] `docs/runbook/dev-seed.md:49`: "some wrong" for halfway depends on the PRNG. At 75% accuracy over 12
   answers, about 3% of `--seed` values give none wrong. The default seed 42 is fine.
7. [nit] `.planning/tasks/MF-0068/GOAL.md:3`: the title still says "eight named demo learners". The body says six
   personas + two groups (the MF-0062 "8" counted the groups).

## Verdict

approve: no blocking or should-fix finding. Re-runs are safe for state the seed does not own. Checks precede the
delete and repeat inside the transaction, with real RED proofs. Existing draws are unchanged. Persona states come from
the engine under the injected clock. Heatmap privacy holds at the minimum. Nothing reaches a hosted project.

## Delta (orchestrator, 2026-11-07)
Docs only after the reviewed hash: `docs/runbook/dev-seed.md` now states note 2 (a `--pack` run deletes the path
personas and both path groups), note 3 (don't join a demo path group with your own account) and nit 6 (halfway's
wrong answers are seed-dependent); GOAL title says six learners and two groups (nit 7). No code changed; the runbook
acceptance test still passes. Note 1 (excluded items can abort planning) → follow-up. Verdict stands: APPROVE.
