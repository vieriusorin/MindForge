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

## Baseline

Same as the preflight (`main` 8b4ecd5): typecheck, lint, 166/166 unit+ui, 27/27 db. No other red.

## Receipt — code-diff hash c139e6d766ae525da53baf531859c65787487cec7edab1463623b0114ccfcade

Hash = `{ git diff HEAD -- . ':!.planning'; sorted untracked files ("== path" + content) } | sha256sum`.

| Check | Result |
|---|---|
| frozen hashes (LF) | both match FROZEN.json (ac33fd50…, 27770c0c…) |
| `pnpm typecheck` | clean (includes `scripts/generate/*.ts`, `satisfies` against the SDK's `BatchCreateParams.Request`) |
| `pnpm lint` | Checked 317 files, no fixes |
| `pnpm test` | Test Files 49 passed · Tests 185 passed (before the `textKind` test; pipeline set now 18/18) |
| `pnpm test:db` | Test Files 8 passed · Tests 27 passed |
| `pnpm build` | ✓ Compiled |
| `pnpm generate:corpus` (real docs, no key) | run 1: fetched=34 unchanged=0 refused=0 unsupported=1 (exam-guide PDF); run 2: fetched=0 unchanged=34 |
| `pnpm generate:questions --dry-run` (no key) | 25 skills, need 17–18, drafts 22–23 each, 572 requests, upper bound $70.41 (over the $25 cap → run per domain in MF-0022); `--skill D2.S1`: 23 requests, $3.33 |

## SC verdicts

| SC | Verdict | Evidence |
|---|---|---|
| SC-1 | PASS | frozen SC-1 ✓ + real-docs run log above |
| SC-2 | PASS | frozen SC-2 ✓ (custom_id `D5_S3-0`, pattern checked) + dry-run log |
| SC-3 | PASS | frozen SC-3 ✓ (rendered YAML loads through the MF-0006 loader) |
| SC-4 | PASS | frozen SC-4 ✓; `evals/golden/official-samples.yaml`: 3 official + 9 planted cases |
| SC-5 | PASS | frozen SC-5 ✓; `prompts/{writer,verifier}.md` v1 + `prompt-lock.json` |
| SC-6 | PASS | frozen SC-6 ✓ ($2.70 / $5.20 from usage; spy client not called over the cap) |
| SC-7 | PASS | frozen SC-7 ✓ (2 closing tags for 2 pages with an injected one; strict draft schema) |
| SC-8 | PASS | frozen SC-8 ✓ |
| SC-9 | PASS | frozen SC-9 ✓ (25 skills seeded, 72 lines added, 0 removed) |
| SC-10 | PASS | frozen SC-10 ✓ |

Not verified here (MF-0022): any real Batch call, the verifier's real catch rate, real cost. Not done: a
fresh-context review (tier normal; the loop requires one only for high-risk).
