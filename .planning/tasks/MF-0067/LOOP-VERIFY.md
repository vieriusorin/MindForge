---
phase: 1-verification
ticket_id: MF-0067
status: complete
verdict: PASS
started_at: "2026-11-06"
completed_at: "2026-11-07"
resume_with: /gsd-goal-loop
---

# Verification — Iteration 1

## RED at freeze (Stage 2b)

| SC | Acceptance test | Red reason at freeze (pasted) |
|----|-----------------|-------------------------------|
| SC-1..SC-6 | `mf-0067-retry-safe.db.acceptance.test.ts` | `AssertionError: expected { data: null, code: 'PGRST202' } to deeply equal { data: true, code: null }`: the 4-arg function did not exist yet (2nd run identical; the 1st run skipped all 9 because local auth was still warming up after a Docker pause) |
| SC-7 | same | `AssertionError: expected [ { …(3) }, { …(3) } ] to deeply equal [ { …(3) }, { …(3) } ]`: the 3-arg signatures |
| SC-8 | `mf-0067-attempt-id-input.acceptance.test.ts` | `AssertionError: expected { ok: true, feedback: { …(3) } } to deeply equal { ok: false, …(1) }` (no id required) · `expected false to be true` (the strictObject refused `clientAttemptId`), 8/8 |
| SC-9 | `mf-0067-attempt-id.acceptance.test.tsx` | `TypeError: .toMatch() expects to receive a string, but got undefined` (no id sent), 12/12 |

**SC-5 non-vacuity (SKILL 2b, after BUILD).** `mf0067-variant.sql` (scratchpad) drops `attempts_user_client_attempt_key`
and replaces `private.record_attempt` with the same body minus `on conflict … do nothing`, so replay becomes
check-then-insert. SC-5 run against it (local stack, db lock, reset after):

```
× SC-5: two concurrent calls with one id leave one row; the second waits for the first's commit 771ms
AssertionError: expected { data: true, code: null, …(1) } to deeply equal { data: true, code: null, …(1) }
-   "isReleasedAtResponse": true,
+   "isReleasedAtResponse": false,
```

On the real migration, in the same lock hold: `Tests  1 passed | 8 skipped (9)`.

## Review fixes (2026-11-07, REVIEW.md approve, hash a9ed5e4c6d29)

**Note 2, regression first.** New non-frozen `src/server/db/__tests__/mf-0067-review.db.test.ts` (a reused id with
`p_question_id: null` must give 23505). RED against the migration as reviewed (local stack, db lock, reset first):

```
× returns 23505, not the stored grade, and writes nothing 108ms
AssertionError: expected [ null, true ] to deeply equal [ '23505', null ]
```

Fix in place: `is distinct from` for question and chosen at `:69-70` and `:120-121`, re-applied by `pnpm db:reset`. Then
`Tests  1 passed (1)`.

**Note 3.** New non-frozen `src/features/__tests__/mf-0067-attempt-id-next.test.tsx` (the same item and answer twice in a
row, so the second needs a new id). Against copies of the four hooks with `attempt.clear();` removed (restored afterwards):
4/4 RED, e.g. `AssertionError: expected 'db9b151b-…' not to be 'db9b151b-…'`. With the real hooks: 4/4 passed.

**Notes 4, 5 and the nit:** GOAL Out of Scope (two tabs) and C-3 (multi-select click order); LOOP-PLAN "five files", status complete.
**Re-freeze batch approved by the user 2026-11-07**, recorded in GOAL and in both FROZEN.json history entries.

## Browser smoke (SC-10), 2026-11-07T10:51Z

Headless Chrome over CDP (own profile under the scratchpad, port 9367; driver `scratchpad/mf67-cdp/`, adapted
from MF-0064), `pnpm exec next dev -p 3003` from this worktree, db + web locks, `pnpm db:reset` + `pnpm dev:seed --pack ccdv-f`.
Signed in as `lapsed@mindforge-demo.test` through the real form. The verify redirect named `localhost:3001`, so the
browser never followed it: the `code` was taken from its Location header and `/auth/callback?code=…` opened on :3003.

```
verify redirect host: localhost:3001 → opening the callback on :3003
after callback: /today
walk: opt-ccdv-f.D1.S2.q1 → "Not quite. Read why, then carry on."
duel: opt-ccdv-f.D1.S2.q1 → "Not quite. Read why, then carry on."
```

SQL read-back for `lapsed`: before `51|0` (total | with id), after `53 | 2`: exactly one row per answer:

```
 id  |   question_id   | chosen | correct |          client_attempt_id           |          answered_at
 936 | ccdv-f.D1.S2.q1 | {A}    | f       | fd68c7a3-aed4-4bd6-b3b0-2627fae55b79 | 2026-11-07 10:51:10.869113+00
 937 | ccdv-f.D1.S2.q1 | {A}    | f       | e1269dca-af92-4b11-bcc1-a6bef3b36b55 | 2026-11-07 10:51:14.134475+00
```

No `client_attempt_id` has more than one row (`group by … having count(*) > 1` → 0 rows). Screenshots:
`.planning/evidence/MF-0067/sc-10-walk-verdict.png`, `sc-10-duel-verdict.png`. Chrome and the dev server were stopped and the
locks released; :3001 (pid 93809) and :3002 were never touched.

## Results

| SC | Verdict | Evidence |
|----|---------|----------|
| SC-1 | PASS | `mf-0067-retry-safe.db.acceptance.test.ts` SC-1 ✓ (`pnpm test:db` 35 files / 190 tests) |
| SC-2 | PASS | same file: 3 SC-2 cases ✓ (same row and `answered_at`; wrong stays false; key change → first grade with a control; hash change → first grade, a new id gets 55000) |
| SC-3 | PASS | same file SC-3 ✓ (other question, chosen ×2, hash → 23505; rows unchanged) |
| SC-4 | PASS | same file SC-4 ✓ |
| SC-5 | PASS | same file SC-5 ✓ (`isReleasedAtResponse: true`, one row); variant RED above |
| SC-6 | PASS | same file SC-6 ✓ (`successfulRecalls` 1 for one id, 2 for two ids) |
| SC-7 | PASS | same file SC-7 ✓ + re-frozen MF-0032 SC-7 ✓; read-back: `private.record_attempt(text,text[],text,uuid)`, `record_attempt(text,text[],text,uuid)`, `client_attempt_id|uuid|YES`, `attempts_user_client_attempt_key` |
| SC-8 | PASS | `mf-0067-attempt-id-input.acceptance.test.ts` 8/8; `grade-answer.test.ts` / `grade-cuckoo.test.ts` (forwarding `p_client_attempt_id`, 23505 → not-gradable) |
| SC-9 | PASS | `mf-0067-attempt-id.acceptance.test.tsx` 12/12; `src/lib/__tests__/attempt-id.test.ts` 7/7 (incl. `crypto.randomUUID()` passes `z.uuid()` ×50) |
| SC-10 | PASS | typecheck 0 · lint 0 (772 files) · test 199 files / 1118 tests · test:db 36 / 191 · build 0 · gate:planning ok (69 folders; MF-0060 checker ok) · gate:workspace ok · db:types regenerated. Browser smoke NOT run: see Not verified |

## Gates and suite

`pnpm typecheck` 0 · `pnpm lint` "Checked 772 files … No fixes applied." · `pnpm test` "Test Files 199 passed (199) / Tests 1118 passed (1118)" ·
`pnpm test:db` "Test Files 36 passed (36) / Tests 191 passed (191)" · `pnpm build` "✓ Compiled successfully" ·
`pnpm gate:planning` "69 ticket folders checked, ok" · `pnpm gate:workspace` "4 allowBuilds entries, ok".

## Receipt

`2026-11-07T10:14Z · tree 41218a61f428 (git diff HEAD + untracked non-.planning) · typecheck 0 · gates 2/2 · lint 0 · test 1114/1114 · test:db 190/190 · build 0 · PASS`
`2026-11-07T10:33Z · tree 661bc7ffc436 (git diff HEAD -- . :!.planning + untracked non-.planning, the reviewer's recipe) · typecheck 0 · gates 2/2 · lint 0 · test 1118/1118 · test:db 191/191 · build 0 · PASS (SC-10 browser part not run)`
`2026-11-07T10:51Z · same tree 661bc7ffc436 (no code change since) · browser smoke Walk + Duel on :3003, SQL read-back one row per answer with an id · PASS`

## Not verified

- (Resolved 10:51Z, see Browser smoke above.) Earlier attempts with the shared devtools browser failed: chrome-devtools `new_page` refused 4 times between 10:22Z and
  10:31Z with "The browser is already running for …/chrome-devtools-mcp/chrome-profile". The profile is held by a
  Chrome started 12:08 local by another session's MCP server (pid 40934), which I left alone. SC-10 is unticked in GOAL. First run: Port 3002 was also taken by the user's main-checkout `next-server` (pid 36545), so `next dev -p 3003`
  ran under the web lock, then was stopped without a page check. Covered instead by the DB test over the real
  PostgREST wire with node `randomUUID()` and by the `z.uuid()` × `crypto.randomUUID()` unit test.
- Post-review SQL delta: re-reviewed and approved by the orchestrator (appended to REVIEW.md).
