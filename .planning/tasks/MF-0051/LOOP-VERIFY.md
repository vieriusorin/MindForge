# MF-0051 LOOP-VERIFY

No `ticket:verify` / `ticket:freeze` script exists (MF-0080): the skill's defaults were run by hand. Frozen file:
`src/test/__tests__/mf-0051-pnpm-refs.acceptance.test.ts` (FROZEN.json, sha256 over LF content).

## RED at freeze (2026-11-09)

`pnpm exec vitest run src/test/__tests__/mf-0051-pnpm-refs.acceptance.test.ts` against the stub
`scripts/lib/pnpm-refs.mjs` (new module, exports throw) and the unchanged `scripts/check-hooks.mjs`:

```
× SC-1: the proof-case line names an unknown script            Error: not implemented
× SC-1: known scripts, built-ins, `run`, trailing punctuation…  Error: not implemented
× SC-1: in Markdown only code spans and fenced blocks count     Error: not implemented
× SC-2: check-hooks fails on a fixture root, naming the file…   AssertionError: expected +0 to be 1
× SC-3: no file in this repo names a pnpm script that does not exist   Error: not implemented
Tests  5 failed (5)
```

SC-2 is its own red (check-hooks ignores `MF_CHECK_ROOT`, scans nothing and passes). SC-3's own red is the
proof-case replay (GOAL Iteration Log): the drafted rule finds 18 hits on today's tree, the first
`.claude/hooks/lib/retro-trigger.mjs:78 pnpm ticket:retro`. typecheck 0, lint 0. Full `pnpm test`: 6 failed |
1451 passed; the 5 above plus the baseline Windows-only `mf-0065-check-misconceptions` SC-8.

## Collisions

`node scripts/frozen-collisions.mjs MF-0051` → "no unlisted collisions for PNPM_BUILTINS, checkGoalProofs across
128 file(s)", exit 0. By hand: `mf-0005-ci.acceptance.test.ts:78` names `node scripts/check-hooks.mjs` only for the
CI step order, which this ticket does not change.

## Build replay: proof case RED on today's tree (after T2, before T4)

`node scripts/check-hooks.mjs` → exit 1, `pnpm refs: 196 files checked`, 18 `FAIL` lines, the first proof-case one
`FAIL .claude/hooks/lib/retro-trigger.mjs:78 pnpm ticket:retro (not a package.json script)`; the rest exactly the
GOAL Facts list. Acceptance at that point: SC-1 ×3 and SC-2 green, SC-3 `expected [ …(18) ] to deeply equal []`.

## Receipt (2026-11-09, iteration 0)

| Check | Result |
|---|---|
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | exit 0 (biome check, 898+ files) |
| `pnpm test` | `Tests  1 failed \| 1475 passed (1476)`; the one red is baseline (`mf-0065-check-misconceptions` SC-8, Windows path separator) |
| `node scripts/check-hooks.mjs` | exit 0: 13 imports, 7 hook commands ok, `pnpm refs: 196 files checked`, `check-hooks: PASS` |
| `pnpm gate:planning` | `70 ticket folders checked, ok` |
| `pnpm gate:workspace` | `4 allowBuilds entries, ok` |
| `pnpm check:goal-proofs MF-0051` | `every proof resolves` |
| `node --check` on the 5 edited hooks | exit 0 each |

## SCs

| SC | Verdict | Evidence |
|---|---|---|
| SC-1 | PASS | acceptance SC-1 ×3 green; inner `pnpm-refs.test.ts` 19 green |
| SC-2 | PASS | acceptance SC-2 green; replay above (exit 1, proof case named) |
| SC-3 | PASS | acceptance SC-3 green (`[]`); `node scripts/check-hooks.mjs` exit 0 |
| SC-4 | PASS | `mf-0049-goal-proofs.acceptance.test.ts` + `goal-proofs.test.ts` 17/17; `grep -n PNPM_BUILTINS scripts/lib/goal-proofs.mjs` → `9: import`, `144: use` |

Post-freeze GOAL wording change (no contract change): SC-2's text named `x.mjs:1` and quoted `pnpm foo` /
`pnpm ticket:retro` as code; `check:goal-proofs` read those as proof commands. Reworded, and `:1` corrected to `:2`
to match the frozen test (the fixture's line 1 is the template opener). The frozen file is unchanged.

## Post-review receipt (2026-11-09, tree `451da4b7bde6b55a615ff50a93ae11eb797d66b342934c7b5e72e04f933f26ea`)

Review B-1 regression `src/test/__tests__/check-hooks-walk.test.ts` was RED before the fix:
`AssertionError: expected 'node:fs:1725 … const stats = bindi…' not to contain 'ENOENT'`. Parser follow-ups were
RED first in `pnpm-refs.test.ts` (3 failed | 19 passed). After the fixes:

| Check | Result |
|---|---|
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | exit 0 (900 files) |
| `pnpm test` | `Tests  1 failed \| 1479 passed (1480)`; only the baseline `mf-0065` SC-8 Windows red |
| `node scripts/check-hooks.mjs` | exit 0, `pnpm refs: 196 files checked` |
| `pnpm gate:planning` / `pnpm gate:workspace` | ok / ok |
| `pnpm check:goal-proofs MF-0051` | `every proof resolves` |
| `node scripts/frozen-collisions.mjs MF-0051` | `Symbols changed says None.` exit 0 |

Re-freeze (user approved): FROZEN.json history `651738c9…` → `459864b1…` (SC-3 walk skips links; assertions
unchanged). SC-4 withdrawn; `scripts/lib/goal-proofs.mjs` identical to HEAD. Delta re-reviewed: REVIEW.md bound to
this tree, verdict approve.

| SC | Verdict | Evidence |
|---|---|---|
| SC-1 | PASS | acceptance SC-1 ×3; inner `pnpm-refs.test.ts` 22 |
| SC-2 | PASS | acceptance SC-2; replay exit 1 with the proof case |
| SC-3 | PASS | acceptance SC-3 `[]`; `node scripts/check-hooks.mjs` exit 0 |
| SC-4 | WITHDRAWN | user, review N-6 |
