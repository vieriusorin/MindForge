# MF-0022 LOOP-VERIFY

## RED at freeze (2026-11-05)

`pnpm exec vitest run src/content-pipeline/__tests__/mf-0022-generation.acceptance.test.ts` → `Tests 11 failed (11)`;
`pnpm typecheck` ✓, `pnpm lint` ✓ (544 files) with the typed stubs in place.

- SC-2 placeholder/no-Certified: `AssertionError: writer: expected 'You write one practice question for t…' to contain '{{packName}}'` (the prompt still names CCDV-F: the SC's own red).
- SC-2 check block: `AssertionError: writer: expected 'You write one practice question for t…' to contain 'Before you answer, check:'`.
- SC-2 fillPrompt, writer request; SC-3 ×6: `Error: not implemented` (stubs `fillPrompt`, `judgeEvalSet`).
- SC-2 unfilled placeholder: first run was GREEN against the stub (it throws anything), so vacuous; the
  case now requires the error to name `{{audience}}`, and it is red against the stub. GOAL SC-2 says "throws, naming it".
- Probe (edge table): `scoreItemEval` rates a flaw with 0 planted as 1 (`item-eval.ts:131`), i.e. a vacuous pass
  today; SC-3's `untested` status is the change.

Frozen hash: FROZEN.json `931247e1…4c1c`.

## Baseline (before any change)

typecheck ✓ · lint ✓ · test 121 files / 528 tests ✓ · `main` CI 2233f67 `success`.
