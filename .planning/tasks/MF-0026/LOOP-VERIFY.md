# MF-0026 LOOP-VERIFY (it-1)

No `ticket:*` scripts: freeze/verify by hand (gsd-goal-loop defaults), hashes over LF content.

## Baseline (`main` @ 5ca20b7)

`pnpm typecheck` 0 · `pnpm lint` 0 (574 files) · `pnpm test` 130 files / 592 tests · `main` CI `success`.

## RED at freeze

- Walk file (16981848…): SC-1 `AssertionError: expected "vi.fn()" to be called 1 times, but got 2 times`.
- Seed file (e1b39b94…): SC-2, same line.
- SC-3 ×3 per file green at freeze (regression locks on the release path). Not vacuous: with
  `onSettled: flight.release` removed from both hooks (files copied aside, then restored), all 6 SC-3
  cases fail (`Tests 6 failed | 2 passed (8)`).
- First draft defect fixed before freeze: `toHaveBeenLastCalledWith(objectContaining)` failed because
  TanStack passes a context object as `mutationFn`'s second argument; the cases now assert
  `mock.lastCall?.[0]`.

## SC verdicts

| SC | Verdict | Evidence |
|---|---|---|
| SC-1 | PASS | Walk acceptance 4/4. Browser (dev on :3002, local stack, `reviewer-r@test.local`): double click on "Check answer" → one `POST /play/ccdv-f/walk` (200), "Correct! Recalled and recorded.", attempts for the user 1 → 2, no console errors. |
| SC-2 | PASS | Seed acceptance 4/4 (no browser run of Seed Planting). |
| SC-3 | PASS | 6 cases green; shown RED against a never-release variant (above). |
| SC-4 | PASS | MF-0012 / MF-0016 acceptance files unchanged vs HEAD and green; typecheck 0; lint 0 (578 files); `pnpm test` 133 files / 603 tests; `pnpm build` 0. |

## Receipt

DONE for code diff (`git diff HEAD -- . ':!.planning'`) sha256 b63a90718550e88c…; frozen hashes unchanged.

## Not verified

- Seed Planting and Duel/Cuckoo double click in a browser (hook tests only).
- Port 3001 currently serves another app (Docmost); the check ran on :3002 with the sign-in link's
  `redirect_to` pointed there.
