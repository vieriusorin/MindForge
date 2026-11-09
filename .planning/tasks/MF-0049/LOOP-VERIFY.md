# MF-0049 LOOP-VERIFY

## RED at freeze (2026-11-06)

`pnpm exec vitest run src/test/__tests__/mf-0049-goal-proofs.acceptance.test.ts` against the stub
`scripts/check-goal-proofs.mjs` (exits 0, no output):

```
× SC-1 … AssertionError: expected +0 to be 1   (MF-0024 proof case: sync-prefix path accepted)
× SC-2 … AssertionError: expected +0 to be 1   (unnamed frozen file accepted)
× SC-3 … AssertionError: expected +0 to be 1   (pnpm check:nope accepted)
× SC-4 … AssertionError: expected +0 to be 1   (missing GOAL.md accepted)
Tests  4 failed (4)
```

Each is the SC's own red (exit status), not a missing module or import; typecheck 0, lint 0. Full `pnpm test`:
1 failed (this file) | 179 passed; 4 failed | 992 passed.
