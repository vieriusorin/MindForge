---
verdict: approve
reviewed_hash: adebb2c85b1ff6ba5e12de6861b76997ace2aeb23fec4e441483074d999f3a4a
reviewed_at: 2026-11-05T15:02:31Z
---
<!--
reviewed_hash = sha256 of `git diff HEAD` (tracked changes, .planning included). `git diff HEAD` does not
cover untracked files, so the untracked set reviewed with it (src/, scripts/, .planning/tasks/MF-0052/ minus
this file, sorted by path and concatenated) is bound separately:
untracked_hash: 98f4fa84f42080d48605d2e1c663cd42a83733a9b5e3c6b4e9c64ad6bc4a7097
`pnpm ticket:verify` does not exist in this repo (no ticket:* scripts), so there is no receipt hash to bind to.
Re-run by the reviewer: `pnpm typecheck` 0, `pnpm lint` 0, vitest over src/dev-seed src/engine/storm
src/features/{storm,app-shell,review} src/lib src/server/storm: 54 files / 221 tests passed. Frozen hashes:
all 5 MF-0052 files and the re-frozen MF-0013 file match their FROZEN.json sha256.
-->

## Findings

No blocking findings.

### Checked and holding (what the tests can't see)

- **Deletes (Q1).** There are three deletes:
  - `seed-demo-world.ts:318-329`: your previous rows. Each one is `id = any(manifest ids) AND user_id = youId`, guarded by `previous.youId === youId` (`:316`). The deletes run inside the write transaction.
  - storm answers: deleted by `storm_id` before their storms, because of `on delete set null`.
  - `:286-293`: demo users, by the `@<demoDomain>` suffix, via the admin API, unchanged from MF-0034.

  No delete can reach a hand-played storm, its attempts, or another user's rows. After `db:reset` the new `youId` differs from the manifest's, so nothing is deleted. Every input check for every world runs before the first delete (`:279-283`):
  - `assertWorldSeedable`
  - `assertStormsSeedable`
  - `assertNoUnfinishedStorm`
- **Unfinished storms (Q2).** Storms are inserted and finalized one at a time inside the transaction (`:401-458`). After each finalize, the code asserts the storm is finished and nothing was voided (`:448-456`). Before commit it asserts that no seeded user has an unfinished storm (`:474-479`). An unfinished storm of yours is refused up front (`:175-183`). A crash or throw rolls everything back, so no unfinished storm can survive.
- **Grading owner (Q3).** `storm_questions` is inserted without `correct` (`:420-427`), and `private.finalize_storm` grades the storm and writes its attempts (`:447`). The planner's `isKey` (`plan-demo-world.ts:420`) is used only by the pure Tree self-check and is never written.
- **SC-1.** Exam packs rank last, with a slug tie-break (`plan-demo-world.ts:822-831`), and your join is `base + rank` minutes. The result is deterministic and strictly newest.
- **SC-2.**
  - The sidebar renders Storm only when `stormHref !== null`, and the layout passes `null` when `!pack.exam`.
  - Both pages return `StormUnavailable` and keep the unknown-slug `notFound()`.
  - As the brief says, `notFound()` inside the page's `<Suspense>` already streamed a 200 before this ticket. That is pre-existing, not a regression.
- **SC-6.** `reviewQueueOwners` puts you first and runs read-only: it rolls back each probe and treats 42501 as an empty queue. The closing output names one account per pack (`scripts/dev-seed.ts:137-158`).
- **SC-11.**
  - The verdict is `stormSurvived(scoreStorm(...))` in `recent-storms/utils.ts:41-47`, with no arithmetic in the view.
  - The read is RLS-bound, uncached, and under its own `<Suspense>` with a sized skeleton.
- **Project rules.** All of these hold:
  - shadcn only, tokens only;
  - Server Components without hooks;
  - folder layout, and `utils.ts` exports tested;
  - import direction respected, no new `as` casts;
  - explicit return types on exports;
  - no `"use cache"` on per-user reads.
- **MF-0013 re-freeze (Q6).** The diff only adds a `playable` column and filters `D2` / `D1` through it. `D2_13` is unchanged; `start_storm` checks the 12-question cap before playability, so that case still exercises the cap. There are zero `expect` lines changed. The history entry records the user's approval.

### Major (non-blocking for the code, blocking for DONE)

- [major] `.planning/tasks/MF-0052/GOAL.md:121-124` (SC-9) and `:96-99` (SC-2, page half): the GOAL names a browser check on :3001 as the proof, including "one interaction works on each (answer, start, approve)". What was done:
  - The iteration log (`GOAL.md:152`) records a **curl walkthrough with a minted session**, because the shared browser was locked.
  - There is no `.planning/evidence/MF-0052.md` and no receipts file.

  A curl GET cannot show that answering, starting or approving works. So SC-9's interaction half and the SC-2 browser half are unproven. **Failure scenario:** a hydration or Suspense error on a client island (StormStart, ApproveAnalogyButton, the Walk session) returns a 200 page to curl but breaks the click. Run the browser walkthrough after `pnpm db:reset && pnpm dev:seed` and record it in the evidence bundle before marking DONE.
- [major] `src/server/db/__tests__/mf-0013-storms.db.acceptance.test.ts` and `.planning/tasks/MF-0013/FROZEN.json` are changed but sit in no task's `owns` (`LOOP-PLAN.md:663-736`). The plan also says "Frozen files this will re-freeze: **None**" (`LOOP-PLAN.md:266`).
  - The change itself is user-approved and correct (Q6).
  - **Failure scenario:** the plan's own EVAL rule, "every changed file inside an `owns`" (`LOOP-PLAN.md:653`), fails on these two paths.
  - **Fix:** amend the plan (the re-freeze row plus an `owns` entry) so the record matches the tree.

### Minor

- [minor] `scripts/dev-seed.ts:133-136`: the manifest is written after the transaction commits.
  - **Failure scenario:** the process dies between the commit and `writeFileSync` (Ctrl-C, disk full, `reviewQueueOwners` is not the cause since it runs after). The next run then reads the previous manifest, whose ids are already gone. It deletes nothing of this run, and you end up with 2 Full + 2 Boss storms and duplicated practice answers.
  - This shape is pre-existing for attempts and needs a crash at one exact point, so it is not blocking.
- [minor] `src/dev-seed/plan-demo-world.ts:820` and `:661`: `base` (the join time) comes from **practice** answers only, while demo storms start at `now − 10 d`.
  - It holds today because practice history spans about 3 weeks. Nothing asserts that a storm starts after every join.
  - **Failure scenario:** a pack or persona with a practice window shorter than 10 days puts storm answers before the joins. That breaks SC-1's "every join precedes the first answer" (the frozen DB test reads `min(answered_at)` over all attempts) without a planner throw.
  - **Fix:** add one assertion in `planDemoWorlds`.
- [minor] `src/dev-seed/plan-demo-world.ts:566`: a Boss skill whose questions would overflow `BOSS_STORM_SIZE` is skipped silently. If every skill overflows, `bossAnswers` is empty and the storm gets `endsAt === startedAt`, which violates `storms_ends_after_start`. That fails in the transaction and rolls back cleanly, but the message is an opaque check violation, not a planner error.
  - Unreachable on ccdv-f (2-3 questions per skill).
- [minor] `src/dev-seed/plan-demo-world.ts:491-492` (`?? ""` on `domainCode` / `contentHash`) and `src/features/storm/components/recent-storms/utils.ts:23` (`domainCode ?? ""`): these are silent defaults, which `engineering-principles.md` §3 ("Fail fast") forbids.
  - Today they are unreachable: `stormPool` filters both maps, and the DB check `storms_boss_has_domain` guarantees a Boss has a domain.
  - Prefer a throw.
- [minor] The seed's in-transaction playable predicate (`seed-demo-world.ts:429-442`) omits `start_storm`'s `k.pack_slug <> p_pack_slug` term (`20261104130000_mf0013_storms.sql:251`). The pre-delete check also never compares the planned `skill_code` with the key's `skill_code`, while `finalize_storm` writes attempts with the key's skill. Both are harmless while keys are synced from the same pack files, but the comment calls this "the exact SQL" of `start_storm`, and it is not.
- [minor] `src/app/(app)/play/[packSlug]/storm/boss/[domain]/page.tsx:35-43`: on a pack without an exam, **any** domain segment (`/storm/boss/garbage`) renders the 200 empty state instead of a 404. This matches the plan ("before the domain check") and SC-2's wording. Noted so the behaviour is a deliberate choice.
- [minor] Verdict wording differs across two linked screens.
  - The list uses `"Survived"` / `"Not survived"` (`recent-storms.tsx:8-10`, secondary/destructive).
  - The report it links to uses `"Survived"` / `"Not yet"` per domain (`storm-report/storm-report.tsx:73-74`, default/outline).

  Both come from `scoreStorm`, so there is no figure divergence. But a Boss row badged "Not survived" opens a report whose one domain reads "Not yet".
- [minor] There are two unrelated exported types named `RecentStormRow`:
  - the zod DB row in `src/server/storm/types.ts:95`;
  - the view row in `src/features/storm/components/recent-storms/types.ts:13`.

  Both are reachable from the same page, so a wrong import type-checks only by luck of shape mismatch.
- [minor] GOAL SC-11's proof names a "ui test of the list" (`GOAL.md:127-128`), but only `utils.test.ts` and the frozen `.ts` acceptance test exist. The "none → no list" branch (`recent-storms.tsx:18`) is covered only by the browser check. Under `testing.md` a presentational component needs no ui test, so either add one or amend the proof line.
- [note] `packs.zip` (446 KB, untracked, repo root) is not part of this ticket. Leave it out of the commit.
