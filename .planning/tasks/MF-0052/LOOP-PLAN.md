---
phase: 0-planning
ticket_id: MF-0052
status: executing
verdict: IN_PROGRESS
started_at: "2026-11-05"
resume_with: /gsd-goal-loop
---

# Loop Plan — Iteration 0 (high-risk: present to the user and wait for approval)

## Discovery summary

**Contract.** Five frozen files (FROZEN.json, hashes approved 2026-11-05). All are RED at freeze for the SC's own
reason (LOOP-VERIFY probe). The seed DB tests call `planDemoWorlds(...)` and then
`seedDemoWorlds({ sql, admin, worlds, demoDomain, youEmail, previous })`, so the writer's signature stays the same.
`SeedManifest.youStormIds` is optional (`types.ts:121`).

**DB facts (read, not assumed).**
- `private.finalize_storm(p_storm_id uuid) returns void` is defined in `supabase/migrations/20261104130000_mf0013_storms.sql:123-172`.
  It is redefined in no later migration (grep over `supabase/migrations`), and it is `security definer` with
  `search_path=''`.
  - It never reads `auth.uid()`. The owner comes from `v_storm.user_id` (`:133`, `:159`).
  - Execute is revoked from public/anon/authenticated (`:426`). The seed's `sql()` (`src/test/local-stack.ts:51`,
    local `postgres` superuser) may call it.
  - It (a) voids any question whose `content_hash` ≠ registry or that has no key, (b) grades it with
    `options_match`, (c) inserts one attempt per answered unvoided question with `storm_id` and
    `answered_at = chosen_at`, and (d) sets `finished_at = least(now(), ends_at)`. It is a no-op on a finished storm.
- `storms_one_running_idx` (`:57`) allows at most one unfinished storm per user. So the seed must insert and finalize one
  storm at a time, and must refuse when you already have an unfinished storm.
- `attempts.storm_id ... on delete set null` (`:85`). **Deleting a storm does NOT delete its attempts.** The re-run
  must delete `attempts where storm_id = any(ids)` first.
- `storms.user_id` and `storm_questions.user_id` are `on delete cascade` from `auth.users` (`:44`, `:64`), so demo
  learners' storms go with the demo users. That is the same mechanism as today.
- The start rule the seed must re-state comes from `start_storm` (`:239-268`): synced item of this pack, question with a
  key, skill in `pack_skills` (a Boss Storm checks the domain), not `flagged`/`rejected`, not reviewed by the storm's
  owner, and hash = registry.
- Expeditions (`20261105100000_mf0017_expeditions.sql`):
  - `ends_at = starts_at + interval '7 days'` (check `:27`).
  - Overlap is excluded per group, `target` is 10..1000, and `created_by` cascades.
  - `start_expedition` uses `now()` and `auth.uid()`, so the seed inserts directly.
  - `expedition_progress` counts correct attempts in `[starts_at, ends_at)` with `answered_at >= joined_at`, not on a
    rejected item, and not at/after the member's own review (`:137-157`).
- No migration is needed. Every column and constraint the seed writes already exists.

**Code facts.**
- `planDemoWorld` (`src/dev-seed/plan-demo-world.ts:303-373`) returns `joins: [] / storms: [] / expedition: null`
  (stub).
- `seedDemoWorlds` (`seed-demo-world.ts:110-242`) deletes demo users (admin API) and your manifest attempts BEFORE its
  transaction. It inserts `group_members` without `joined_at` (`:196`), which causes the SC-1 tie.
- `fetchStormResults` (`src/server/storm/fetch-storm-results.ts`) returns every finished storm, **oldest first, without
  `id` or `domain_code`** (`StormResult`, `src/engine/storm/types.ts`). Today's SC-4 path (a frozen MF-0052 DB test)
  depends on that contract, so it is **not reused**. SC-11 gets a new read, following the
  `fetch-…(client)` + `list-my-…` precedent (`list-my-storm-results.ts`).
- `scoreStorm` (`score-storm.ts`) gives per-domain `survived`. No whole-storm verdict exists (grep `stormSurvived`,
  `survived` → only per-domain).
- `/play/[packSlug]/storm/full/page.tsx:34` and `boss/[domain]/page.tsx:34` call `notFound()` when `!pack.exam`. The
  layout (`src/app/(app)/layout.tsx:38`) always passes a storm href.
- The date formatter `formatReviewDate` lives in `src/features/review/utils/format-date.ts`. The recent-storms view would
  be its second feature consumer, so it moves to `src/lib/` (react-client-patterns rule 9).
- Feature component `types.ts` importing types from `@/server/**` has precedent (`groups-card/types.ts`,
  `flag-queue/types.ts`).

**Probe (read-only, `tsx` over today's `planDemoWorld`, seed 42, NOW 2026-11-05T12:00Z, ccdv-f, you):**
- You answer 20 skills. Skills never answered: D2.S1, D2.S2, D2.S6, D5.S1, D7.S1.
- Only **D4.S1** is wilting (R 0.84). The SC-7 "water" item hangs on this one skill, so your storms must not touch a
  wilting skill.
- Stability is already ≥ 45 d on 8 skills (e.g. D8.S2 73 d) and 14–45 d on D1.S1 (15.8), D1.S2 (19.4) and D2.S4 (14.9).
  So **a Full-Storm proof on a ≥ 45 d skill makes it Ancient, not Tree**. The Tree for SC-4 therefore comes from a
  Boss-Storm-only proof (`stormProven` without `fullStormProven` can never be Ancient).
  - Ancient appearing as a side effect is allowed (the GOAL only says the history is not stretched for it).
- Most ccdv-f skills have exactly 2 questions (D2.S3 and D8.S3 have 3). So a "proven" skill uses all its questions, and the
  planner must check eligibility per question.
- The planned reviews (ccdv-f) flag D2.S2.q1 (by new) and approve D2.S3.q2 (new, crammer), D1.S2.q1 (lapsed) and
  D7.S1.q2 (steady). Storm questions of a learner must avoid the items that learner reviews, and every flagged item.

**Gates the files sit on.**
- `COMPONENT_SPLIT_MIGRATED_PATHS` and `I18N_MIGRATED_PATHS` do not exist in this repo (grep over `scripts/`, `.claude/`).
  There is no allowlist to touch.
- Protected paths (`.claude/hooks/lib/gate-core.mjs`): none are edited.
- **Scope hook (`.claude/hooks/lib/agent-scopes.mjs`): no role agent may write `src/dev-seed/**` (it is in no SCOPES
  entry), and `scripts/**` is NEVER for every role agent.** So T5–T7 carry `agent: service-builder` as the role label
  for `ticket:eval`, but the **orchestrator runs them in the main session**, as MF-0029/MF-0034 did. Widening
  service-builder's scope would be a protected `.claude/hooks/` edit, which is an escalation and is not part of this plan.

**Precedents.**
- MF-0034 (`.planning/tasks/MF-0034/`): `seedDemoWorlds`, the multi-world transaction, and the retro's "(c) failure order"
  rule.
- MF-0029: manifest bound to `youId`, `listResolvedItems`.
- MF-0013: `fetchStormResults` / `listMyStormResults`, `toStormResult`.
- MF-0017: the direct-insert shape of an expedition (`mf-0017-expedition.db.acceptance.test.ts` fixtures).

## Deviation from the orchestrator's brief (needs the user's ack at approval)

The brief says storm answers belong in `world.attempts`, tagged with their storm. **This plan keeps storm answers ONLY in
`world.storms[].questions` (`chosen`/`chosenAt`) and inserts them only through `finalize_storm`.** Reasons:

1. **The premise does not hold.** Every frozen test that compares DB attempts with `world.attempts` builds its world with
   the single-pack `planDemoWorld`, never `planDemoWorlds`:
   - `mf-0029-seed.db.acceptance.test.ts:79`, assertion `:147-149`
     `expect(row?.n).toBe(world.attempts.filter((t) => t.email === learner.email).length)`
   - `mf-0034-seed.db.acceptance.test.ts:75`

   `planDemoWorld` keeps planning **no storms** (an invariant of this plan, step 2), so finalize never adds rows in those
   tests.
2. **The frozen MF-0052 contract models them as separate.** `mf-0052-plan.acceptance.test.ts:70-78` ("practice attempts
   plus answered storm questions") and SC-7 `:201-227` build your answer list as `world.attempts` **plus** every answered
   storm question.
   - If storm answers were also in `world.attempts`, SC-7 would replay each storm answer twice through `planWalk`, which
     changes FSRS stability on exactly the skills the test reads and corrupts SC-7's oracle.

The brief's goal (one grading owner, finalize inserts, no re-freeze) is fully kept.

## Frozen files this will re-freeze

**None.** I grepped every `*.acceptance.test.*` outside MF-0052 for `planDemoWorld`, `seedDemoWorld`, `stormHref`,
`AppSidebar`, `joined_at`, `listMyGroups`, `primaryPackSlug`, `storm/full`, `public.storms`, `fetchStormResults`,
`scoreStorm`, `isStormActive`, `dev-seed` and `listMyStormResults`, and read the assertions of every hit:

| File:line | Assertion | Why it holds |
|---|---|---|
| `src/dev-seed/__tests__/mf-0029-seed.db.acceptance.test.ts:147` | DB attempts per learner `toBe(world.attempts…length)` | `planDemoWorld` plans `storms: []` (step 2 invariant) → no finalize rows |
| `mf-0029-plan.acceptance.test.ts:90` | `expect(b.world).toEqual(a.world)` (determinism) | joins are a pure function of the planned attempts |
| `mf-0029-plan.acceptance.test.ts:162-163` | `stageCounts.tree` / `.ancient` `toBe(0)` | planDemoWorld only; no storm proof is passed |
| `mf-0034-seed.db.acceptance.test.ts:148-152` | after a re-run, "the hand-played answer is the only extra row" | planDemoWorld worlds: no storms, no expedition |
| `mf-0034-packs.acceptance.test.ts:81` | `yourSkills.size` `toBe(7)` | planDemoWorld's random stream is untouched; storms draw from a separate `createRandom` |
| `src/server/db/__tests__/mf-0017-expedition.db.acceptance.test.ts` (`joined_at`) | own fixtures | never calls the seed |
| `mf-0013-storms.db.acceptance.test.ts`, `mf-0005-grants.db.acceptance.test.ts` (`public.storms`) | schema and grants | no migration, no grant change |
| `src/engine/storm/__tests__/mf-0013-storm.acceptance.test.ts` (`scoreStorm`) | report shape | `scoreStorm` unchanged; `stormSurvived` is new |

## SC coverage

| SC | Steps | Proof |
|----|-------|-------|
| SC-1 | 2, 3, 4 | `mf-0052-plan` SC-1 (both pack orders); `mf-0052-seed.db` SC-1 (`joined_at desc` = ccdv-f first, strictly; every join < first answer) |
| SC-2 | 9, 10, 11 | `mf-0052-storm-link.acceptance.test.tsx`; `pnpm build`; browser `/play/prod-prompting/storm/full` + `/boss/D1` (200, empty state), `/play/nope/storm/full` (404) |
| SC-3 | 3, 4 | `mf-0052-plan` SC-3; `mf-0052-seed.db` SC-3 (`made` = `graded`, none running, Full Storm proof ≥ 3 + ≥ 1 wrong) |
| SC-4 | 3, 4 | `mf-0052-seed.db` SC-4 (Today's path: tree ≥ 1, storm value ≥ 1 domain); planner self-check (step 3e) |
| SC-5 | 3, 4 | `mf-0052-plan` SC-5; `mf-0052-seed.db` SC-5 (busiest domain, 0 < progress < target as you) |
| SC-6 | 4, 6, 12 | `mf-0052-seed.db` SC-6 (regression lock, already green); closing output of `pnpm dev:seed` quoted in evidence |
| SC-7 | 3 | `mf-0052-plan` SC-7 (`planWalk` water + new; ≥ 1 never-answered skill) + browser Walk/Plant |
| SC-8 | 4, 5, 6 | `mf-0052-regressions.db` (a)–(d) frozen; `mf-0052-seed-guards.db.test.ts` (new, RED first): unfinished storm, spoiled storm question, old manifest without `youStormIds` |
| SC-9 | 12 | browser walkthrough on :3001 after `pnpm db:reset && pnpm dev:seed`, observations in evidence |
| SC-10 | 12 | `pnpm typecheck && pnpm lint && pnpm test && pnpm test:db && pnpm build` |
| SC-11 | 7, 8, 10 | `mf-0052-recent-storms.acceptance.test.ts`; `storm-survived.test.ts`; `recent-storms/__tests__/utils.test.ts`; `fetch-recent-storms.db.test.ts`; browser |

## Steps

### Seed half (orchestrator, main session; see the scope note)

**1. `src/dev-seed/types.ts`.**
- Add `contentHash: string` to `PlannedStormQuestion`: the registry hash the storm binds to, taken from the pack's
  `SeedItem`. It is used by the stale check and stored in `storm_questions.content_hash`.
- Nothing else changes. `PlannedAttempt` gets **no** storm tag (see Deviation).

**2. `src/dev-seed/plan-demo-world.ts` → `planDemoWorld`.**
- Fill `joins` with one entry per learner at `firstAnswer − 1 day`, where `firstAnswer` = min `answeredAt` of the
  world's attempts.
- Keep `storms: []` and `expedition: null`. **Invariant: `planDemoWorld` never plans storms**, because it protects
  MF-0029/MF-0034.
- The existing random stream (attempts, reviews) must stay byte-identical. Check this with a `JSON.stringify` parity
  probe over seeds 1..5 against HEAD, as the MF-0034 review did.

**3. `plan-demo-world.ts` → `planDemoWorlds({ now, seed, youEmail, demoDomain, packs, excludeItemIds })`.**

a. **Base worlds.** Per pack, call `planDemoWorld({ now, seed, packSlug: pack.slug, groupName, youEmail, demoDomain,
   questions, items, excludeItemIds })`. Each world is identical to today's.

b. **Joins (SC-1).**
- `base` = min answer time over ALL worlds' practice attempts, minus 1 day. Storms start later than this, see (c).
- Rank the worlds by `(pack.exam ? 1 : 0, slug)`, so exam packs come last whatever the input order.
- Your join in the world of rank `r` is `base + r minutes`. Demo learners join at `base − 1 hour`.
- Every join is therefore before every world's first answer, and ccdv-f is strictly your newest join.

c. **Storms (SC-3), only when `pack.exam`.**
- Use a separate `createRandom((seed ^ 0x0052) >>> 0)` per pack, so the result does not depend on pack order.
- **Timing.**
  - Every storm lies in `[now − 10 d, now − 3 d − 1 h]`, so storms never enter the expedition window.
  - `endsAt = startedAt + stormDurationSeconds(pack.exam, n)` (`@/engine/storm`).
  - Each `chosenAt` lies in `[startedAt, endsAt)`, one minute apart.
- **Eligible question for learner L.**
  - A question of this pack whose skill maps to a pack domain.
  - Not in `excludeItemIds`.
  - Not reviewed by L in the plan.
  - Not an item any planned review flags.
  - `contentHash` from `items`.
- **Your skills.** Take your practised skills with `memoryBySkill(your practice attempts, now)` retrievability ≥
  `FOREST_THRESHOLDS.wiltBelowRetrievability`. This leaves every wilting skill and every never-answered skill out of your
  storms (SC-7).
- **Your Boss Storm (gives the Tree).**
  - Pick the domain with the most of your skills that have stability ≥ `treeStabilityDays` and ≥ 2 eligible questions.
    Break ties in pack order.
  - Use all eligible questions of those skills, capped at `BOSS_STORM_SIZE` (12), all answered with the key.
  - `domainCode` = that domain.
- **Your Full Storm.**
  - Choose 3 or more other eligible skills from your skills (not the Boss skills), with ≥ 2 eligible questions each.
    Prefer stability in [14, 45) d, then the rest in pack order. Answer all their questions correctly.
  - Add one question of a further eligible skill, answered with one wrong option (the existing `answer()` helper's wrong
    branch).
  - Total ≤ 53. `domainCode: null`.
- **Each demo learner: one Full Storm.** 10 to 15 eligible questions across domains, accuracy = the persona's
  `accuracy`, `domainCode: null`.
- `prod-prompting` (no `exam`) gets `storms: []`.

d. **Expedition (SC-5), every world.**
- `startsAt = now − 3 d`, `createdByEmail` = the group creator.
- For each pack domain, count correct **practice** attempts by members in `[startsAt, startsAt + 7 d)` with
  `answeredAt ≥` that member's join. Storms are outside the window by (c), so this equals the DB count.
- `domainCode` = the max count (first in pack order on a tie); call it `c`.
- Throw if `c < 1` or `c ≥ 1000`. Otherwise `target = min(1000, max(10, c + ceil(c / 2) + 1))`, which is always
  `> c ≥ progress`.

e. **Self-check (fail loud in the pure test, not the DB).**
- Replay your ccdv-f answers (practice + answered storm questions graded by set equality with the key) through
  `memoryBySkill(…, now, stormProof(…))` + `buildForest` + `summarizeForest`.
- Throw unless `stageCounts.tree ≥ 1`.
- Inner tests (`src/dev-seed/__tests__/plan-units.test.ts`, extend):
  - the exam pack is newest in both orders, including with two non-exam packs;
  - no storm question is reviewed by its owner or flagged;
  - no storm overlaps the expedition window;
  - `target > c`;
  - the throw when no domain has a correct answer in the window;
  - `planDemoWorld` plans no storms.

f. **Built (T5, 2026-11-05), precisions, no change of intent.**
- The Full Storm proves up to 4 skills (minimum 3, else it throws).
- The wrong answer comes from one of your practised, non-wilting skills not used elsewhere, so a never-answered skill stays new (SC-7).
- `planExpedition` is exported for its unit test.
- Parity probe: `planDemoWorld` attempts and reviews are identical to HEAD for seeds 1..5 on ccdv-f and prod-prompting.

**4. `src/dev-seed/seed-demo-world.ts` → `seedDemoWorlds` (same signature).**

Phase A, **pre-delete, for ALL worlds**, in this order (each throw names its rule):
1. `sharedLearners`, demo-domain check, `assertDemoDomain` (unchanged).
2. Per world, the existing `assertWorldSeedable`: pack registered (`/not registered/`), review hashes fresh (`/stale/`),
   not rejected, not own.
3. **New `assertStormsSeedable(sql, world, youId | null)`**, for every storm question:
   - `private.items` row of this pack, `item_type = 'question'`, `content_hash = planned` (else `/stale/`);
   - a `private.question_keys` row;
   - a `private.pack_skills` row whose `domain_code` = planned (a Boss Storm checks the storm's domain);
   - `item_state ≠ 'rejected'`;
   - no `flag` review on the current hash by a non-demo reviewer;
   - for your storms (when `youId` exists), no `item_reviews` row by `youId` (`/spoiled/`).

   Pure parts:
   - `endsAt < now` (a guard against a future plan);
   - the owner has not reviewed the item in `world.reviews`;
   - no planned flag on it;
   - `expedition.domainCode` exists in `pack_skills`.
4. **You have no unfinished storm.** `select id from public.storms where user_id = youId and finished_at is null` →
   throw `seedDemoWorld: you have an unfinished storm <id>: finish it on /storms/<id>, then re-run`. Covers both a
   running storm and an expired-unfinished one.

Phase B: delete demo users through the admin API (unchanged). This is the first destructive step.

Phase C: `youId` (reuse or create, unchanged), then create the demo learners (unchanged).

Phase D, **one transaction**:
1. **Your previous rows, moved INSIDE the transaction** (an in-transaction failure restores them). Only if
   `previous?.youId === youId`:
   - `delete from public.attempts where id = any(youAttemptIds) and user_id = youId`
   - `delete from public.attempts where storm_id = any(youStormIds) and user_id = youId`
   - `delete from public.storms where id = any(youStormIds) and user_id = youId`
2. Per world:
   - re-run `assertWorldSeedable` and `assertStormsSeedable`;
   - insert the group;
   - insert members **with `joined_at` from `world.joins`**, throwing if a learner has no join;
   - insert the practice attempts (unchanged);
   - insert the reviews and the maintainer row (unchanged).
3. Per world, after its reviews, per storm in `startedAt` order:
   - Insert `public.storms (user_id, pack_slug, kind, domain_code, started_at, ends_at)` with `finished_at` null.
   - Insert its `storm_questions` (`position` = index + 1, `content_hash` = planned,
     `unreviewed = private.item_state(question_id) = 'unreviewed'`, `chosen`, `chosen_at`).
   - Re-check `start_storm`'s playable predicate for the owner. This is the exact SQL of `:240-258`, run on the
     inserted rows, and it now sees this run's reviews. It throws `/not playable/`.
   - `select private.finalize_storm(id)`.
   - Assert `finished_at is not null` and `count(voided) = 0`, else throw.
   - Collect your storm ids.
4. Per world with an expedition:
   `insert into public.expeditions (group_id, domain_code, target, starts_at, ends_at, created_by)` with
   `ends_at = ${startsAt}::timestamptz + interval '7 days'` (the check needs exact equality).
5. Before commit: `select count(*) from public.storms where user_id = any(all seeded user ids) and finished_at is null`
   must be 0.

Return `{ youId, youAttemptIds, youStormIds }`.

`seedDemoWorld` (single) stays a one-line wrapper.

**4b. Built (T6, 2026-11-05), precisions, no change of intent.**
- Phase A's "flag by a non-demo reviewer" check ignores flags dismissed later (same rule as `item_state`), and "demo"
  means this run's demo domain.
- `listResolvedItems` stays exported: the CLI uses it until T7 swaps in `listSeedExcludedItems`. Delete it in T7 if it
  is then unused.
- `reviewQueueOwners` treats `list_reviewable`'s 42501 (not a member) as an empty queue, and rolls back every probe.
- Guards case 3: after a pre-MF-0052 manifest, the first run's storms of yours are kept (unknown to any manifest), so
  they stay as if hand-played. The next run replaces only the storms the manifest recorded.
- `seed-units.test.ts` is unchanged: the writer has no new pure function outside `manifest.ts`, which has its own test.

**5. `src/dev-seed/seed-demo-world.ts` → `listSeedExcludedItems(sql, { demoDomain, youEmail })`** replaces
`listResolvedItems` in the CLI. It returns, sorted:
- resolved items (as today);
- items with a `flag` review by a non-demo reviewer;
- items you reviewed (looked up by email; nothing after a `db:reset`).

The planner keeps storms and demo reviews off them, and Phase A refuses the same set, so the planner and the guard
share one rule. `listResolvedItems` stays exported if a test imports it (grep first; delete it if unused).

**6. New files.**
- `src/dev-seed/manifest.ts`: the zod `ManifestFile = z.strictObject({ youEmail, youId, youAttemptIds,
  youStormIds: z.array(z.uuid()).optional() })` and `toSeedManifest(parsed, youEmail): SeedManifest | null`, moved out
  of the CLI so it can be tested.
- `src/dev-seed/__tests__/manifest.test.ts`:
  - an old manifest without `youStormIds` parses → `youStormIds` undefined;
  - another email → null;
  - an unknown key → zod error.
- `src/dev-seed/review-queue-owners.ts`: `reviewQueueOwners(sql, { packSlugs, emails })`. Per pack, it returns the first
  email (you first) whose `public.list_reviewable(pack)` is non-empty, run as that user in a transaction with
  `set_config('request.jwt.claims', …, true)` + `set local role authenticated`. This is the pattern from
  `mf-0052-seed.db:58-68`, and it is read-only.
- `src/dev-seed/__tests__/mf-0052-seed-guards.db.test.ts` (non-frozen, each shown RED first, run-scoped emails like the
  frozen ones):
  1. You have a running storm (inserted by hand, `ends_at` in the future). The seed throws `/unfinished storm/`, and the
     snapshot (demo ids, storms, expeditions, your attempts) is unchanged.
  2. You reviewed a question the plan puts in your storm. The seed throws `/spoiled/` before any delete, and the snapshot
     is unchanged.
  3. Run 1 with `previous` = `{ youId, youAttemptIds }` (pre-MF-0052 manifest, no storm ids) deletes none of your
     storms, and run 2 with the returned manifest replaces them (SC-3 counts).
  4. Cross-world: world 1 is fine and world 2's storm question is spoiled for you. The seed throws before delete, and
     world 1's previous groups and your storms are still there (MF-0034 retro action 1).

**7. `scripts/dev-seed.ts` (orchestrator only: `scripts/**` is NEVER for role agents).**
- Plan with `planDemoWorlds({ now, seed, youEmail, demoDomain: DEMO_DOMAIN, packs: selected.map(slug → { pack,
  groupName: demoGroupName(pack.name), questions, items }), excludeItemIds: await listSeedExcludedItems(db, …) })`.
- Read and write the manifest through `src/dev-seed/manifest.ts`. Write `youStormIds`.
- Closing output adds, per world:
  - `N storms, expedition on <domain> (target T)`;
  - per pack, `Review queue (<slug>): sign in as <email>` from `reviewQueueOwners` (SC-6 "names the account"), or
    `none` if empty.
- Keep the guard order (`assertLocalSeedTarget` before `stackEnv`).

### App half (role agents)

**8. Engine (service-builder): `src/engine/storm/storm-survived.ts`.**
- `stormSurvived(report: StormReport): boolean` returns true iff `report.domains.length > 0` and every domain has
  `survived`.
  - **A storm with no scored domain (all voided) is "Not survived".** This is a plan choice, so confirm it at approval.
- Export it from `src/engine/storm/index.ts`.
- `src/engine/storm/__tests__/storm-survived.test.ts`, built through `scoreStorm` on the ccdv-f pack:

  | Input | Expected |
  |---|---|
  | all domains ≥ 72 | `true` |
  | one domain 68 | `false` |
  | Boss 18/25 = 72 | `true` (inclusive) |
  | Boss 17/25 | `false` |
  | unanswered counts as wrong (2 right + 2 unanswered = 50) | `false` |
  | only voided | `false` |

**9. Server read (service-builder).**
- `src/server/storm/types.ts`: add the zod `RecentStormRow` (`id, kind, domain_code, finished_at,
  storm_questions(position, question_id, skill_code, chosen, correct, voided)`) and the DTO
  `RecentStorm { id; kind; domainCode: string | null; finishedAt: string; questions: readonly StormResultQuestion[] }`.
- `src/server/storm/to-recent-storm.ts`: a pure row → DTO mapper, with `__tests__/to-recent-storm.test.ts`.
- `src/server/storm/fetch-recent-storms.ts`: `fetchRecentStorms(client, userId, packSlug, limit = 5)`.
  - Same filters as `fetchStormResults`; `.order("finished_at", { ascending: false }).order("id", { ascending: false })`.
  - Question order by `position`; `.limit(limit)`.
  - Throws `fetchRecentStorms: …` on error.
  - No `server-only` (it takes the client), per the precedent.
- `src/server/storm/list-my-recent-storms.ts`: `import "server-only"`, then
  `listMyRecentStorms(userId, packSlug)` → `fetchRecentStorms(await createServerSupabase(), …)`. Never cached.
- `src/server/storm/__tests__/fetch-recent-storms.db.test.ts`, as a user client (RLS):
  - newest first;
  - 6 finished → 5;
  - an unfinished one is excluded;
  - another user's storm is invisible;
  - another pack's storm is excluded.

**10. Recent-storms component (ui-builder), `src/features/storm/components/recent-storms/`.**
- `types.ts`: `FinishedStormInput` becomes `export type FinishedStormInput = RecentStorm` (`import type` from
  `@/server/storm/types`), so the shape has one owner. Add `RecentStormsProps { rows: readonly RecentStormRow[] }`.
- `utils.ts` → `toRecentStormRows({ pack, storms })`:
  - sort by `finishedAt` desc, then `id` desc; take the first 5;
  - `survived = stormSurvived(scoreStorm(pack, { kind, finishedAt: new Date(finishedAt), questions }))`;
  - `kindLabel` = `"Full Storm"` or `` `Boss Storm: ${domain.name}` `` (unknown domain code → `` `Boss Storm: ${code}` ``);
  - `href` = `/storms/${id}`.
- `__tests__/utils.test.ts` (rule 4):
  - tie on `finishedAt` → `id` desc;
  - the sixth storm is dropped;
  - unknown boss domain → code label.
- `recent-storms.tsx` is a Server Component (no `"use client"`), presentational. It returns `null` for no rows.
  - A shadcn `Card` titled "Your recent storms", rows split by `Separator`.
  - Each row is a `Link` to `href` with the bold `kindLabel` and a muted `<time dateTime>`, formatted by `formatUtcDate`.
  - A `Badge`: `variant="secondary"` "Survived" / `variant="destructive"` "Not survived". The word carries the meaning,
    not the colour.
  - `tabular-nums`.
- `index.ts` exports `RecentStorms` and `toRecentStormRows`.
- Hoist `src/features/review/utils/format-date.ts` → `src/lib/format-utc-date.ts`.
  - `formatUtcDate(iso)` keeps the exact output (`"<medium date>, <short time> UTC"`).
  - Move its test to `src/lib/__tests__/format-utc-date.test.ts`.
  - Update the two review imports (`flag-queue/components/flag-row.tsx`, `pending-analogy-list/pending-analogy-list.tsx`)
    and delete the old file.

**11. SC-2 + wiring (ui-builder).**
- `app-sidebar.tsx`: render the Storm `SidebarMenuItem` only when `stormHref !== null`. Remove both stub `?? ""`.
  `isStormActive` keeps `string`.
- `src/app/(app)/layout.tsx`: `stormHref={pack.exam ? \`/play/${packSlug}/storm/full\` : null}`.
- New `src/features/storm/components/storm-unavailable/` (`index.ts`, `storm-unavailable.tsx`, `types.ts`
  `{ packName: string; duelHref: string }`). A Server Component: a `Card` with "No Storm for this pack", the text "This
  pack has no exam to simulate, so there is no Storm. Practise its scenarios in the Duel instead." and
  `Button asChild` → `Link` "Go to Scenario Duel".
- `storm/full/page.tsx`:
  - after the unknown-slug `notFound()` and the running-storm redirect, `if (!pack.exam) return <header…/> +
    <StormUnavailable …/>` (status 200);
  - below `StormStart`, a separate async `RecentStormsSlot` (calls `listMyRecentStorms(user.id, packSlug)`, then
    `toRecentStormRows`) under its own `<Suspense fallback={<Skeleton className="h-40 w-full rounded-xl" />}>`;
  - `finalizeExpiredStorms()` has already run in the parent, so a just-expired storm is listed.
- `storm/boss/[domain]/page.tsx`: `if (!pack.exam)` → the same empty state, before the domain check. An unknown
  domain on an exam pack still calls `notFound()`.

**12. Verify (orchestrator).**
1. Baseline receipt.
2. The gates per task (below).
3. On the user's local stack (allowed): `pnpm db:reset && MF_AUTHOR_EMAIL=… pnpm dev:seed`, then a second
   `pnpm dev:seed` (re-run).
4. Browser on :3001 as you, covering the SC-9 list. For SC-2, the sidebar half is the ui test. In the browser, visit
   `/play/prod-prompting/storm/full` + `/boss/D1` (200, empty state) and `/play/nope/storm/full` (404).
5. `pnpm build`.
6. Fresh-context review (high-risk). Re-read any post-review delta on the delete path (MF-0034 retro action 2).

## Riskiest step: step 4 (privileged deletes and writes across runs)

**(a) Ids kept on disk vs reset.**
- On disk, `.cache/dev-seed/manifest.json` holds `{ youEmail, youId, youAttemptIds, youStormIds }`.
- Every delete is `id = any(manifest ids) AND user_id = youId`, and only when `previous.youId === youId`. Storm attempts
  are deleted by `storm_id`, because `on delete set null` would otherwise orphan them as practice answers.
- After `db:reset`, `youId` changes, so nothing is deleted.
- Tests:
  - frozen `mf-0052-regressions` (a) replaces, (c) a stale `youId` deletes none of your storms or attempts;
  - `manifest.test.ts`: an old manifest stays valid;
  - `mf-0052-seed-guards` case 3: a pre-MF-0052 manifest deletes no storms.

**(b) Other actors between runs.**

| Actor | Effect | Test |
|---|---|---|
| A storm you played by hand | Not in the manifest, so it survives | frozen (b) |
| A hand storm still running or expired-unfinished | Refused before any delete: inserting would hit `storms_one_running_idx`, and finalizing your data is not the seed's job | guards case 1 |
| A question you reviewed by hand (spoiled for you) or flagged by a real user | Excluded by `listSeedExcludedItems`, and refused if it gets through | guards case 2 |
| Maintainer resolutions | Excluded as today | MF-0029 |
| Expeditions | Only in demo groups and cascade with them | frozen (a) count `[1]` |
| Hand groups you joined later | Stay newer than the backdated demo joins, so they become your primary pack | Intended; documented in the CLI header comment |

**(c) Failure order.**
- Every input check (pack registered, hashes fresh, storm questions playable/unspoiled/unflagged/unrejected, expedition
  domain, no unfinished storm) runs for ALL worlds before the first delete (Phase A).
- The same checks run again inside the transaction (Phase D), where your row deletes now also live. An in-transaction
  failure (a concurrent sync voiding a question, a review appearing) therefore rolls back your deletes too.
- Only the demo users' admin-API deletion precedes the transaction, as today.
- Tests:
  - frozen (d): unregistered pack, stale review hash; the snapshot is unchanged;
  - guards case 4: cross-world, world 2 bad, world 1's data is kept;
  - the post-finalize assertion (no voided question, `finished_at` set) plus the pre-commit "no unfinished storm" count
    make "never leave an unfinished storm" a thrown error, not a silent state. Frozen SC-3 `running: 0` and the
    regressions' `running: 0` lock it.
- **Not provable by a committed test:** an in-transaction-only failure needs a concurrent writer. It is covered by
  construction (the same assert functions) and by the review.

## Rejected options

- **Storm answers duplicated into `world.attempts`.** Rejected per the Deviation section: it double counts in frozen
  SC-7.
- **`start_storm` / `answer_storm_question` RPCs as each learner.** These need `auth.uid()` sessions and DB `now()`, which
  cannot backdate. Direct insert + `finalize_storm` keeps one grading owner.
- **Grading in the seed.** This violates the "one owner" constraint, and `storm_questions.correct` would be forged.
- **Reusing `fetchStormResults` for the list.** It is oldest-first, has no `id`/`domain_code`, and frozen SC-4 depends on
  it. Widening it changes a shared contract.
- **Ordering `listMyGroups` by pack exam or adding a tie-breaker.** The user decided the seed backdates instead (GOAL
  "Decided").
- **`start_expedition`.** It uses `now()` and `auth.uid()`; it cannot set `starts_at` 3 days back.
- **Finalizing a hand-left unfinished storm in the seed.** That touches the user's own data. Refuse instead.
- **A widened service-builder scope for `src/dev-seed/**`.** That is a protected-hook edit, so it is an escalation. The
  orchestrator runs those steps.
- **Formatting the date inside `utils.ts` rows.** The frozen SC-11 test pins the row shape with `toEqual`; an extra field
  fails it.

## Gates per task

| Task | Gates (`done_when`) |
|---|---|
| T1 | `pnpm test src/engine/storm`, `pnpm typecheck` |
| T2 | `pnpm test src/server/storm`, `pnpm test:db src/server/storm/__tests__/fetch-recent-storms.db.test.ts`, `pnpm typecheck` |
| T3 | frozen SC-11 file, `pnpm test src/features/storm src/lib src/features/review`, `pnpm typecheck`, `pnpm lint` |
| T4 | frozen SC-2 file, `pnpm test src/features/app-shell`, `pnpm typecheck`, `pnpm lint`, `pnpm build` |
| T5 | frozen `mf-0052-plan`, `mf-0029-plan`, `mf-0034-packs`, `plan-units`, `pnpm typecheck` |
| T6 | frozen `mf-0052-seed.db`, `mf-0052-regressions.db`, `mf-0029-seed.db`, `mf-0034-seed.db`; `mf-0034-regressions.db`, `seed-regressions.db`, `mf-0052-seed-guards.db`, `manifest.test.ts`; `pnpm typecheck` |
| T7 | full gate `pnpm typecheck && pnpm lint && pnpm test && pnpm test:db && pnpm build`; real `db:reset` + `dev:seed` ×2; browser (not a shell command: evidence) |

## Verify

- VERIFY MF-0052: the receipt must say DONE for this tree.
- EVAL MF-0052: the graph below; every changed file inside an `owns`.
- Browser (:3001, signed in as `MF_AUTHOR_EMAIL` after `db:reset && dev:seed`):
  - the sidebar Storm item goes to `/play/ccdv-f/storm/full`;
  - that page lists 2 recent storms (Full, Boss) with badges, each opening `/storms/<id>`;
  - Today shows a Tree and a storm value on the readiness card;
  - the group page shows the expedition with progress between 0 and the target;
  - Walk shows water + new; Plant, Cuckoo, Review and Flags are non-empty;
  - one interaction each;
  - `/play/prod-prompting/storm/full` shows the empty state with the Duel link.

```json tasks
[
  {
    "id": "T1",
    "title": "engine: whole-storm verdict stormSurvived + unit test",
    "agent": "service-builder",
    "owns": ["src/engine/storm/storm-survived.ts", "src/engine/storm/index.ts", "src/engine/storm/__tests__/storm-survived.test.ts"],
    "depends_on": [],
    "closes": ["SC-11"],
    "done_when": ["pnpm test src/engine/storm", "pnpm typecheck"],
    "context": ["skill:typescript-strict", "skill:testing-strategy", "skill:tdd", "file:CONTEXT.md#Survived domain", "file:src/engine/storm/score-storm.ts"]
  },
  {
    "id": "T2",
    "title": "server: fetchRecentStorms / listMyRecentStorms (newest 5 finished, own, per pack) + mapper + db test",
    "agent": "service-builder",
    "owns": ["src/server/storm/types.ts", "src/server/storm/to-recent-storm.ts", "src/server/storm/fetch-recent-storms.ts", "src/server/storm/list-my-recent-storms.ts", "src/server/storm/__tests__/to-recent-storm.test.ts", "src/server/storm/__tests__/fetch-recent-storms.db.test.ts"],
    "depends_on": [],
    "closes": ["SC-11"],
    "done_when": ["pnpm test src/server/storm", "pnpm test:db src/server/storm/__tests__/fetch-recent-storms.db.test.ts", "pnpm typecheck"],
    "context": ["skill:react-feature-architecture", "skill:nextjs-data", "skill:supabase", "skill:testing-strategy", "file:src/server/storm/fetch-storm-results.ts", "file:src/server/storm/list-my-storm-results.ts", "memory:feedback-local-first"]
  },
  {
    "id": "T3",
    "title": "ui: recent-storms component + toRecentStormRows + hoist formatUtcDate to src/lib",
    "agent": "ui-builder",
    "owns": ["src/features/storm/components/recent-storms/**", "src/lib/format-utc-date.ts", "src/lib/__tests__/format-utc-date.test.ts", "src/features/review/utils/**", "src/features/review/components/flag-queue/components/flag-row.tsx", "src/features/review/components/pending-analogy-list/pending-analogy-list.tsx"],
    "depends_on": ["T1", "T2"],
    "closes": ["SC-11"],
    "done_when": ["pnpm test src/features/storm/components/recent-storms/__tests__/mf-0052-recent-storms.acceptance.test.ts", "pnpm test src/features/storm src/lib src/features/review", "pnpm typecheck", "pnpm lint"],
    "context": ["skill:react-client-patterns", "skill:server-client-components", "skill:ui-shadcn", "skill:typescript-strict", "file:.claude/rules/ui-design.md", "memory:feedback-shadcn-only"]
  },
  {
    "id": "T4",
    "title": "ui: SC-2 sidebar hides Storm without exam, layout stormHref null, storm pages empty state, recent storms on /storm/full",
    "agent": "ui-builder",
    "owns": ["src/features/app-shell/components/app-sidebar/**", "src/app/(app)/layout.tsx", "src/app/(app)/play/[packSlug]/storm/**", "src/features/storm/components/storm-unavailable/**"],
    "depends_on": ["T3"],
    "closes": ["SC-2", "SC-11"],
    "done_when": ["pnpm test src/features/app-shell/components/app-sidebar/__tests__/mf-0052-storm-link.acceptance.test.tsx", "pnpm test src/features/app-shell", "pnpm typecheck", "pnpm lint", "pnpm build"],
    "context": ["skill:server-client-components", "skill:nextjs-data", "skill:react-client-patterns", "skill:ui-shadcn", "file:node_modules/next/dist/docs/", "file:.claude/rules/ui-design.md", "memory:feedback-browser-verification"]
  },
  {
    "id": "T5",
    "title": "seed planner: joins in planDemoWorld, planDemoWorlds (joins, storms, expedition, self-check) — ORCHESTRATOR runs it (src/dev-seed is in no role scope)",
    "agent": "service-builder",
    "owns": ["src/dev-seed/types.ts", "src/dev-seed/plan-demo-world.ts", "src/dev-seed/__tests__/plan-units.test.ts"],
    "depends_on": [],
    "closes": ["SC-1", "SC-3", "SC-5", "SC-7"],
    "done_when": ["pnpm test src/dev-seed/__tests__/mf-0052-plan.acceptance.test.ts src/dev-seed/__tests__/mf-0029-plan.acceptance.test.ts src/dev-seed/__tests__/mf-0034-packs.acceptance.test.ts src/dev-seed/__tests__/plan-units.test.ts", "pnpm typecheck"],
    "context": ["skill:gsd-goal-loop", "skill:typescript-strict", "skill:tdd", "file:.planning/tasks/MF-0034/RETRO.md", "file:supabase/migrations/20261104130000_mf0013_storms.sql", "file:src/engine/forest/tree-stage.ts", "memory:feedback-verify-derived-facts"]
  },
  {
    "id": "T6",
    "title": "seed writer: joined_at, storms via private.finalize_storm, expedition, manifest storm ids, pre-delete + in-tx checks, guards — ORCHESTRATOR runs it",
    "agent": "service-builder",
    "owns": ["src/dev-seed/seed-demo-world.ts", "src/dev-seed/manifest.ts", "src/dev-seed/review-queue-owners.ts", "src/dev-seed/__tests__/manifest.test.ts", "src/dev-seed/__tests__/mf-0052-seed-guards.db.test.ts", "src/dev-seed/__tests__/seed-units.test.ts"],
    "depends_on": ["T5"],
    "closes": ["SC-1", "SC-3", "SC-4", "SC-5", "SC-6", "SC-8"],
    "done_when": ["pnpm test:db src/dev-seed/__tests__/mf-0052-seed.db.acceptance.test.ts src/dev-seed/__tests__/mf-0052-regressions.db.acceptance.test.ts src/dev-seed/__tests__/mf-0029-seed.db.acceptance.test.ts src/dev-seed/__tests__/mf-0034-seed.db.acceptance.test.ts src/dev-seed/__tests__/mf-0034-regressions.db.test.ts src/dev-seed/__tests__/seed-regressions.db.test.ts src/dev-seed/__tests__/mf-0052-seed-guards.db.test.ts", "pnpm test src/dev-seed", "pnpm typecheck"],
    "context": ["skill:supabase", "skill:supabase-postgres-best-practices", "skill:gsd-goal-loop", "file:supabase/migrations/20261104130000_mf0013_storms.sql", "file:supabase/migrations/20261105100000_mf0017_expeditions.sql", "file:.planning/tasks/MF-0034/RETRO.md", "memory:project-supabase-migration-rules", "memory:feedback-local-first", "memory:feedback-no-keys-in-logs"]
  },
  {
    "id": "T7",
    "title": "CLI planDemoWorlds + manifest youStormIds + review-queue output; fresh-machine walkthrough and full gates — ORCHESTRATOR only (scripts/** is NEVER for role agents)",
    "agent": "service-builder",
    "owns": ["scripts/dev-seed.ts"],
    "depends_on": ["T4", "T6"],
    "closes": ["SC-6", "SC-9", "SC-10"],
    "done_when": ["pnpm typecheck", "pnpm lint", "pnpm test", "pnpm test:db", "pnpm build"],
    "context": ["skill:gsd-goal-loop", "skill:ticket-traceability", "memory:feedback-local-first", "memory:feedback-browser-verification", "memory:feedback-no-keys-in-logs"]
  }
]
```

PLAN: ready (high-risk: present to the user; the approval needs an ack on (1) the Deviation (storm answers stay out of
`world.attempts`), (2) `stormSurvived` = false for a storm with no scored domain, and (3) T5–T7 being run by the
orchestrator in the main session because of the scope hook.)

## Amendment (2026-11-05, TEST stage): T0b, MF-0013 fixture re-freeze

Found in TEST: `pnpm test:db` red on `src/server/db/__tests__/mf-0013-storms.db.acceptance.test.ts` whenever the local
DB is seeded (the old seed did the same): the fixture took the first 3 D2 questions and `dev:seed` flags
`ccdv-f.D2.S2.q1`, which `start_storm` refuses. The user chose to fix the fixture (checkpoint 2026-11-05).

- **T0b** (orchestrator, user-approved re-freeze). Owns `src/server/db/__tests__/mf-0013-storms.db.acceptance.test.ts`
  and `.planning/tasks/MF-0013/FROZEN.json`. D2/D1 come from playable questions (`item_state` not flagged/rejected),
  `D2_13` and every `expect` unchanged; FROZEN.json `history` records old/new hash and the reason. Closes SC-10.
- "Frozen files this will re-freeze" above said none; this is the one exception, found by running `test:db` against a
  seeded DB, which DESIGN preflight did not do.
- Also added after review: `recent-storms/__tests__/recent-storms.test.tsx` (SC-11 ui proof the GOAL named).
