# MF-0052 LOOP-VERIFY

## RED at freeze (2026-11-05, tree 0daf557 + stubs)

`pnpm typecheck` exit 0 · `pnpm lint` exit 0 · `pnpm test`: 7 failed (only the MF-0052 acceptance tests) | 618 passed ·
existing seed DB suites (mf-0029-seed, mf-0034-seed, mf-0034-regressions, seed-regressions): 13 passed.

| File | Command | First failing line |
|---|---|---|
| `src/dev-seed/__tests__/mf-0052-plan.acceptance.test.ts` | `pnpm test <file>` | `Error: not implemented` (planDemoWorlds), SC-1, SC-3, SC-5, SC-7 × |
| `src/dev-seed/__tests__/mf-0052-seed.db.acceptance.test.ts` | `pnpm test:db <file>` | `Error: not implemented` in beforeAll, 5 skipped; same on the 2nd run, no `mf0052` users or maintainer rows left |
| `src/dev-seed/__tests__/mf-0052-regressions.db.acceptance.test.ts` | `pnpm test:db <file>` | `Error: not implemented` in beforeAll, 4 skipped; same on the 2nd run |
| `src/features/app-shell/components/app-sidebar/__tests__/mf-0052-storm-link.acceptance.test.tsx` | `pnpm test <file>` | `AssertionError: expected <span></span> to be null` (SC-2 null case; the with-href case passes as a guard) |
| `src/features/storm/components/recent-storms/__tests__/mf-0052-recent-storms.acceptance.test.ts` | `pnpm test <file>` | `Error: not implemented` (toRecentStormRows) |

### Probe: the assertions fail for the SC's own reason (stub temporarily backed by today's `planDemoWorld`, then restored)

- plan: SC-1 `expected [] to deeply equal [ 'crammer@…', …(5) ]` (no joins) · SC-3 `expected [] to have a length of 1 but got +0` ·
  SC-5 `expected null not to be null` · SC-7 passes (practice data alone already gives water + new + an unseen skill; the test
  guards that the seeded storms keep it so).
- seed DB: SC-1 `expected 1793888641607 to be greater than 1793888641607` (the `joined_at` tie from the GOAL: root cause
  reproduced) · SC-3 `expected +0 to be 1` · SC-4 `expected 0 to be greater than or equal to 1` (no Tree) · SC-5
  `expected [] to have a length of 1 but got +0` · SC-6 passes (flags, pending analogies, review queues already exist, as GOAL
  "More facts" predicted).
- regressions DB: (a), (b) `expected { …(3) } to deeply equal { …(3) }` (no storms/expeditions) · (c), (d) `expected 0 to be
  greater than or equal to 1` (precondition: no seeded storm of yours).
- SC-11: a throwaway `scoreStorm`-based mapping passed both tests (fixture consistent), then the stub was restored.

Not frozen tests: SC-9 (browser walkthrough), SC-10 (gates). SC-2 page half (`/play/<slug>/storm/*` empty state, 200, unknown
slug 404) and SC-6's closing seed output are proven by `pnpm build` + browser, per the GOAL's Proof.

## BUILD regressions (T6, 2026-11-05)

`src/dev-seed/__tests__/mf-0052-seed-guards.db.test.ts`, each case run against `seed-demo-world.ts` with its guard
removed (file copied aside, mutated, restored; `cmp` confirmed the restore):

- V1, no `assertNoUnfinishedStorm` → `× refuses before any delete while you have an unfinished storm` —
  `AssertionError: expected [Function] to throw error matching /unfinished storm/ but got 'duplicate key value violates unique c…'`
  (the demo world was already deleted when the insert hit `storms_one_running_idx`).
- V2, no pre-delete `assertStormsSeedable` (in-transaction copy kept) → `× refuses before any delete when a question of
  your planned storm is spoiled for you, keeping world 1 (another pack) too` —
  `AssertionError: expected { demo: [ …(5) ], groups: [], …(3) } to deeply equal { demo: [ …(5) ], …(4) }`
  (the in-transaction check caught it, but both packs' demo groups were already gone: MF-0034 retro failure order).
- V3, your storms deleted by `user_id` instead of manifest id → `× a manifest written before MF-0052 (no storm ids)
  deletes none of your storms; …` — `AssertionError: expected [ …(2) ] to include '9960d64a-…'`.

## TEST (2026-11-05)

Gates on the final tree (logs in the session scratchpad):
- `pnpm typecheck` exit 0 · `pnpm lint` exit 0 ("Checked 606 files … No fixes applied.")
- `pnpm test` exit 0 — `Test Files 141 passed (141)`, `Tests 653 passed (653)` (before the review's ui test; +2 after)
- `pnpm test:db` exit 0 — `Test Files 25 passed (25)`, `Tests 109 passed (109)` (on a seeded local DB)
- `pnpm build` exit 0
- Frozen hashes re-checked: MF-0052, MF-0013 (re-frozen), MF-0029, MF-0034 — all match.

MF-0013 re-freeze RED before the fix (seeded DB): `"message": "not a playable question for this storm"` → `Tests 7 failed | 1 passed (8)`; after: `Tests 8 passed (8)` twice.

Review ui test RED on a broken variant (empty guard removed): `× renders nothing when there is no finished storm`; restored (`cmp` ok) → `Tests 2 passed (2)`.

| SC | Verdict | Evidence |
|---|---|---|
| SC-1 | PASS | frozen plan + DB tests; `db:reset`+`dev:seed` ×2: your joins newest-first `ccdv-f`, `subagents`, `prod-prompting` |
| SC-2 | PASS (test + HTTP) | frozen storm-link ui test; `/play/prod-prompting/storm/full` 200 "This pack has no mock exam" + "Go to Scenario Duel"; unknown slug renders not-found with a streamed 200 (pre-existing) |
| SC-3 | PASS | frozen DB test; seed run: ccdv-f 7 finished storms; you: full + boss D2, all finished; 0 unfinished in DB |
| SC-4 | PASS | frozen DB test; `/today` shows Readiness "last storm" and Tree |
| SC-5 | PASS | frozen DB test; group page "37 of 57 correct recalls · 64%", 3 days left |
| SC-6 | PASS | frozen DB test; seed output names `sorin.vieriu@ddroidd.com` for ccdv-f, `steady@…` elsewhere; `/review/ccdv-f` Approve/Flag, `/flags` Dismiss/Reject |
| SC-7 | PASS | frozen plan test; `/play/ccdv-f/walk` "Needs water"; group page Plant links |
| SC-8 | PASS | frozen regressions DB test (a–d) + guards test, guards shown RED (BUILD regressions) |
| SC-9 | PARTIAL | all 14 routes 200 with seeded content via HTTP as you; **no browser and no interaction** (shared devtools browser held by another session) |
| SC-10 | PASS | gates above |
| SC-11 | PASS (test + HTTP) | frozen utils test + ui test; `/play/ccdv-f/storm/full` "Your recent storms: Full Storm … Not survived · Boss Storm: Applications and Integration … Survived" |

Review: `REVIEW.md` approve, 0 blocking. Majors resolved: plan amended (T0b); SC-9 browser half listed as not verified.
