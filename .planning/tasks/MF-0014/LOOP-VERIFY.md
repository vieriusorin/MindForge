# MF-0014 — LOOP-VERIFY

Bindings: no `ticket:*` scripts in `package.json`; skill defaults (FREEZE by hand, sha256 over LF content).
TEST_DB not used: every proof is offline (mocked Claude client).

## Preflight (2026-11-04, `feat/MF-0014` = main d7bc39d)

`pnpm typecheck` clean · `pnpm lint` clean · `pnpm test` 239/239 (61 files).

## RED at freeze (2026-11-04)

Typecheck and `pnpm lint` (375 files) stay green with the stubs (`src/content-pipeline/items.ts`, new types in
`src/content-pipeline/types.ts`, re-exports in `src/content-pipeline/pipeline.ts`). Run twice, same result (no fixture leftovers).

`pnpm exec vitest run --project unit src/content-pipeline/__tests__/mf-0014-cards-diagrams.acceptance.test.ts`:

```
× SC-1  × SC-3 + SC-4  × SC-5  × SC-7  × SC-8   Error: not implemented
× SC-6  AssertionError: expected [ 'verifier', 'writer' ] to include 'nature-card'
```

`pnpm exec vitest run --project unit src/engine/content/__tests__/mf-0014-schema.acceptance.test.ts`:

```
× SC-2  ContentValidationError: Invalid content:
          - diagrams/D2.S1.t.yaml: diagrams.0: Unrecognized key: "generatedBy"
          - cards/D2.S1.t.yaml: cards.0: Unrecognized key: "generatedBy"
```

Not frozen: SC-1's dry-run log on the real pack (keeps its named proof). Paid proofs are MF-0022 SC-5..SC-7.

## Baseline (BUILD start)

Same as the preflight: typecheck, lint, 239/239. Only red: the 7 frozen MF-0014 tests above.

## Verification — Iteration 1 (2026-11-04)

| SC | Verdict | Evidence |
|----|---------|----------|
| SC-1 | PASS | acceptance SC-1 green (24 card / 23 diagram skills, `--skill`, no-corpus skip, unknown skill throws). Dry-run on the real pack, after `pnpm generate:corpus` (fetched=34, unsupported=1: the exam-guide PDF): `diagrams: 23 skill(s), writer batch 46 request(s), upper-bound estimate $5.73` · `cards: 24 skill(s), writer batch 48 request(s), upper-bound estimate $5.98`, 0 skipped, no key set |
| SC-2 | PASS | `mf-0014-schema.acceptance.test.ts` green; `origin.test.ts` 3/3; MF-0008 SC-8 (questions) still green after the hoist |
| SC-3 | PASS | acceptance SC-3 + SC-4: card file loads through `parseContent`; 3 empty/blank "where it breaks" drafts, 1 foreign source and 1 over-need dropped with reasons |
| SC-4 | PASS | same test: unknown node, duplicate node, 1 node, no edge, foreign source, over-need dropped; written diagram loads and the card links it |
| SC-5 | PASS | acceptance SC-5: `evals/golden/{cards,diagrams}/` load; empty-break caught by code with no verdict; 0.8 passes, 0.6 fails; MF-0008 SC-4 still sees exactly 3 clean question cases |
| SC-6 | PASS | acceptance SC-6: 4 prompts locked (`pnpm prompts:lock`: card-verifier@1, diagram-verifier@1, diagram@1, nature-card@1); all 15 §2.4 seeds present; MF-0008 SC-5 green |
| SC-7 | PASS | acceptance SC-7: spy client never called under the cap; `run=<tag>/card-writer … usd=1.00`, `…/card-verifier … usd=10.00` |
| SC-8 | PASS | acceptance SC-8: extra field / wrong shape / over-long → null; `&lt;/source>` in requests; provenance from code |

Regression (`questions.ts` hoist): `pnpm generate:questions --dry-run` → `writer batch: 572 request(s), upper-bound estimate $70.41`, identical to MF-0008's LOOP-VERIFY.
Client boundary: `DiagramFigure` passes only `direction`, `nodes`, `edges` to `FlowDiagramLazy` (`diagram-figure.tsx:23`); cards render in Server Components. `generatedBy` never reaches the browser.

## Gates and suite

`pnpm typecheck` clean · `pnpm lint` 385 files, no fixes · `pnpm test` 65 files, **255/255** (239 + 16 new) · `pnpm build` exit 0.
Frozen hashes unchanged: both MF-0014 files and both MF-0008 files `OK`.

## Receipt — code-diff hash cda4ed237731278fe0e115eb709e3d090d82eef6ab759e05e762c783caedd4d8

Hash = `{ git diff HEAD -- . ':!.planning'; sorted untracked files ("== path" + content) } | shasum -a 256`.
Verdict: **DONE** for this tree.

EVAL (by hand): task graph T1→T3, T2+T3→T4, acyclic; every SC closed by a task; receipt hash = current tree.

Not verified here (MF-0022): any real Batch call, the verifier's real catch rate on the golden sets, real cost,
the per-domain PRs. Not reviewed by a fresh-context reviewer (tier normal).
