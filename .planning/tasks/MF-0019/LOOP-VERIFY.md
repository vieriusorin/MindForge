# MF-0019 LOOP-VERIFY: iteration 1 (2026-11-05)

Tree: `git diff HEAD | shasum -a 256` = `f5fb1913d3d16eab9c5801664737e90a151438abb054e2a732e3270ef15512e4`
(pnpm-workspace.yaml, scripts/sync-question-keys.mjs). Verdict: **PARTIAL**. The code hunks pass locally.
SC-1 (current tree), SC-2 (positive) and SC-3 need a push and GitHub admin rights.

## RED before the fix

- T0: `pnpm install --frozen-lockfile` → `Error: ERR_PNPM_IGNORED_BUILDS … Ignored build scripts: esbuild@0.28.2`
  (same Install-step failure as CI runs #12–#24)
- T1: `vitest run --project db mf-0016-cuckoo-keys.db.acceptance.test.ts` → `Failed Tests 3`,
  `ENOENT: … packs/mf0016-cuckoo/pack.yaml`

## After the fix (this tree)

| Check | Result |
|---|---|
| `pnpm install --frozen-lockfile` | exit 0 |
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | `Checked 540 files … No fixes applied.` |
| `pnpm test` | `Test Files 119 passed (119)`, `Tests 522 passed (522)` |
| `node scripts/check-hooks.mjs` | `check-hooks: PASS` |
| `pnpm build` (CI env values) | exit 0 |
| MF-0016 cuckoo-keys DB test | `Tests 3 passed (3)` |
| `pnpm test:db` (no reset) | `Tests 7 failed / 64 passed`. All 7 are in `mf-0013-storms`, caused by local `dev:seed` flagging `ccdv-f.D2.S2.q1` (read-only probe of `private.item_reviews`). That failure is pre-existing and local-only → MF-0045 |

## SCs

| SC | Verdict | Evidence |
|---|---|---|
| SC-1 | met once, re-proof pending | run 41657844124 (PR #6): checks ✓ 0:58, db ✓ 2:28. Current tree unproven on CI |
| SC-2 | negative half met | PR runs for MF-0005/0009/0007/0011 had 0 question changes vs base and 0 `Answer keys` annotations. No green run has had a question-changing PR yet |
| SC-3 | open | `GET /repos/vieriusorin/MindForge/branches/main` → `protected: false`, `contexts: []` |
| SC-4 | met | db 2:28 / 2:21 / 2:10 / 2:11 (runs 1, 3, 5, 10): < 10 min → no cache ticket |
