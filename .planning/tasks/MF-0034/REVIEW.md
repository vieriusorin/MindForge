---
verdict: approve
reviewed_hash: e6c0213705b4c8cc175911ad4ae41e3b84aaa523f309805361ef6d7e4dd93768
reviewed_at: 2026-11-04T16:33:00+02:00
---
Hash = `git diff HEAD -- <the 6 MF-0034 paths> | shasum -a 256`, with the 3 untracked files marked `git add -N`
(undone afterwards). Paths: `src/dev-seed/{resolve-seed-packs,plan-demo-world,seed-demo-world}.ts`,
`scripts/dev-seed.ts`, `src/dev-seed/__tests__/mf-0034-{packs,seed.db}.acceptance.test.ts`. There is no
`ticket:verify` script in package.json, so the tree hash could not be read from it.

## What was checked, and how

- Frozen files: both sha256 match FROZEN.json. MF-0029's frozen tests show no diff against HEAD.
- `pnpm vitest --project unit src/dev-seed`: 6 files, 18 tests green. `--project db src/dev-seed` on the local
  stack: 3 files, 8 tests green (MF-0029 seed, MF-0034 seed, seed-regressions). Biome and typecheck are clean
  for the 6 files.
- **Delete scope.** The delete code is unchanged from HEAD (`seed-demo-world.ts:93-111`): auth users only on
  the asserted demo domain, and your attempts only by manifest id **and** `user_id = youId`. A narrowed run
  deletes the previous manifest's ids, which can be in any pack. All of them are your seeded rows, which is
  the "replace the whole demo world" decision in GOAL. Hand-played answers are never in the manifest, and
  SC-5 proves one survives both a full re-run and a narrowed one. Nothing outside the demo domain or the
  manifest ∩ you is deleted.
- **Single-world parity.** `seedDemoWorld` (`:44-56`) forwards to `seedDemoWorlds([world])`. For one world,
  the body is the HEAD body line for line, with only `world.learners` replaced by `sharedLearners` and the
  loop added. Identical behaviour.
- **`youSkillLimit` vs ccdv-f.** I ran a scratch script comparing HEAD's `planDemoWorld` with the new one
  over the real ccdv-f files (25 skills). The `JSON.stringify` output is identical for seeds 1, 7, 42, 99 and
  12345. `shuffled()` consumes the PRNG the same way, and the limit stays 20.
- **Cross-pack transaction.** All writes inside `sql.begin` (`:131-214`) use `tx`. I ran a probe on a
  run-scoped domain with `[ccdv-f, <unregistered pack>]`. It threw, leaving 0 groups, 0 of your attempts and
  0 maintainer rows, so the ccdv-f group was rolled back. The steps before the transaction are not part of it
  (see the first note).

## Findings

- [note] `seed-demo-world.ts:92-128` vs `:135-201`: the per-pack checks that can fail (pack not registered,
  stale `content_hash`, rejected item) run inside the transaction. That is **after** the demo users and your
  previously seeded attempts were deleted and the new demo users created. A failure in any one pack (for
  example ccdv-f hashes going stale while MF-0016 cuckoo content is edited and `db:sync-keys` hasn't run)
  ends with 5 group-less demo users, no demo world for **any** pack, and an unchanged manifest. My probe
  confirmed the 5 users are left behind. The behaviour comes from MF-0029, but MF-0034 widens it: one pack's
  staleness now wipes every pack's demo world. Nothing outside the demo domain is lost, the error is loud,
  and a re-run after `db:sync-keys` recovers. GOAL's wording "one pack's failure rolls back every group" is
  accurate. Suggested follow-up: check registration and hash freshness for every world before step (a).
- [note] `scripts/dev-seed.ts:78-88`: every folder under `packs/` goes through `loadSeedInputs` in one
  `Promise.all`, even with `--pack`. One pack that fails to parse (an in-flight edit, or a folder with no
  `pack.yaml`) blocks every run, including `--pack <some-other-pack>`, so narrowing can't route around a broken
  pack. The run fails before any DB write (after the guard, before `sql()`), so this is safe. It is a
  usability gap, not a data risk. The rejected promise also doesn't say which folder failed unless the
  loader's own error includes the path.
- [note] `scripts/dev-seed.ts:55-65`: `--pack` with no value, or followed by another flag, throws before any
  write. `--pack=prod-prompting` and misspelled flags (`--packs x`) are silently ignored, and the run falls
  back to seeding every pack. That is the safe default, but the user's narrowing is lost without a message.
- [note] `scripts/dev-seed.ts:97,142-146`: on a narrowed run, `skipped` also lists packs without questions
  (`team-onboarding-sample`), under "their demo groups are gone". That pack never had a demo group, so the
  line misreports it.
- [note] `scripts/dev-seed.ts:104-117`: the CLI passes the **folder name** as `packSlug`, while
  `loadSeedInputs` stamps questions with `pack.yaml`'s `slug`, and `planDemoWorld` filters on that slug.
  `resolveSeedPacks` counts all loaded questions, unfiltered. If a folder name and its slug ever differ, the
  pack passes selection, plans zero attempts, and then fails as "not registered", after the deletes in the
  first note. All three packs match today, and `sync-question-keys.mjs` uses the same folder-name convention.
  Passing `inputs.pack.slug` would remove the gap.
- [note] `src/dev-seed/__tests__/mf-0034-seed.db.acceptance.test.ts:76`: the plan is built with
  `now: new Date()`, which `testing.md` advises against ("never depend on today's date"). The run-scoped names
  use `Date.now()` / `Math.random()`. It follows the MF-0029 DB test's pattern and the file is frozen, so this
  is recorded only.
- [note] SC coverage: no frozen test proves the cross-pack rollback (GOAL "Riskiest step"). The probe above
  is the only evidence. SC-5's per-pack count equality does indirectly prove the manifest records your ids
  from **every** world, not just the last one.

No calculation-parity, authorization or PII surface: dev-only script, local stack, no app screen or DTO.
No changes outside the plan's `owns` among the 6 paths. No slug is hard-coded in `src/dev-seed/**`
(non-test). Dates are only serialised for DB inserts (`toISOString()` for `timestamptz`, not for bucketing).

## Delta review

**Verdict: approve** (0 blocking, 3 notes). Rebound from `4d9317f3…` to
`beb27b0debf3e60d19f670fa16a372f61c8d1a3cd5c9fddff36b05ab100aacdc`, which is `git diff HEAD | shasum -a 256` over the 7 paths:
the 6 above plus `src/dev-seed/__tests__/mf-0034-regressions.db.test.ts`. The 4 untracked files were marked `add -N`
and reset afterwards. It matches the LOOP-VERIFY receipt. Only the post-review changes were re-read. The rest of the
diff is as approved above.

### What was checked

- **Pre-delete check runs first.** `seed-demo-world.ts:133` runs `assertWorldSeedable(sql, world)` for every world.
  Before it run only `sharedLearners`, `assertDemoDomain` and the you-is-not-demo check, which are pure with no
  DB call. After it come the `auth.users` select and deletes (`:136-143`), the creation of you (`:148`), the delete
  of your attempts (`:151-154`) and the creation of the learners (`:158-166`).
- **In-transaction check not loosened.** The body of `assertWorldSeedable` (`:29-56`) matches the removed inline
  code word for word: the same 4 queries, conditions and error messages (not registered, stale or missing item,
  `rejected`, self-review). It runs on `tx` at `:178`. The order changed: all reviews of a world are now checked
  before any of its inserts, where before the checks were interleaved. The outcome is the same, because
  `private.item_state` returns `rejected` only from `private.flag_resolutions` (`20261103160000_mf0007_reviews.sql:142`,
  never redefined), and the seeder never writes that table. Hash and author come from `private.items`, which the
  transaction doesn't write either. A throw still rolls back the whole transaction. The second run inside the
  transaction covers changes between the pre-check and `begin`.
- **No path skips it.** `seedDemoWorld` forwards to `seedDemoWorlds` (`:95`). The only non-test caller is
  `scripts/dev-seed.ts:123`. An empty `worlds` throws in `sharedLearners`.
- **Regression test is not vacuous.** It compares the demo **user ids** and the group count before and after.
  Without the pre-check, step (a) deletes those users and (d) creates new ones, so the ids would differ, as the RED
  output in LOOP-VERIFY shows. `before.groups` is asserted as 1. The regexes `/not registered/` and `/stale/` tell
  the two refusals apart, and the stale case throws if the plan has no review. The run-scoped domain is isolated.
  `pnpm vitest --project db src/dev-seed`: 4 files, 10 tests green. Unit: 6 files, 18 tests. Typecheck green.
  Biome is clean on `src/dev-seed` and `scripts/dev-seed.ts`. Both frozen sha256 still match FROZEN.json.
- **CLI refuses before any DB call.** `parseArgs` (`:79`) and `resolveSeedPacks` (`:94`) run before `sql()` and
  `listResolvedItems` (`:102-104`). Before them come only the env guard and `stackEnv()`, which runs
  `supabase status` and makes no DB connection. An unknown flag, a missing value, a non-integer seed, an unknown
  pack or a pack without questions all throw first. A narrowed run loads only the named folders (`:84-93`), and an
  unknown name is still refused, because `known` is built from what was loaded. `packSlug` now comes from
  `inputs.pack.slug` (`:112`). The skip message (`:144-154`) is accurate for both narrowed and full runs.

### Findings

- [note] `src/dev-seed/__tests__/mf-0034-regressions.db.test.ts:83,103`: both cases pass `previous: null`, and YOU
  already exists, so step (b) (delete your previous attempts) and the creation of you in (c) never run. If the
  pre-check moved down below (b) or (c), the test would stay green, and you would lose your previously seeded
  answers. The `rejected` and self-review branches of the pre-check also have no test. The code as written is
  correct (`:133` runs before all of them). Only the regression guard is narrower than the claim "before anything
  is deleted".
- [note] `src/dev-seed/seed-demo-world.ts:161`: the pure "learner not on the demo domain" check still runs after
  the deletes and after some learners are created. The planner always builds demo-domain learners, so this can't
  happen today. It could join the pre-check at no cost. Other failures after the deletes (admin `createUser`,
  insert constraints) still leave group-less demo users. That behaviour dates from MF-0029, and a re-run recovers.
- [note] `scripts/dev-seed.ts:61`: `--seed ""` is `Number("") === 0`, so it is accepted silently as seed 0. That is
  harmless (it's an integer, and nothing is written outside the demo world), and recorded only.

## Delta review 2

**Verdict: approve** (0 blocking, 2 notes). Rebound from `beb27b0d…acdc` to
`e6c0213705b4c8cc175911ad4ae41e3b84aaa523f309805361ef6d7e4dd93768`, which is `git diff HEAD -- <the 7 paths> | shasum -a 256`.
Nothing is untracked any more, so `add -N` was not needed. HEAD is now `da583a0`, which already contains the work approved
above, so this hash covers only the 3-file delta (`seed-demo-world.ts`, `mf-0034-regressions.db.test.ts`, `scripts/dev-seed.ts`).
Only that delta was re-read.

### What was checked

- **Domain check moved, nothing else did.** The diff in `seed-demo-world.ts` has two hunks. The first adds the learner loop
  at `:133-140`, just before `assertWorldSeedable(sql, …)` (`:141`) and step (a) (`:143`). The second removes the same
  check from step (d) (`:164-171`). The comment wording changed. No other line moved.
  - The condition is the same as before. Every learner except `persona === "you"` is checked against `suffix`. The
    lower-cased email is used and the message is the same. `you` still goes through the existing `you.endsWith(suffix)`
    refusal (`:130`).
  - `learners` is `sharedLearners(worlds)`, the same list that (d) iterates. So no learner that (d) creates bypasses
    the check.
  - The delete in (a) still filters on `suffix`. The only `createConfirmedUser` calls are (c), for your own non-demo
    email, and (d), for learners that are now proven to be on the demo domain. No non-demo email can be created or
    deleted. A refusal now happens before any delete or create, not partway through (d).
- **Regression cases can't pass vacuously.**
  - Every case passes `previous: first`. YOU already exists, so (c) reuses `youId === first.youId` and (b) would
    delete `first.youAttemptIds`. If any refusal moved below (a), the demo user ids would change. If it moved below
    (b), `yourSeededAnswers` would drop. Either way the `toEqual(before)` check at `:87` would fail.
  - `before.groups === 1` and `before.yourSeededAnswers === first.youAttemptIds.length` are asserted first. A
    scratch probe of the same plan gives 88 of your attempts, 1 `flag` review and a `steady` learner, so every
    fixture lookup is non-empty. The test itself doesn't assert `first.youAttemptIds.length > 0` (see the first note).
  - Each `rejects.toThrow` regex matches only its own message in `assertWorldSeedable` or the domain loop, so a
    different refusal can't satisfy another case.
  - The self-review case sets the reviewer to the registry's `author_email`, which is lower-cased in the query and
    in the comparison. The rejected case inserts `action = 'reject'` for the registry's current hash, which
    `private.item_state` checks first.
- **Cleanup.** `afterAll` deletes `flag_resolutions` by the run-scoped comment before it deletes YOU. Because
  `resolved_by` is `on delete set null`, the order doesn't matter anyway. It also runs when a case fails after the
  insert. After the run there were 0 rows with `comment like 'mf0034r %'` and 0 `auth.users` matching `mf0034r`.
- **Order.** Vitest runs the cases in file order, and only the last case writes anything (the reject row). The
  earlier cases leave state untouched when the code is correct. If one of them deleted something, the next case's
  `before` assertions would fail loudly, so a failure can't be hidden. Even if the reject row came earlier, the
  unregistered check, the domain check and the stale check (on `reviews[0]`) fire before the rejected check is reached.
  Only the self-review case would depend on whether the flagged review sorts after `reviews[0]`.
- **CLI.** `scripts/dev-seed.ts:62` refuses an empty or whitespace-only `--seed` before `Number.isInteger`. This is
  still in `parseArgs`, before any DB call.
- **Gates.** `pnpm vitest --project db src/dev-seed`: 4 files, 13 tests green. Unit: 6 files, 18 tests. Typecheck green.
  Biome is clean on `src/dev-seed` and `scripts/dev-seed.ts`. Both frozen sha256 still match FROZEN.json.

### Findings

- [note] `src/dev-seed/__tests__/mf-0034-regressions.db.test.ts:76`: the "your answers survive" half asserts
  `before.yourSeededAnswers === first.youAttemptIds.length` and never asserts that the length is above 0. If a future
  planner change gave you no attempts, that half would pass vacuously while the user-id half still guarded the
  deletes. Today the length is 88.
- [note] Hash scope: because the earlier MF-0034 work is now in `HEAD` (`da583a0`), `git diff HEAD` over the 7 paths
  covers only this delta. A future rebind has to use the same base, or diff against the pre-ticket base, for the
  hashes to be comparable.
