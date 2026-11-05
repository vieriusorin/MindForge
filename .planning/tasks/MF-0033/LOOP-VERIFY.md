# LOOP-VERIFY — MF-0033

## RED at freeze (2026-11-05)
`pnpm exec vitest run src/test/__tests__/mf-0033-item-grounding.acceptance.test.ts`
```
     × SC-1: the pre-fix D2.S2 diagram (`no (end_turn)`) fails on end_turn; the post-fix diagram passes
     × SC-1: a backticked span passes when every word in it is on the page (`is_error: true`)
     × SC-1: an illustrative name fails unless declared with # example-name
     × SC-1: a rationale token that also occurs in the stem or an option text is exempt
     × SC-2: the pre-fix MF-0038 D5.S2.q5 stem fails on claude.ai; the post-fix item passes
     × SC-2: # framing with a reason exempts the term; # framing without a reason is an annotation problem
     × SC-3: one cached and one uncached url with an end_turn label: no problem, skipped = 1
Error: not implemented   (7 of 7)
```
Typecheck green, lint clean at freeze. The red comes from the stub, so it is the SC's own.

## Baseline (before BUILD)
`pnpm typecheck && pnpm lint && pnpm test` → exit 0, `Tests  645 passed (645)`, `Test Files  136 passed (136)`.
`pnpm check:packs` → `check:packs: 7 cuckoo file(s), 0 problem(s)`. main CI `success` @ 629744a.

## Receipt — iteration 0, 2026-11-05 — DONE
Tree: `62ad9ef7266d` = sha256 of `git diff HEAD -- packs scripts src` plus the two new files' contents (code and
content only; `.planning/` excluded). `ticket:verify` is not in `package.json`; the default was run by hand.
- `pnpm typecheck` → exit 0. `pnpm lint` → `Checked 589 files in 236ms. No fixes applied.`
- `pnpm test` → exit 0, `Test Files  137 passed (137)`, `Tests  652 passed (652)` (baseline 645 + 7 new).
- Frozen hash: `frozen hash OK` (mf-0033-item-grounding.acceptance.test.ts).
- `pnpm check:packs` → `check:packs: 7 cuckoo file(s), 270 item(s) checked, 220 skipped (source not cached), 0 problem(s)`, exit 0.
- `pnpm gate:planning` → `gate:planning: 50 ticket folders checked, ok`.
- `git diff --quiet HEAD -- scripts/lib/cuckoo-grounding.mjs src/test/__tests__/mf-0036-cuckoo-grounding.acceptance.test.ts evals/` → exit 0.

| SC | Verdict | Evidence |
|---|---|---|
| SC-1 | PASS | acceptance `SC-1` ×4 green (`Tests  7 passed (7)`) |
| SC-2 | PASS | acceptance `SC-2` ×2 green |
| SC-3 | PASS | acceptance `SC-3` green |
| SC-4 | PASS | planted `no (end_turn)` in a scratch packs copy (`MF_PACKS_DIR`) → `prod-prompting.D2.S2.diagram-loop: token "end_turn" is not on the cited page …`, `1 problem(s)`, exit 1. Scratch root without `.cache/corpus` → `check:packs: .cache/corpus missing, skipped (run pnpm generate:corpus)`, exit 0 |
| SC-5 | PASS | first wired run: 7 problems (below); after T3: `0 problem(s)`, exit 0; `pnpm test` 652/652 |

First wired run on the shipped tree (before T3), 7 problems:
`ccdv-f.D1.S2.q1` leak "Messages API" · `ccdv-f.D5.S1.q2` token "top_p", "top_k" · `ccdv-f.D1.S3.diagram-bee-agent-loop`
token "tool_result" · `platform-foundations.D2.S2.q5` leak "claude.ai", "Messages API" · `prod-prompting.D3.S2.q2` leak "Messages API".

contentHash before → after: `ccdv-f.D1.S2.q1` 7e73e08cbf8c UNCHANGED · `platform-foundations.D2.S2.q5` c873697bb758 UNCHANGED ·
`prod-prompting.D3.S2.q2` 0c6e63355dab UNCHANGED · `ccdv-f.D5.S1.q2` 854fb6f0a3bd → 1299e74dd005 CHANGED (C-1, approved) ·
`ccdv-f.D1.S3.diagram-bee-agent-loop` ff10119b7747 → 2e776b6305a6 CHANGED (C-1, approved).
