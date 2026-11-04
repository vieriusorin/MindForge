---
ticket_id: MF-0034
tier: high-risk                   # privileged DB client + auth users (local only), as MF-0029; no migration
stage: handoff
branch: feat/MF-0016              # shared worktree; move to its own branch before commit
builds_on: [MF-0029, MF-0031]
last_iteration: 0
goal_status: complete-pending-manual-commit
---

> Claimed 2026-11-04. User: "all of this can be seeded to local supabase?" → offered a `--pack` option for
> `dev:seed` as a new ticket → "yes do it."

## Objective

**Today.** `pnpm dev:seed` (MF-0029) builds a local demo world (5 demo learners + you, three weeks of answers, a few
reviews) for `ccdv-f` only (`PACK_SLUG` is hard-coded in `scripts/dev-seed.ts`). The new `prod-prompting` pack
(MF-0031) has its keys and items synced but no learners, group, answers or reviews, so its screens are empty.

**End state.** `pnpm dev:seed` seeds a demo world for every pack that has questions (today `ccdv-f` and
`prod-prompting`), with the same six learners in one demo group per pack. `--pack <slug>` (repeatable) narrows the
run to named packs.

## Affected

- **Roles:** developer running the local stack. No app role or screen changes.
- **Surfaces:** `scripts/dev-seed.ts` (CLI), `src/dev-seed/{plan-demo-world,seed-demo-world,types}.ts`, a new pure
  `src/dev-seed/resolve-seed-packs.ts`, tests under `src/dev-seed/__tests__/`. Local DB only.

## Constraints

- Local only: `assertLocalSeedTarget` stays the first thing that runs.
- MF-0029's frozen tests (`mf-0029-plan.acceptance.test.ts`, `mf-0029-seed.db.acceptance.test.ts`) pass unchanged.
  `seedDemoWorld({ world })` keeps its single-world signature and behaviour.
- Pack-agnostic: no slug hard-coded in `src/dev-seed/**`.
- No new dependency, no migration.

## Decided without a question

- **A run replaces the whole demo world** (MF-0029 semantics). Demo users are shared by every pack group and are
  deleted at the start of each run, so a `--pack prod-prompting` run leaves only the prod-prompting demo group. The
  CLI says so in its summary. Keeping other packs' groups would mean not deleting shared users, which breaks
  MF-0029's "re-run gives the same counts" (SC-6). Default = all packs, so the plain command never loses one.
- **Group name per pack:** `Demo study group · <pack name>`, so two groups are distinguishable in the sidebar.
  MF-0029 tests don't assert the name (grep).
- **"You" keeps some seeds on Today on a small pack:** your skill limit becomes
  `min(20, skills − ceil(skills / 5))`. That's 20 of 25 on ccdv-f (unchanged, frozen SC-3 holds) and 7 of 9 on
  prod-prompting. MF-0029's intent was "your Today page shows seeds as well".
- **Packs without questions are skipped** with a line in the output (`team-onboarding-sample`).

## Success Criteria

- [x] SC-1: `resolveSeedPacks({ available, requested })` → no request: every available pack with ≥ 1 question,
  sorted; a request: exactly those, deduped, sorted; an unknown slug or a pack without questions throws, naming it.
  Proof: frozen unit acceptance test.
- [x] SC-2: `youSkillLimit(skillCount)` = `min(20, n − ceil(n/5))`: 25 → 20, 9 → 7, 5 → 4, 1 → 0.
  Proof: frozen unit acceptance test.
- [x] SC-3: `planDemoWorld` accepts an optional `groupName` (default `"Demo study group"`, unchanged) and plans
  "you" over `youSkillLimit(skills)` skills: on prod-prompting you answer exactly 7 of 9 skills.
  Proof: frozen unit acceptance test over the real pack files.
- [x] SC-4: `seedDemoWorlds({ worlds: [ccdv-f, prod-prompting] })` on the local stack gives 5 demo users, 2 groups
  (one per pack, named per pack, 6 members each, you admin in both), attempts in both packs, you as analogy owner of
  both, ≥ 1 approved review in each pack. Proof: frozen DB acceptance test.
- [x] SC-5 (re-run state): a second `seedDemoWorlds` run gives the same counts; a hand-played answer of yours on
  prod-prompting (not in the manifest) survives; a run with only `[prod-prompting]` leaves exactly one demo group.
  Proof: frozen DB acceptance test, red before the change.
- [x] SC-6: MF-0029's frozen tests pass unchanged. Proof: `pnpm test` + `pnpm test:db` output.
- [x] SC-7: the real `MF_AUTHOR_EMAIL=… pnpm dev:seed` on the local stack prints both groups; the DB read-back shows
  both; signed in as a demo learner, `/review/prod-prompting` renders. Proof: CLI output + read-back + browser check,
  or HTTP render if the browser is held.
- [x] SC-8: `pnpm typecheck && pnpm lint && pnpm test` pass for MF-0034's files (MF-0016's in-flight reds
  attributed by file).

### Constraints → how met

- Local only → the guard is unchanged and runs before `stackEnv()`; the DB tests use `src/test/local-stack.ts`.
- Frozen MF-0029 contract → `seedDemoWorld` becomes a one-line wrapper over `seedDemoWorlds([world])`; SC-6.
- Pack-agnostic → the slugs live only in the CLI's discovery (`packs/*/`) and in test fixtures.

### Riskiest step (re-run state, per the MF-0029 retro)

`seedDemoWorlds` deletes users and attempts. State it does not own that survives a re-run:
- (a) `.cache/dev-seed/manifest.json`: your seeded attempt ids, bound to `youId` (MF-0029). It now spans packs, and
  a run deletes only ids it recorded and only yours. SC-5 tests a hand-played prod-prompting answer surviving.
- (b) Decisions by another actor: flag resolutions (`listResolvedItems`, global, all packs) keep demo reviews off
  resolved items in every pack; your own hand-played answers are never in the manifest. Both covered by SC-5 and the
  existing `seed-regressions.db.test.ts`.
- The privileged writes stay in one transaction for all packs: one pack's failure (e.g. not registered) rolls back
  every group.

### Concerns

- C-1 (user): the shared worktree is on `feat/MF-0016`, with an MF-0016 session active. MF-0034 files are disjoint
  from MF-0016's (`src/dev-seed/**`, `scripts/dev-seed.ts`).
- C-2 (user): SC-7 replaces your current local demo world and your previously seeded answers (MF-0029 semantics).
  Your hand-played answers stay.

## Out of Scope

- Per-pack demo users, keeping other packs' groups on a narrowed run.
- Seeding `level`-aware reviews or anything in the app UI.

## Iteration Log

- 2026-11-04 claimed; DESIGN drafted; user approved SCs + plan ("yes"); RED frozen (2 files).
- 2026-11-04 built; review approve (0 blocking); note 1 fixed test-first, notes 2–5 fixed; receipt DONE. Hand-off.
