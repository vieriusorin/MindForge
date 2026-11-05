# MF-0028 LOOP-VERIFY — iteration 1

Tree: `git diff HEAD | shasum -a 256` = `21aec0003514a06afb2954ba66d792917ff19aa61313ebb28372a20b66055e18`
(tracked changes; the new untracked files are listed in the evidence). Receipts by hand: no `ticket:verify`
script in `package.json`.

## Baseline (before any change, 2026-11-05)

typecheck 0 · lint 0 (575 files) · test 130 files / 592 tests passed · `main` CI success (7bec73e).

## RED at freeze

- Iteration 0 (hash c1319be6…): 11 of 12 red. `Error: not implemented` ×8 (stub `scripts/lib/planning-check.mjs`);
  SC-4 `expected '' to contain 'MF-0002: '` and repo run exit 1; SC-5 `gate:planning` undefined.
  `exits 0 when the tasks folder does not exist` green at freeze (CLI-only path; regression lock).
- Iteration 1 re-freeze (hash a4fac27d…, C-3): against the iteration-0 checker,
  `SC-1: one ticket_id but tier/stage/goal_status repeated (the real 71ac090 seam)` →
  `AssertionError: expected [] to have a length of 1 but got +0`.

## Per SC

| SC | Verdict | Evidence |
|---|---|---|
| SC-1 | PASS | acceptance: 2-id, different-ids, no-id, 71ac090 seam (+CRLF) green. Replay `git archive 71ac090 .planning/tasks` → exit 1: `MF-0022: tier, stage, goal_status repeated at column 0, likely two tickets merged into one GOAL.md` (same for MF-0023) |
| SC-2 | PASS | acceptance: `MF-0042` folder with `ticket_id: MF-0043` green |
| SC-3 | PASS | acceptance: quoted, commented, CRLF, indented, mid-line, missing GOAL, fenced (C-2) green |
| SC-4 | PASS | acceptance spawns the CLI: fixture exit 1 naming MF-0002/MF-0003 only; absent folder exit 0; repo exit 0. `pnpm gate:planning` → `49 ticket folders checked, ok` |
| SC-5 | PASS (Stop-gate line not yet observed) | acceptance reads `package.json` → `node scripts/check-planning.mjs`; `stop-gate.mjs:155-157` runs every `gate:*` |
| SC-6 | PARTIAL | step present in `ci.yml` checks job; `mf-0005-ci.acceptance.test.ts` 8/8 green (order kept). The live CI run is only visible after push: NOT verified |
| SC-7 | PASS | typecheck 0; lint 0 (578 files); test 131 files / 606 passed; `check-hooks: PASS`; frozen hash matches |

Verdict: DONE for the local tree, except the SC-6 CI run (after push).
