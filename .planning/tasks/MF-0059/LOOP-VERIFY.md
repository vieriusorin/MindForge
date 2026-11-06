---
phase: 0-verification
ticket_id: MF-0059
status: in-progress
started_at: "2026-11-06"
resume_with: /gsd-goal-loop
---

# Verification — Iteration 0 (RED)

## RED at freeze (Stage 2b)

Written from the SCs alone (2026-11-06), after the "Expeditions at your own pace" decision (SC-9 carries no
window length; SC-10 is new). FROZEN.json written by the acceptance agent at the coordinator's request (no
`ticket:freeze` script); sha256 over LF-normalised content, same method as MF-0058. Freezing stays the user's
checkpoint. `pnpm typecheck` 0, `pnpm lint` 0. `pnpm test`: 12 failed / 928 passed (940); the 928 are the
design-preflight baseline, every red is in the two engine files below. `pnpm test:db`: 14 failed / 134 passed /
20 skipped (168), 1 failed file (this ticket's); the 134 are the baseline. The DB file was run twice: same reds,
and no rows left (users `mf0059-%`, groups `MF-0059 %`, attempts `%.mf0059-%`: 0).

Stubs added so typecheck stays green and the red is at runtime: `src/engine/path/group-course-step.ts`
(throws, exported from the barrel); `summarizeExpedition` input `endsAt` widened to `Date | null` with
`if (input.endsAt === null) throw new Error("not implemented")` (bounded inputs unchanged; the `"open"` member
of `ExpeditionTimeLeft` is NOT added yet, because `timeLeftLabel` in expedition-card/utils.ts switches on it
exhaustively and would fail typecheck: BUILD adds both).

| SC | Acceptance test | Red reason at freeze (pasted) |
|----|-----------------|-------------------------------|
| SC-1 | `src/server/db/__tests__/mf-0059-path-groups.db.acceptance.test.ts` | `PostgresError: relation "private.path_courses" does not exist`; role select: `AssertionError: authenticated: expected '42P01' to be '42501'` |
| SC-2 | same file | `AssertionError: expected { code: 'PGRST202', …(3) } to be null`; `expected 'PGRST202' to be '22023'`; `group 1: expected 'PGRST202' to be 'ok'` |
| SC-3 | same file | suite `beforeAll`: `Unknown Error: Could not find the function public.create_path_group(p_name, p_path_slug) in the schema cache` |
| SC-4 | same file | suite `beforeAll`: `Could not find the function public.create_path_group(p_name, p_path_slug) in the schema cache` |
| SC-5 | same file | suite `beforeAll`: `Could not find the function public.create_path_group(p_name, p_path_slug) in the schema cache` |
| SC-9 | same file | suite `beforeAll`: `Could not find the function public.create_path_group(p_name, p_path_slug) in the schema cache` |
| SC-10 (DB) | same file | `AssertionError: expected { …(2) } to match object { ends_at: null }`; `PostgresError: new row for relation "expeditions" violates check constraint "expeditions_seven_days"`; `expected 'PGRST202' to be '42501'` (end_expedition); `expected { code: '23P01', … } to be null` (start after end) |
| SC-6 | `src/engine/path/__tests__/mf-0059-group-course-step.acceptance.test.ts` | `Error: not implemented` (typed stub `groupCourseStep`), all 6 cases |
| SC-10 (engine) | `src/engine/expedition/__tests__/mf-0059-open-expedition.acceptance.test.ts` | `Error: not implemented` (`summarizeExpedition` with `endsAt: null`), all 6 cases |

SC-7 (screens) and SC-8 (gates) are browser and gate proofs: no frozen test. SC-10's re-frozen MF-0017 SC-1 and
MF-0052 SC-5 assertions are not part of this freeze (a re-freeze is the user's call).

## T1 — migration applied (2026-11-06, schema-builder)

`supabase migration up --local` → applied `20261106140000_mf0059_path_groups.sql` (no reset). Read-back (1.4):
`select count(*) filter (where pack_slug is null), count(*) filter (where ends_at > now()) from public.expeditions`
→ `0, 0` (7 rows, all 7 now open). `pnpm db:types` → `database.types.ts` +26/−3. `pnpm typecheck` exit 0.

## Lock tests: vacuity check

`src/server/db/__tests__/mf-0059-expedition-locks.db.test.ts`, run against two scratch variants applied with
`create or replace` from `pg_get_functiondef` of the migrated functions, then restored from the saved definitions
(md5 of `prosrc` checked equal to the original after each restore). The variant script lived in the session
scratchpad and is not committed. Green on the real functions before and after each variant (5/5).

**V1, locks removed**: `start_expedition` without `for no key update` on the group row; `end_expedition` without
its `perform … for no key update`. Exit 1:

```
 × (a) a start sent while a move holds the group waits for it, then starts in the NEW course
 × (b) two starts while a REACHED one runs: one opens, the other is 23P01 (never 40P01), the reached one closes at the new start
 × (c) an end sent while a move holds the group waits for it, then finds nothing running (P0002); the move's time stays
AssertionError: waits on the group row: expected false to be true          (a) :246
AssertionError: settled before commit: expected true to be false           (a) :247
AssertionError: expected 'ccdv-f' to be 'prod-prompting'                   (a) :249
AssertionError: waits on the group row: expected false to be true          (b) :267
AssertionError: waits on the group row: expected false to be true          (c) :311
      Tests  3 failed | 2 passed (5)
```

(b) and (c) go red on the lock-order witness only. Without the group lock, the second writer still blocks, but on
the expedition row (the first writer's `update … set ends_at`), and gets the same final code. The witness
(a `tuple` lock on `public.groups` held by a backend that `pg_blocking_pids` says waits on the holder) is what
tells "group row first" from "some row". The 5 concurrent rounds of (b) stay green in V1 for the same reason.

**V2, guards removed**: `advance_group_course` without the `p_from_pack` check (40001); `end_expedition` without
`if not found … P0002`. Exit 1:

```
 × (c) an end sent while a move holds the group waits for it, then finds nothing running (P0002); the move's time stays
 × (d) a stale tab or a double click moves one course, not two: the repeat is 40001
 × (e) an end with nothing running is P0002 and changes no row
AssertionError: expected 'ok' to be 'P0002'                                (c) :313
AssertionError: expected 'ok' to be '40001'                                (d) :332
AssertionError: expected 'team-onboarding-sample' to be 'prod-prompting'   (d) :333  (moved two courses)
AssertionError: expected 'ok' to be 'P0002'                                (e) :338
      Tests  3 failed | 2 passed (5)
```

Every case (a)–(e) is red in at least one variant, so none is vacuous.

## TR — re-freeze (user-approved at plan, 2026-11-06)

RED before the edit, against the T1+T5 tree:
- `mf-0017-expedition.db.acceptance.test.ts` × SC-1: the admin starts one … the database sets a 7-day window from its own clock — `AssertionError: expected { …(7) } to match object { …(6) }` (seven_days null on an open row)
- `mf-0052-seed.db.acceptance.test.ts` × SC-5: each demo group has one active expedition … — `ZodError: … "expected": "string"` (ends_at null)

Edits: exactly the "Exact edits" lines in LOOP-PLAN. Hashes: MF-0017 49372fa5af47… → 5ffd0c659055…; MF-0052
600b19790d65… → 545c1f6a71dc… (FROZEN.json history entries added). After: MF-0017 13/13 green; MF-0052 SC-5 waits on
T6 (`LatestExpeditionRows.ends_at` nullable).

## Review fixes (REVIEW.md should-fix 1 and 2), 2026-11-06

Regression file: `src/server/db/__tests__/mf-0059-review-fixes.db.test.ts` (f1 end, f2 advance, g unregistered next pack).

### Review fixes: RED before fix

Against the applied migration as it was (close with `now()`, no `private.packs` check on `v_next`).
`pnpm test:db src/server/db/__tests__/mf-0059-review-fixes.db.test.ts` -> exit 1:

```
     × (f1) an end that began before a concurrent start, but locked after it, ends that start with ends_at >= starts_at 245ms
     × (f2) a move that began before a concurrent start, but locked after it, moves and ends that start with ends_at >= starts_at 197ms
     × (g) the next course's pack is not in private.packs: P0001, the group's pack is unchanged 35ms
AssertionError: expected '23514' to be 'ok' // Object.is equality      (f1)
AssertionError: expected '23514' to be 'ok' // Object.is equality      (f2)
AssertionError: expected 'ok' to be 'P0001' // Object.is equality      (g)
      Tests  3 failed (3)
```

The soft witness "early waits on the group row" was green in f1/f2 (no soft failure reported): the early
transaction really waited on the group row held by the later start, and failed on `expeditions_ends_after_start`.

### Fix

- `private.start_expedition`, `private.end_expedition`, `private.advance_group_course`: `v_now := clock_timestamp()`
  right after the `for no key update` on the group row; every close uses `v_now`; the start's insert uses the same
  `v_now` for `starts_at`, so a reached one still closes exactly at the new start (SC-10).
- `private.advance_group_course`: `v_next` requires `exists (select 1 from private.packs p where p.slug = pc.pack_slug)`;
  an unregistered next course is refused with P0001 ('already on the last course') and the pack is unchanged.
- Lock case (c) asserted the close time equals the move's `now()`; it now reads the `ends_at` the move wrote inside
  the move's own transaction and checks the end leaves it unchanged (same claim, "the move's time stays").

Applied in place (no reset): `create or replace` of the three private functions, extracted verbatim from the
migration file, in one `begin … commit` (psql `ON_ERROR_STOP=1`) -> exit 0. Owner, ACL, `prosecdef` and
`proconfig` identical before/after. `md5(prosrc)` of each function in the DB equals the md5 of the text between
`$$ … $$` in the file (diff empty), so a fresh apply of the file creates the same bodies:

```
advance_group_course|240ad962c47f26136c4bc2a29dc290cc
end_expedition|27fe2b90752b34f5b06ef438ed3b9cd3
start_expedition|94a6be4a36d3b8dcc6dd19876ee84176
```

Signatures unchanged, so `db:types` was not regenerated.

### After

```
pnpm test:db src/server/db/__tests__/mf-0059-review-fixes.db.test.ts                 -> exit 0  (3 passed)
pnpm test:db src/server/db/__tests__/mf-0059-expedition-locks.db.test.ts             -> exit 0  (5 passed)
pnpm test:db src/server/db/__tests__/mf-0059-path-groups.db.acceptance.test.ts       -> exit 0  (34 passed)
pnpm test:db src/server/db/__tests__/mf-0017-expedition.db.acceptance.test.ts        -> exit 0  (13 passed)
pnpm test:db                                                                         -> exit 0  (34 files, 181 passed)
pnpm typecheck                                                                       -> exit 0
```

Frozen `mf-0059-path-groups.db.acceptance.test.ts` sha256 still de3ef20f…a7fda3 (matches FROZEN.json).

## Receipt — iteration 1, final tree (2026-11-06T13:25:22Z)

`git diff main | shasum -a 256` = ec1295e74954b9df6f4c05d92e755bd9259359ff82fe4e97c365e8db84db4a65 (= REVIEW.md reviewed_hash, round 2)

| Check | Result |
|---|---|
| pnpm typecheck | exit 0 |
| pnpm lint | exit 0 |
| pnpm test | exit 0 — 191 files, 1021 tests |
| pnpm test:db | exit 0 — 34 files, 181 tests |
| pnpm check:packs | exit 0 |
| pnpm build | exit 0 |
| pnpm gate:planning | 68 ticket folders checked, ok |
| pnpm ticket:collisions MF-0059 | no unlisted collisions |
| five untouched frozen suites vs main | identical |
| FROZEN.json hashes, all tickets | 95 files, 0 mismatches |

| SC | Verdict | Evidence |
|---|---|---|
| SC-1 | PASS | frozen DB SC-1; mf-0059-sync-paths 5/5; db:sync-keys "claude-developer (5 courses)" |
| SC-2 | PASS | frozen DB SC-2; browser create → course 1, creator enrolled |
| SC-3 | PASS | frozen DB SC-3; browser join → enrollment row |
| SC-4 | PASS | frozen DB SC-4; lock (d); review fix g (unregistered next pack → P0001) |
| SC-5 | PASS | frozen DB SC-5; MF-0005 unchanged |
| SC-6 | PASS | frozen engine 6/6 |
| SC-7 | PASS | ui tests; browser light/dark/375 + review round proofs |
| SC-8 | PASS | untouched suites identical; MF-0017/MF-0052 only re-frozen lines |
| SC-9 | PASS | frozen DB SC-9; lock (a)(c); review fixes f1/f2; browser |
| SC-10 | PASS | frozen DB + engine SC-10; re-frozen MF-0017 SC-1, MF-0052 SC-5; browser End + open |

VERDICT: DONE for this tree. Post-review changes after round 2: evidence text only (untracked file), not code.
