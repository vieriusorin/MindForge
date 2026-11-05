---
ticket_id: MF-0032
iteration: 1
verdict: DONE
---

# Loop Verify — Iteration 1

## Baseline (before any production change, 2026-11-04)

- `pnpm typecheck`: exit 0
- `pnpm lint`: `Checked 442 files … No fixes applied.`
- `pnpm test`: `Test Files 83 passed (83)` / `Tests 337 passed (337)`
- `pnpm test:db`: `Test Files 1 failed | 14 passed (15)` / `Tests 2 failed | 46 passed (48)`. Pre-existing:
  `src/dev-seed/__tests__/mf-0034-regressions.db.test.ts` ("a learner off the demo domain is refused before
  anything is deleted", "a review of a rejected item is refused before anything is deleted"). MF-0034 is
  in flight in another session and not this ticket's.

## RED at freeze (FROZEN.json)

Typecheck and lint stay green with the stub `src/engine/content/check-question-answer.ts` in place.

- `src/server/db/__tests__/mf-0032-attempt-hash.db.acceptance.test.ts`: 7 failed (7). Run twice, same result.
  - `SC-1: AssertionError: expected [ { code: 'PGRST202', …(3) }, null ] to deeply equal [ null, true ]`: the
    3-arg `record_attempt` doesn't exist.
  - `SC-1/SC-6: PostgresError: column "content_hash" does not exist`
  - `SC-6: AssertionError: expected { code: '42703', … } to be null`
  - `SC-2: AssertionError: expected 'PGRST202' to be '55000'`
  - `SC-7: AssertionError: expected [ { …(3) }, { …(3) } ] to deeply equal [ { …(3) }, { …(3) } ]`: still 2-arg.
- `src/engine/content/__tests__/mf-0032-answer-hash.acceptance.test.ts`: 7 failed.
  - `SC-3: Error: not implemented` (×5)
  - `SC-4: AssertionError: expected false to be true`: `AnswerInput` (strict) refuses `contentHash`.
- `src/features/__tests__/mf-0032-changed-message.acceptance.test.ts`: 4 failed.
  - `SC-5: - "This question changed since you opened it. Start a new duel." + "Pick an answer first."` (and
    the Walk and Seed equivalents)
  - `SC-4: expected "vi.fn()" to be called with arguments: [ { userId: 'u1', …(4) } ]`
- `src/features/__tests__/mf-0032-answer-hash.acceptance.test.tsx`: 3 failed. Each mode's action is called
  without `- "contentHash": "h-p.S1.1"`.

## SC verdicts

## Receipt (iteration 1, 2026-11-04)

Tree hash (MF-0032 paths, see evidence for the method):
`4ac92f74dd98a5b53df236dacfa65034d4985fa4c336d25515871a09b76b83ba (after the SC-2 re-freeze; first receipt was b350c8d0…, review changes-requested)`

- `pnpm typecheck`: `✓ Types generated successfully`, tsc exit 0
- `pnpm lint`: `Checked 459 files in 90ms. No fixes applied.`
- `pnpm test`: `Test Files 2 failed | 93 passed (95)` / `Tests 12 failed | 390 passed (402)`. The only failing files
  are `mf-0038-platform-foundations.acceptance.test.ts` and `mf-0039-agent-skills.acceptance.test.ts`: untracked
  red acceptance files of tickets MF-0038/MF-0039, created by another session during this run. None are
  MF-0032's. Every MF-0032 test and every frozen file from MF-0003/0008/0012/0016 passes.
- `pnpm test:db`: `Test Files 16 passed (16)` / `Tests 55 passed (55)` (baseline had 2 MF-0034 reds; fixed by
  that session meanwhile).
- `pnpm build`: exit 0, `✓ Compiled successfully`, `✓ Generating static pages … (16/16)`
- Frozen hashes re-checked for MF-0032, MF-0003, MF-0012, MF-0008 and MF-0016: all match their FROZEN.json.

| SC | Verdict | Evidence |
|----|---------|----------|
| SC-1 | PASS | db acceptance: grades with the read hash and stores it; `55000` + no row on another hash; `P0002` with a hash and no registry row; 2-arg call still grades |
| SC-2 | PASS | Re-frozen db case (user-approved after review): the RPC is awaited inside the open sync transaction and answers before COMMIT (`isCommittedAtResponse: false`), graded on the committed key (`false`); post-commit old → 55000, new → true. Single-snapshot read + one-tx sync proven by the fresh-context diff review (REVIEW.md approve @ 4ac92f74…). Full `pnpm test:db` re-run after the fix: 55/55 |
| SC-3 | PASS | `mf-0032-answer-hash.acceptance.test.ts` SC-3 ×5; inner `grade-answer.test.ts`, `grade-cuckoo.test.ts` (55000 → changed, other → not-gradable, stale sent hash → no RPC) |
| SC-4 | PASS | AnswerInput cases; `src/features/__tests__/mf-0032-answer-hash.acceptance.test.tsx` (Duel/Walk/Seed send `contentHash`); re-frozen MF-0003 DTO keys; HTTP render (evidence): 5 `contentHash` values on the duel and cuckoo pages, equal to `private.items` |
| SC-5 | PASS | `mf-0032-changed-message.acceptance.test.ts` (3 messages + hash passed to `gradeAnswer`) |
| SC-6 | PASS | db acceptance: own rows show the registry hash (also on the 2-arg call); another learner sees `[]` |
| SC-7 | PASS | db acceptance: only `private.record_attempt(text,text[],text)` and `record_attempt(text,text[],text)`, authenticated yes / anon no; MF-0005 grants gate green |
| SC-8 | PARTIAL | gates + build green. Browser: the shared chrome-devtools browser was held by another session, so the HTTP-render substitute ran (evidence). The UI click-through is **not verified** in a browser. Review: REVIEW.md `approve` bound to `4ac92f74…` = this tree |

## Decision

VERIFY DONE for tree `4ac92f74dd98a5b53df236dacfa65034d4985fa4c336d25515871a09b76b83ba`. EVAL (by hand): task graph acyclic
(T1→T2, T3→T4→T5, T2+T5→T6), every SC closed by a task, `reviewed_hash` = current tree. SC-8's browser click-through is
unverified (shared browser held); the HTTP-render substitute is in the evidence.
