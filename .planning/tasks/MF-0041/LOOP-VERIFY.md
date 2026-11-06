# MF-0041 LOOP-VERIFY

## RED at freeze (2026-11-06)
`pnpm exec vitest run --project unit src/test/__tests__/mf-0041-flaw-key.acceptance.test.ts`: 20 failed.
- SC-1…SC-4, SC-6 (19 tests): `Error: not implemented`, from the typed stub `scripts/lib/cuckoo-flaw-key.mjs`. This is the SC's own red: the rule does not exist yet.
- SC-5: `AssertionError: expected +0 to be 1 // Object.is equality`. `check:packs` exits 0 on a mis-keyed fixture because the CLI does not run the rule.
- Full `pnpm test`: `Tests 20 failed | 764 passed (784)`. Every red is in the frozen file, and typecheck exits 0.
- MF-0036 frozen file untouched: sha256 still `6fc565c9…4f79` (D-1).

## TEST (2026-11-06)
| SC | Verdict | Evidence |
|---|---|---|
| SC-1…SC-6 | PASS | frozen file 20/20 green, hash `4e53c0fc…3de6` = FROZEN.json |
| SC-7 | PASS | `14 hashes identical` |
| SC-8 | PASS | MF-0036 sha256 `6fc565c9…4f79` unchanged; its tests are green in the full run |
| SC-9 | PASS | `check:packs: 7 cuckoo file(s), 485 item(s) checked, 5 skipped (source not cached), 7 problem(s)`, 0 `flaw-line` |

- `pnpm typecheck` 0 · `pnpm lint` clean · `pnpm test` `Tests 784 passed (784)` · `pnpm gate:planning` ok.
- Review: diff-reviewer PASS-WITH-NOTES, `reviewed_hash: 1a975fcc…3e4d`, no code change after the review.
- BUILD fix: `packs/*/cuckoos` inside a `/** */` closed the comment early (`*/`), and the SC-5 red showed it. Changed to a `//` comment.
Verdict: DONE for this tree.
