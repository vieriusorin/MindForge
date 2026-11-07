---
verdict: approve
verdict_detail: "0 blocking, 1 should-fix (SC-10 ticked although its browser smoke did not run), 5 notes, 1 nit. SQL is race-free under READ COMMITTED, per-user, grants correct; the re-freeze batch only adds the id to fixtures plus the SC-7 signature literal."
reviewed_hash: a9ed5e4c6d292a7f9861637f2da5107fece457065443ce9d7d02c7a0e7f392ad
reviewed_at: 2026-11-07T10:20:22Z
---

# MF-0067 diff review (fresh context)

Scope: the uncommitted diff vs HEAD 660f1c1 plus untracked files in `mind-forge-MF-0067`. Hash taken over
`git diff HEAD -- . ':!.planning'` plus the sorted untracked non-`.planning` files.

## What I ran

- `pnpm typecheck` exit 0 · `pnpm lint` exit 0 (770 files) · `vitest --project unit --project ui`: 198 files, 1114 tests passed.
- Under the db lock (`MF-0067-review`, acquired and released): `pnpm db:reset` exit 0, then
  `vitest --project db` on `mf-0067-retry-safe.db.acceptance.test.ts`, `mf-0032-attempt-hash.db.acceptance.test.ts`,
  `mf-0058-recorder-failure.db.acceptance.test.ts`: 3 files, 17 tests passed, none skipped.
- MF-0060 checker (`check-planning.mjs` against this worktree): `69 ticket folders checked, ok`.
- sha256 of all 8 frozen files (3 MF-0067, 4 MF-0032, 1 MF-0058) matches its FROZEN.json entry.

## Checked and holding

- **Race (DQ-6, SC-5).** Two calls, same id, READ COMMITTED: both miss the replay select (`:63-76`) while the
  first is uncommitted. The second's `insert … on conflict (user_id, client_attempt_id) do nothing` (`:102-106`)
  blocks on the in-progress unique-index entry. If the first commits, the insert does nothing (`found` false) and the
  next statement (`:113-116`) gets a fresh snapshot, sees the winner, re-applies the DQ-4 match and returns the
  winner's `correct`. If the first aborts, the second inserts. You get one row, the first grade, no null and no
  second row. A same-id call with a different answer in the race also lands on `:120-123` and gets 23505. The SC-5 witness is
  non-vacuous: with a check-then-insert body the second RPC returns before COMMIT (`isReleasedAtResponse: false`)
  and leaves two rows. That matches the variant run recorded in LOOP-VERIFY.
- **SC-3.** Both the replay and the lost-race path compare question, the exact `chosen` array and (when sent) the hash,
  and raise 23505. Nothing is written on either path.
- **SC-4.** Both lookups are keyed on `user_id = v_uid` (`auth.uid()`), and the unique key is `(user_id, client_attempt_id)`.
  Learner B can't reach A's row. The function returns only a boolean, so no answer key leaks.
- **MF-0032 interplay.** Replay returns the stored grade of the learner's OWN row, a value the "attempts: read own"
  SELECT grant already exposes. Nothing is re-graded or written against a changed item. The 55000 refusal of a NEW
  answer on an old hash still holds (SC-2 control at test `:208-216`).
- **Grants and definer.** Both 3-arg functions are dropped (`:25-26`). Only the 4-arg pair exists, and SC-7 in both files
  checks that. The definer is in `private` only, with `search_path = ''` and an `auth.uid()` check. `revoke` runs before `grant`
  (`:142-145`). Execute goes to `authenticated` only, with anon false. There's no table grant change, and `authenticated` still has no
  INSERT/UPDATE/DELETE.
- **`default null` callers.** `grep record_attempt src scripts` finds exactly two app RPC calls,
  `grade-answer.ts:63` and `grade-cuckoo.ts:62`. Both now send `p_client_attempt_id`. `GradeAnswerInput` and
  `GradeCuckooInput` make it required, and their only callers (`duel|walk|seed-planting|cuckoo/actions.ts`) spread a
  zod-parsed `AnswerInput` / `CuckooAnswerInput` that requires `z.uuid()`. No app path calls without an id.
  `scripts/**` and `src/dev-seed/**` don't call the RPC. The null path is reachable only from SQL, storms and tests (DQ-2).
- **Client.** `useAttemptId` is a ref (`use-attempt-id.ts:16`), so StrictMode's double render and effects don't touch it,
  and no effect is involved. Each hook calls `idFor` inside `submit` after `flight.tryStart()`. A double click is blocked by
  the single-flight, and even unblocked it would map to the same submission key and the same id. A retry after a network
  error or `ok:false` uses the same key and gets the same id (TanStack mutation retry is 0, so the learner's click is the retry). A changed answer gives a new key
  and a new id. `next()` calls `clear()`. The hook sends `chosen` in the exact order it uses for the key, so the
  order-sensitive DB compare never refuses a genuine retry.

## Findings

1. **[should-fix]** `.planning/tasks/MF-0067/GOAL.md` (SC-10 line, "- [x] SC-10 (browser smoke not run …)").
   SC-10 is ticked although part of its stated proof, the browser Duel answer plus the SQL read-back of a non-null
   `client_attempt_id`, did not run. LOOP-VERIFY ("Not verified") and the evidence file say so honestly, but the
   checkbox claims the SC is met. Either run the smoke before merge, or leave SC-10 unticked or split it so the
   unverified part is visible to `ticket:eval`. Nothing is functionally at risk: the app path is covered by SC-8 and
   SC-9 plus the DB SCs.

2. **[note]** `supabase/migrations/20261106160700_mf0067_attempt_idempotency.sql:69` and `:120`.
   `v_prev.question_id <> p_question_id` is NULL when `p_question_id` is NULL, so a direct RPC call
   `record_attempt(null, <same chosen>, null, <seen id>)` returns the stored grade instead of 23505. The `chosen`
   check is safe because `chosen` is bounds-checked as non-null first. Impact: none for confidentiality, since it returns the caller's own
   grade, which they can already SELECT. It is a gap in SC-3's "different question → 23505" contract, and no
   test covers it. Using `is distinct from` for the question (and `chosen`) closes it. Worth folding into MF-0065,
   which rewrites this function next.

3. **[note]** `src/features/__tests__/mf-0067-attempt-id.acceptance.test.tsx:206-218` ("new id for the next item").
   Items 1 and 2 have different ids, so the submission key differs anyway and the test passes without
   `attempt.clear()`. DQ-5's "`next()` clears it" is implemented in all four hooks but not proven. The risk is low: a
   missing clear only matters if the same item and answer recur in one session.

4. **[note]** GOAL Objective lists "two tabs racing" among the duplicate sources. Each tab mints its own id, so two
   tabs answering the same question still write two rows. No SC claims otherwise, but neither Out of Scope nor C-3
   names it. Consider one line in Out of Scope so the Objective doesn't overclaim.

5. **[note]** Multi-select order. `toggleChoice` (`src/components/question-card/utils.ts:33-36`) appends in click
   order, so after a network error a learner who un-picks and re-picks the same set gets `["B","A"]` instead of
   `["A","B"]`. That is a new submission key and a new id, so a second row is possible if the first request had
   committed. This falls in the C-3 accepted class and causes no false 23505. Sorting `chosen` before both keying and
   sending would remove it.

6. **[note]** `src/server/attempts/grade-answer.ts:87-97`. On a replay, the boolean is the FIRST grade (DQ-3), but
   `correctOptionIds` and rationales come from the CURRENT pack file. When the DB key has changed but the deployed file
   hash still matches what the learner sent, the verdict and the revealed key can disagree. The app-layer
   `checkQuestionAnswer` hash check usually returns `changed` first, so this needs a key/registry change without a
   file-hash change. It is an accepted consequence of DQ-3, recorded here for MF-0065.

7. **[nit]** `.planning/tasks/MF-0067/LOOP-PLAN.md` Steps item 7 says "Re-freeze the four listed files", but the
   table above it (correctly) lists five. The front matter still reads `status: executing` / `IN_PROGRESS` while
   GOAL is at `stage: handoff`.

## Re-frozen files (diffed against HEAD)

| File | What changed | Assertions changed |
|---|---|---|
| `src/server/db/__tests__/mf-0032-attempt-hash.db.acceptance.test.ts` | SC-7 title, plus both signature literals `(text,text[],text)` → `(text,text[],text,uuid)` | none weakened (same exact `toEqual` on the full pg_proc list, `auth: true`, `anon: false`) |
| `src/engine/content/__tests__/mf-0032-answer-hash.acceptance.test.ts` | `base` fixture gains a fixed v4 `clientAttemptId` | none (hash-refusal cases still fail for the hash alone, because the id is now valid) |
| `src/features/__tests__/mf-0032-answer-hash.acceptance.test.tsx` | `EXPECTED` gains `clientAttemptId: expect.any(String)` | none for MF-0032: still exact `toEqual` on every other field. The new field is loosely matched, and its shape is pinned by MF-0067 SC-9 (UUID regex) |
| `src/features/__tests__/mf-0032-changed-message.acceptance.test.ts` | `INPUT` gains a fixed v4 `clientAttemptId` | none (messages and the `{ userId, ...INPUT }` forward unchanged) |
| `src/features/__tests__/mf-0058-recorder-failure.db.acceptance.test.ts` | `import { randomUUID }`, plus the input gains `clientAttemptId: randomUUID()` | none |

History entries are present in `.planning/tasks/MF-0032/FROZEN.json` (four previous hashes) and
`.planning/tasks/MF-0058/FROZEN.json` (one), dated 2026-11-07T09:39:39Z. Each names the reason and says plainly that
the orchestrator's approval (U-2) was pending at hand-off. The previous hashes match the HEAD file contents, and the new
hashes match the tree.

## Plan ownership (MF-0060)

Every changed or untracked non-`.planning` file is matched by a task `owns`, and each role-agent glob lies inside its scope:
acceptance-writer owns only `__tests__` paths, schema-builder owns `supabase/**` and `src/server/db/**`, service-builder owns
`src/lib/answer-input.ts` and `src/server/attempts/**`, ui-builder owns the feature `schemas.ts`, hooks, tests and `src/lib/*`, and the
orchestrator owns LOOP-VERIFY and evidence. The checker reports ok.

## Delta re-review (orchestrator, 2026-11-07, tree 661bc7ffc436524b54c12036446993bc7928eb7dbd7a9d4a39c9087ffdb91586)
- Note 2: `private.record_attempt` replay (:69-71) and lost-race (:120-122) paths now compare question and chosen with
  `is distinct from`; both still key on `user_id = auth.uid()` and return only the caller's own boolean. Regression
  `mf-0067-review.db.test.ts` RED on the reviewed migration (`expected [ null, true ] to deeply equal [ '23505', null ]`),
  green after. No grant, search_path or signature change in the delta. Resolved.
- Note 3: `mf-0067-attempt-id-next.test.tsx` RED 4/4 with `clear()` removed, green with the real hooks. Resolved.
- Notes 4, 5 recorded in GOAL (Out of Scope; C-3). Note 6 → MF-0065 brief. Re-freeze batch approved by the user 2026-11-07.
- Open: SC-10 browser smoke. Verdict: APPROVE for the code; merge waits on SC-10.
