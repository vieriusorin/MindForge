# MF-0008 — LOOP-VERIFY

Bindings: no `ticket:*` scripts; skill defaults (FREEZE by hand, sha256 over LF content).
TEST_DB not used: every proof is offline (mocked Claude client, mocked fetch).

## Preflight (2026-11-04, `main` 8b4ecd5)

`pnpm typecheck` clean · `pnpm lint` 298 files clean · `pnpm test` 166/166.

## RED at freeze (2026-11-04)

Typecheck and `pnpm lint` (302 files) stay green with the stubs (`src/content-pipeline/{types,pipeline}.ts`,
optional `generatedBy` on the `Question` type only).

`pnpm exec vitest run --project unit src/content-pipeline/__tests__/mf-0008-pipeline.acceptance.test.ts`:

```
× SC-1  × SC-2  × SC-3  × SC-4  × SC-5  × SC-6  × SC-7  × SC-10
Error: not implemented   (×8)
Tests  8 failed (8)
```

`pnpm exec vitest run --project unit src/engine/questions/__tests__/mf-0008-schema.acceptance.test.ts`:

```
× SC-8  QuestionValidationError: Invalid questions:
          - D5.S3.test.yaml: questions.0: Unrecognized key: "generatedBy"
× SC-9  AssertionError: D1.S1 has no sources: expected 0 to be greater than or equal to 1
Tests  2 failed (2)
```

Not frozen: the CLI run logs (SC-1 real-docs run, SC-2 dry-run). They keep their named proof.
