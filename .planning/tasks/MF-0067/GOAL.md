---
ticket_id: MF-0067
title: "Retry-safe answers: idempotency key on record_attempt (slice F)"
tier: high-risk                   # SECURITY DEFINER function signature, grants test re-freeze
stage: handoff
branch: MF-0067
builds_on: [MF-0062]
last_iteration: 0
goal_status: complete-pending-manual-commit           # reserved by MF-0062 (council split, user decision D-1); picked up with /gsd-goal-loop MF-0067
---

> Reserved 2026-11-06 from MF-0062 (learning-path council, split slice). Decisions D-1..D-6 and findings live in
> `.planning/tasks/MF-0062/GOAL.md`; re-derive each fact at pickup (`## Facts`) before asking the user.

## Objective

Today a learner whose "Check answer" request is sent twice (a retry after "Could not reach the server. Try again."
when the first request did commit, a replayed Server Action, a request sent twice in flight) gets two `public.attempts` rows, and
the FSRS replay counts two reviews of one answer, so a single correct answer can grow a tree twice as fast.

End state: every app answer carries a client attempt id (a uuid minted when the learner submits, kept for a retry
of that same submission). `record_attempt` stores it under a unique `(user_id, client_attempt_id)`; a repeat with
the same id and the same answer returns the first grade and writes nothing; a repeat with the same id and a
different answer is refused. Concurrent repeats yield exactly one row. No session or telemetry tables (D-5).

## Facts (re-derived 2026-11-06 at pickup, branch MF-0067 off main 660f1c1)

- F1 `record_attempt` today: `private.record_attempt(text, text[], text default null)` (security definer,
  `search_path=''`) + `public.record_attempt(text, text[], text default null)` (sql, invoker wrapper), both
  `supabase/migrations/20261104150000_mf0032_attempt_content_hash.sql:21,80`. Returns `boolean`. Grants: execute to
  `authenticated` only (revoked from public, anon) `:88-91`. Inserts one row per call `:73-74`, no idempotency.
- F2 MF-0032 precedent for a signature change: **dropped** the old signature (`drop function … (text, text[])`,
  `:18-19`) and created the new one with the new parameter `default null` so SQL callers, the dev seed and frozen
  tests on the shorter form keep working, while "the app always sends it" (`:4-5`). No overload stays callable.
- F3 App callers (grep `record_attempt` in `src/`): exactly two, `src/server/attempts/grade-answer.ts:60` (Duel,
  Walk, Seed Planting via `answerQuestion` / `answerWalkQuestion` / `answerSeedCheck`) and
  `src/server/attempts/grade-cuckoo.ts:59` (`answerCuckoo`). Inputs are parsed by `AnswerInput`
  (`src/lib/answer-input.ts`, shared with walk via re-export) and `CuckooAnswerInput`
  (`src/features/cuckoo/schemas.ts`), both `z.strictObject`.
- F4 Other writers of `public.attempts`: `private.finish_storm` (MF-0013, `20261104130000_mf0013_storms.sql:158`),
  already idempotent by `unique (storm_id, question_id)`; seed/test SQL inserts. None call `record_attempt`.
  `scripts/dev-seed.ts` mentions attempts but does not call the RPC (grep). These rows keep `client_attempt_id null`.
- F5 Client hooks (`use-duel-session.ts`, `use-walk-session.ts`, `use-seed-checks.ts`, `use-cuckoo-session.ts`)
  all call `mutation.mutate({...})` in `submit()`, guarded by `useSingleFlight` (MF-0026) against a double click.
  TanStack mutations default to `retry: 0` (`src/lib/query-client.ts` sets no mutation default), so the retry is
  the learner's second click after the error "Could not reach the server. Try again." `toggle`/`choose` stay
  enabled after an error, so the learner can change the answer before retrying. All four hooks already use
  `useMutation` (migrated, not grandfathered).
- F6 Grants acceptance test: `src/server/db/__tests__/mf-0032-attempt-hash.db.acceptance.test.ts:191-212` (MF-0032
  SC-7) pins the pg_proc list for `record_attempt` to exactly the two 3-arg signatures, `authenticated` true,
  `anon` false. Any added parameter breaks it: re-freeze unavoidable.
- F7 Frozen app-level payload pins (read): `src/features/__tests__/mf-0032-answer-hash.acceptance.test.tsx:75,91,106`
  `toEqual(EXPECTED)` on the exact action payload; `mf-0032-changed-message.acceptance.test.ts:17-21,64` an INPUT
  without an id and `gradeAnswer` `toHaveBeenCalledWith({ userId, ...INPUT })`;
  `mf-0058-recorder-failure.db.acceptance.test.ts:110-115` calls `answerQuestion` without an id and expects `ok`.
  `mf-0016-cuckoo-session.acceptance.test.tsx:75` uses `expect.objectContaining` (holds). DB tests MF-0003,
  MF-0016, MF-0025, MF-0058 call the RPC without the new parameter (hold under `default null`).
- F8 FSRS replay: `src/server/memory/fetch-attempts.ts` returns every row; `replayMemory`
  (`src/engine/memory/replay.ts`) runs one `scheduler.next` per attempt, so two rows = two reviews.
- F9 `recordCourseCompletion` (MF-0058) is a no-op once its row exists, so running it again on a replayed correct
  answer is harmless.
- F10 Baseline: main CI `success` on 660f1c1; preflight below.

## Affected

- **Roles:** learner (every practice mode that records an attempt). No admin surface. Nothing new on screen.
- **Surfaces:** `public.attempts` (new column + unique constraint), `private.record_attempt` / `public.record_attempt`
  (signature), `src/server/db/database.types.ts`, `src/server/attempts/grade-{answer,cuckoo}.ts`,
  `src/lib/answer-input.ts`, `src/features/cuckoo/schemas.ts`, the four session hooks, a new shared
  `src/lib/attempt-id.ts` + `src/lib/use-attempt-id.ts`.

## Decided by the user (2026-11-06)

- D-5 (MF-0062 GOAL): retry-safe answers only; no session or telemetry tables.
- U-1 Merge: the orchestrator commits, pushes, opens the PR and merges; this ticket never commits.
- U-2 Approvals: high-risk plan (and the re-freeze batch it lists) approved by the orchestrator agent; a
  fresh-context diff reviewer runs before merge. `pnpm db:reset` on the LOCAL stack is allowed, under the db lock.
- U-3 / U-4: not applicable to this ticket.
- 2026-11-07: the re-freeze batch (MF-0032 ×4 files, MF-0058 ×1, listed in LOOP-PLAN) is APPROVED by the user. Recorded in both FROZEN.json history entries.

## Decided without a question

- DQ-1 New parameter `p_client_attempt_id uuid default null`, appended as the 4th parameter; the 3-arg signature is
  dropped (MF-0032 pattern, F2). Return type stays `boolean`. Minimal for MF-0065, which changes the function next.
- DQ-2 "New calls must send it" is enforced at the app boundary, not by a DB `NOT NULL` parameter: both zod input
  schemas require `clientAttemptId: z.uuid()` and `GradeAnswerInput` / `GradeCuckooInput` make it a required field.
  A DB-required id adds no integrity: any client can mint a fresh uuid per call, so the DB can never tell a retry
  from a new answer without the client's cooperation. `null` keeps the pre-MF-0067 behaviour for SQL callers,
  storms, seeds and the frozen MF-0003/0016/0025/0058 DB tests (F4, F7). Source: F2 precedent + this analysis.
- DQ-3 Replay is checked FIRST (after auth and input bounds, before the key lookup and the hash check): a retry of
  an accepted answer returns its stored grade even if a sync changed the key or the registry hash in between.
  The first grade is the record; re-grading a retry would be a second judgement of one answer.
- DQ-4 "Same answer" = same `question_id`, exactly equal `chosen` array, and (when the retry sends a hash) the same
  content hash as stored. Anything else with a seen id is refused with SQLSTATE `23505` and the message
  `client attempt id already used for another answer`; nothing is written. The app maps it to the existing
  `not-gradable` message (no new `GradeError` member, so no message table changes); only a buggy or hostile
  client can reach it, because the hook binds the id to the submission (DQ-5).
- DQ-5 Client: the id is minted at submit for a submission = (item id, chosen answer). A second submit of the same
  submission (retry after an error) reuses it; a changed answer mints a new id (the learner never saw a grade, so
  it is a new answer); `next()` clears it, so a later identical submission in the same session is a new attempt.
  Randomness is injected (`crypto.randomUUID` passed into the pure util). The id lives in a ref, not state.
- DQ-6 Race: `insert … on conflict (user_id, client_attempt_id) do nothing`; if nothing was inserted, a new
  statement reads the committed winner (READ COMMITTED, fresh snapshot per plpgsql statement) and applies DQ-4.
  No row lock is taken and nothing is timestamped on replay, so the clock_timestamp rule does not apply.
- DQ-7 The unique key is per user: another learner sending the same uuid gets their own row and learns nothing
  about the first learner's answer.

## Success Criteria

- [x] SC-1: A first call with a new `p_client_attempt_id` grades as before and writes exactly one row whose
  `client_attempt_id` is that uuid. Proof: `src/server/db/__tests__/mf-0067-retry-safe.db.acceptance.test.ts`.
- [x] SC-2: A repeat with the same id, question, chosen and hash returns the first grade and writes nothing: one
  row, same `id` and `answered_at`; a wrong first answer stays `false`; a repeat after the key changed to make it
  right still returns the first grade; a repeat after the registry hash changed (sending the old hash) returns the
  first grade, not 55000. Proof: same file.
- [x] SC-3: A repeat with the same id but a different question, a different `chosen`, or a different content hash
  is refused with SQLSTATE `23505` and writes nothing; the stored row is unchanged. Proof: same file.
- [x] SC-4: Learner B sending learner A's id gets B's own fresh grade and row; A's row is untouched and B reads no
  row of A's. Proof: same file.
- [x] SC-5: Two concurrent calls with the same id yield exactly one row: the second call waits until the first
  commits (ordering witness `isReleasedAtResponse: true`) and returns the same grade. Proof: same file; non-vacuous
  by a run against a variant without the unique constraint (check-then-insert), recorded RED in LOOP-VERIFY.
- [x] SC-6: FSRS replay counts one review for a repeated id: after two calls with one id, `fetchAttempts` returns 1
  attempt and `replayMemory` gives `successfulRecalls: 1` (two distinct ids give 2). Proof: same file.
- [x] SC-7: Only the 4-arg signature `record_attempt(text,text[],text,uuid)` exists (private and public);
  `authenticated` may execute, `anon` may not; `attempts.client_attempt_id` is a nullable uuid with a unique
  `(user_id, client_attempt_id)`; `authenticated` still has no INSERT/UPDATE/DELETE on `attempts`; a call without
  the id still writes a row each time (legacy null path). Proof: same file + re-frozen MF-0032 SC-7.
- [x] SC-8: Every grading action refuses an input without a valid `clientAttemptId` uuid ("Pick an answer first." /
  "Pick a line first.", the existing parse failure) and forwards a valid one to the grading path, which sends it as
  `p_client_attempt_id`. Proof: `src/features/__tests__/mf-0067-attempt-id-input.acceptance.test.ts` (Duel, Walk,
  Seed Planting, Cuckoo) + inner `src/server/attempts/__tests__/grade-{answer,cuckoo}.test.ts`.
- [x] SC-9: In Duel, Walk, Seed Planting and Spot the Cuckoo, the first "Check answer" sends a uuid; after a network
  failure, "Check answer" again with the same choice sends the SAME id; after changing the choice it sends a new
  id; after a graded answer and "Next", the next question sends a different id. Proof:
  `src/features/__tests__/mf-0067-attempt-id.acceptance.test.tsx` + `src/lib/__tests__/attempt-id.test.ts`.
- [x] SC-10: Gates: `pnpm typecheck && pnpm lint && pnpm test` exit 0; `pnpm test:db` exit 0; `pnpm build` exit 0;
  `pnpm gate:planning` and `pnpm gate:workspace` exit 0; `pnpm db:types` regenerated; browser smoke on the local
  stack: one Duel answer as the demo learner shows its verdict and writes one row with a non-null
  `client_attempt_id` (SQL read-back). Evidence in `.planning/evidence/MF-0067.md`.

### Edge-input table (SC-1..SC-5, the grade returned)

| Input state | Result | Decided by |
|---|---|---|
| id `null` (SQL caller, legacy) | grade + new row every call | DQ-2 |
| id new | grade + one row with the id | SC-1 |
| id seen, same q / chosen / hash | first grade, no write | SC-2 |
| id seen, first grade `false` | `false` | SC-2 |
| id seen, key changed since | first grade (stored) | DQ-3 |
| id seen, registry hash changed, old hash sent | first grade, not 55000 | DQ-3 |
| id seen, retry sends hash `null` | first grade (hash not compared) | DQ-4 |
| id seen, other question | 23505, no write | DQ-4 |
| id seen, other chosen (incl. reordered) | 23505, no write | DQ-4 |
| id seen, other hash | 23505, no write | DQ-4 |
| id seen by another user only | own grade + own row | DQ-7 |
| first call refused (42501/22023/P0002/55000) | no row; a retry is a first call | function order |
| two calls in flight | one row; second waits, same grade | SC-5 |

### Edge-input table (SC-9, the id sent)

| Client state | Id sent | Decided by |
|---|---|---|
| first submit of a question | new uuid | DQ-5 |
| resubmit after network error, same choice | same uuid | DQ-5 |
| resubmit after server refusal (`ok: false`), same choice | same uuid (nothing was written) | DQ-5 |
| resubmit after changing the choice | new uuid | DQ-5 |
| after "Next" | new uuid | DQ-5 |

## Constraints → how met

- Migrations: RLS on (unchanged), `revoke all` before grants (execute revoked from public/anon/authenticated on
  private, from public/anon on public, then granted to authenticated), definer only in `private`, `search_path=''`.
- Validate at the boundary: zod `z.uuid()` in both input schemas; the DB trusts the uuid type.
- Server owns facts: grade, pack, skill, hash, `answered_at` still come from the DB; the client id only names the
  submission.
- MF-0065 rebases on this: signature change kept to one appended parameter, documented in the migration header.
- Never `as`-cast: types inferred from zod and the regenerated DB types.

## Concerns

| # | Collision | Owner | Status |
|---|-----------|-------|--------|
| C-1 | Brief: "new calls must send it" vs a `default null` DB parameter | agent (DQ-2) | resolved: enforced at the app boundary; DB `null` = legacy path, rationale in DQ-2; reviewer to confirm |
| C-2 | Four frozen files of MF-0032/MF-0058 pin the old signature or payload (F6, F7) | user | resolved: re-freeze batch approved by the user 2026-11-07 |
| C-3 | Learner changes the answer after a network error whose first request did commit → two attempts for that question | agent (DQ-5) | accepted: the learner never saw a grade; binding the id per question would refuse the new answer with no way forward. Same class, also accepted: in a multi-select question, un-picking and re-picking the same options after an error changes the click order (`toggleChoice` appends), so `chosen` differs, a new id is minted and a second row is possible if the first request committed; never a false 23505 (review note 5) |

## Out of Scope

- Session or telemetry tables (D-5). Persisting the id across a page reload (a reload is a new submission).
- Confidence grading (MF-0065), which changes `record_attempt` again on top of this.
- Back-filling ids on existing rows (they stay `null`).
- Two tabs (or two page loads) answering the same question: each mints its own id, so each answer is recorded. Retry safety covers one submission resent, not two independent submissions (MF-0067 review note 4).

## Open questions

- None.

## Iteration Log

<!-- append-only -->
- 2026-11-06 reserved from MF-0062.
- 2026-11-06 picked up (branch MF-0067, issue #102). Facts F1-F10 re-derived.
- 2026-11-06 design preflight: `pnpm typecheck && pnpm lint && pnpm test` exit 0 (195 files, 1085 tests) · `pnpm test:db` exit 0 (34 files, 181 tests) after `pnpm db:reset` exit 0 (local stack, db lock, U-2) · `pnpm build` not run: baseline main CI `success` on 660f1c1 builds it; runs in TEST · `pnpm gate:planning` / `pnpm gate:workspace` run in TEST · `pnpm db:types` BUILD step under the db lock · main CI `success`.
- 2026-11-06 RED + freeze: 3 acceptance files frozen (FROZEN.json), red for the SC's reason: DB `PGRST202` (4-arg function missing) + SC-7 signature list; SC-8 parse accepts no id / refuses the id; SC-9 `toMatch() … got undefined`. The SC-5 non-vacuity proof (variant without the unique key) runs after BUILD, per SKILL 2b.
- 2026-11-07 PLAN: LOOP-PLAN written; `pnpm ticket:collisions MF-0067` exit 0 after listing 5 re-freezes (MF-0032 x4 files, MF-0058 recorder-failure) and 8 read-and-hold files. Plan + re-freeze batch go to the orchestrator for approval (U-2); BUILD continues meanwhile, and the approval is named as pending in the hand-off. Port change from the orchestrator: browser check on `next dev -p 3002` under the web lock; never touch :3001.
- 2026-11-07 BUILD + TEST: migration `20261106160700_mf0067_attempt_idempotency.sql`, db types, schemas, graders, `src/lib/attempt-id.ts` + `use-attempt-id.ts`, 4 hooks. Re-froze 5 files (MF-0032 ×4, MF-0058 ×1), with history in their FROZEN.json. SC-5 variant (no unique key) RED, `isReleasedAtResponse: false`. Ladder: typecheck 0 · lint 0 · test 1114/1114 · test:db 190/190 · build 0 · gate:planning ok · gate:workspace ok · MF-0060 checker ok. Browser smoke not run: the shared devtools profile was held by another session, and :3002 was held by the user's main-checkout server (dev ran on :3003 under the web lock, then stopped).

### Iteration 1

```yaml
phase: 1-complete
verdict: PASS
started_at: "2026-11-06"
completed_at: "2026-11-07"
```

**Result:** PASS on SC-1..SC-9. SC-10's gates pass; its browser smoke was not run (recorded as unverified). The re-freeze batch and the diff review are pending with the orchestrator (U-2).
**Suggested commit message:** `MF-0067 feat: retry-safe answers (client attempt id on record_attempt)`
- 2026-11-07 review (approve, a9ed5e4c6d29) applied: note 2, NULL-question reuse → `is distinct from` in the migration (regression `mf-0067-review.db.test.ts` RED first, then green after an in-place fix and `pnpm db:reset`); note 3, `mf-0067-attempt-id-next.test.tsx` (RED with `clear()` removed); notes 4 and 5 in Out of Scope and C-3; plan nit fixed. Re-freeze batch approved by the user 2026-11-07. Ladder: typecheck 0 · lint 0 · test 1118/1118 · test:db 191/191 · build 0 · gates ok. SC-10's browser part was NOT run: the devtools profile was held by another session through 4 retries, so SC-10 is unticked.
- 2026-11-07 SC-10 browser smoke done (headless Chrome over CDP, :3003, db + web locks, reset + dev:seed): as `lapsed@mindforge-demo.test`, one Walk and one Duel answer showed their verdicts; SQL read-back 51 → 53 rows, one per answer, each with its own `client_attempt_id`, no id duplicated. Screenshots in `.planning/evidence/MF-0067/`. The post-review SQL delta was re-reviewed and approved by the orchestrator. SC-10 ticked.
