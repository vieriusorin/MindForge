# MF-0024 LOOP-VERIFY (iteration 0)

## RED at freeze (2026-11-05)

- `mf-0024-id-prefix.acceptance.test.ts`: 6 failed / 2 passed. SC-1 ×5, SC-2 ×1:
  `Error: expected a validation error, nothing was thrown`. Green by design: SC-1 unchanged content, SC-4 lock.
- `mf-0024-id-prefix.db.acceptance.test.ts` (run twice, identical): SC-3 ×2
  `AssertionError: pack registry: … mf0024-folder …` / `… mf0024-thief …` (sync exited 0 and wrote);
  SC-5 ×2 `expected 'ok' to be '23514'`. Teardown restored `ccdv-f.D1.S1.q1` to ccdv-f (run 2 passed its precondition).
- MF-0017 DB re-freeze: 13/13 green before the CHECK, with prefixed ids.

## Baseline (before BUILD)

typecheck 0 · lint 0 · test 127 files / 568 pass · test:db 77/84, 7 reds all `mf-0013-storms`
(`22023 not a playable question for this storm`), pre-existing.

## Receipt (current tree)

| Check | Result |
|---|---|
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | exit 0, `Checked 573 files … No fixes applied.` |
| `pnpm test` | exit 0, `Test Files 129 passed (129)`, `Tests 580 passed (580)` |
| `pnpm test:db` | exit 1, `Tests 7 failed | 81 passed (88)`; the 7 = baseline `mf-0013-storms` (same names), 0 new |
| `pnpm check:packs` | exit 0 (grounding only; not a proof of this ticket) |
| `pnpm db:sync-keys` (real packs, CHECK applied) | exit 0; 7 packs, 391 keys, 504 items |
| local pre-check query | 0 mismatched rows before the migration |
| `pnpm db:types` | no diff |

| SC | Verdict | Evidence |
|---|---|---|
| SC-1 | PASS | unit acceptance 8/8 |
| SC-2 | PASS | same file, SC-2 case |
| SC-3 | PASS | DB acceptance SC-3 ×2 green |
| SC-4 | PASS | SC-4 lock green; real sync 504 items |
| SC-5 | PASS | DB acceptance SC-5 ×2 green; MF-0017 DB 13/13 |

Review: `REVIEW.md` approve, 0 blockers, bound to cf7fbb33… (whole tree incl. planning). Post-review changes:
GOAL.md text only (2 should-fix). Code-only diff hash at receipt: `5d897daa1894a6424640c5ffce5a4983a81404df3d28d534eb50116902d17668`.

**Verdict: DONE** for this tree (no new failures; the 7 storm reds are baseline).
