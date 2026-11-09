# MF-0069 LOOP-VERIFY

No `ticket:verify` / `ticket:freeze` script (MF-0080): skill defaults run by hand. Frozen file:
`src/test/__tests__/mf-0069-plan-parsers.acceptance.test.ts` (FROZEN.json, sha256 over LF content).

## RED at freeze (2026-11-09)

`pnpm exec vitest run src/test/__tests__/mf-0069-plan-parsers.acceptance.test.ts` against the stub
`checkPlanParsers` (new export, throws) and the unchanged `check-planning.mjs` / `templates.md`:

```
× SC-1 … Error: not implemented
× SC-2 … Error: not implemented
× SC-3 … Error: not implemented
× SC-4 … Error: not implemented
× SC-5 … AssertionError: expected 'gate:planning: rule 2 skipped: no mai…' to contain 'MF-9999: LOOP-PLAN owns .claude/hooks…'
× SC-6 … AssertionError: parsers-example markers in templates.md: expected null not to be null
Tests  6 failed (6)
```

SC-5 and SC-6 are their own reds (rule not wired; template without the example). SC-1's own red is the proof-case
replay (GOAL Iteration Log). typecheck 0, lint 0. Full `pnpm test`: 7 failed | 1479 passed = these 6 + the baseline
`mf-0065` SC-8.

## Receipt (2026-11-09, tree `51c23327a1a9f6138b03355d79df94179a7dd4fb934dfb06dfd794ffcf26967c`, review: approve)

Review B-1/B-2 regressions in `src/test/__tests__/plan-parsers.test.ts` were RED before the fix: `Tests  12 failed | 12 passed (24)`.

| Check | Result |
|---|---|
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | exit 0 |
| `pnpm test` | `Tests  1 failed \| 1509 passed (1510)`; only the baseline `mf-0065` SC-8 (Windows path separator) |
| `pnpm gate:planning` | `71 ticket folders checked, ok` (MF-0069's own plan judged at stage test: passes) |
| `pnpm gate:workspace` | ok |
| `node scripts/check-hooks.mjs` | PASS |
| `pnpm check:goal-proofs MF-0069` | every proof resolves |
| `node scripts/frozen-collisions.mjs MF-0069` | `Symbols changed says None.` |
| frozen hash | `894d950b…` = FROZEN.json (no re-freeze) |

| SC | Verdict | Evidence |
|---|---|---|
| SC-1 | PASS | acceptance SC-1 (MF-0048 proof case → the exact line) |
| SC-2 | PASS | acceptance SC-2; inner placeholder / variants cases |
| SC-3 | PASS | acceptance SC-3; inner B-1 cases |
| SC-4 | PASS | acceptance SC-4; inner B-2 trigger cases |
| SC-5 | PASS | acceptance SC-5; `pnpm gate:planning` exit 0 on this repo |
| SC-6 | PASS | acceptance SC-6 (template example between markers passes the rule) |
