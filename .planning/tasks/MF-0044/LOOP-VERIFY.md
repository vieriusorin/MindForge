---
ticket_id: MF-0044
iteration: 0
---

# LOOP-VERIFY — MF-0044

## Baseline (2026-11-06, before any change)

`pnpm typecheck` exit 0 · `pnpm lint` exit 0 · `pnpm test` 157 files / 812 passed · `pnpm gate:planning` ok ·
`pnpm check:packs` exit 0 (7 cuckoo files, 270 items checked, 220 skipped, 0 problems) · `main` CI last 3 `success`.

## Proof-case replay (before freeze)

Read-only probe of the drafted rule over `packs/`: ccdv-f 40, prod-prompting 28, platform-foundations 2 hits (RED);
claude-code-in-action 0 hits, worst 1.14 (GREEN, the named proof case).

## RED at freeze (2026-11-06)

- `src/test/__tests__/mf-0044-key-length.acceptance.test.ts`: 5/5 fail, identical on a 2nd run, because the script has
  no key-length rule: SC-1 `expected +0 to be 1`; SC-2/SC-3 `expected 'check:packs: 0 cuckoo file(s), 0 item…' to
  contain 'key-length: …'`; SC-4 stderr lacks `fixture.S1.q2: select: 1 needs exactly one correct option…`; SC-6
  `expected 'check:packs: 7 cuckoo file(s), 270 it…' to match /key-length: …/`.
- No stub: the tests run the real script, so the red is runtime. `pnpm typecheck` 0, `pnpm lint` 0.
- Whole `pnpm test`: the only reds are these 5 (`Tests 5 failed | 812 passed`).

## Review (fresh-context `diff-reviewer`, REVIEW.md)

- Round 1: **approve**, 0 blocking, 4 minor. Minor 1 contradicted the GOAL constraint (fail closed): the grandfather
  skip ran before the structure checks, so a malformed question in ccdv-f / prod-prompting / platform-foundations was
  skipped. Minor 2 `Infinity×` message on empty distractors; minor 3 `String.length` counted an emoji as 2 and a
  `text: |` trailing newline; minor 4 a dead `?? 0`.
- Fixed after approval, regression tests RED first (`key-length.test.ts`): `expected { problems: [], checked: +0, … }
  to deeply equal { problems: [ {…} ] … }` (grandfathered malformed question), the Infinity message, the emoji/block
  over-count (3 failed | 8 passed). Now pass.
- Round 2 (delta re-read): **approve**, `reviewed_hash: 92bd7cfb…8837b1e45`. Post-review changes: `.planning/` only.

## Receipt (2026-11-06, the reviewed code tree)

| Check | Result |
|---|---|
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | exit 0 (644 files) |
| `pnpm test` | 159 files / 828 passed |
| `pnpm gate:planning` | ok (57 folders) |
| `pnpm check:packs` | exit 0: `key-length: 216 checked, 0 problem(s), 156 skipped (grandfathered), 5 multi-select not checked` |
| frozen file hash | `a80b26e5…` = FROZEN.json (unedited) |

## Success Criteria

| SC | Proof | Result |
|---|---|---|
| SC-1 | frozen SC-1: `fixture.S1.q1: key is 120 chars, longest distractor 100 (1.20×, limit 1.15×)`, exit 1 | pass |
| SC-2 | frozen SC-2: 1.10× → `key-length: 1 checked, 0 problem(s)`; 1.15× fails; inner 1.1499 passes | pass |
| SC-3 | frozen SC-3: `key-length: 0 checked, 0 problem(s), 1 skipped (grandfathered), 0 multi-select not checked` | pass |
| SC-4 | frozen SC-4 (2 keys / 0 keys / bad YAML / select: 2 counted) + inner cases (select type, non-map, options, fields, empty distractors, grandfathered malformed) | pass |
| SC-5 | `.cache/corpus` moved aside: real packs → corpus-missing line carries `key-length: 216 checked, 0 problem(s), 156 skipped (grandfathered), 5 multi-select not checked`, exit 0; a 1.20× fixture → problem printed, exit 1; corpus restored (35 files). Call order reviewed (`check-pack-grounding.mjs` rule before the corpus exit) | pass |
| SC-6 | frozen SC-6 over real `packs/` + `pnpm check:packs` exit 0 | pass |
| SC-7 | receipt above | pass |

## Not verified

- CI has no `check:packs` step; CI enforces the rule through the frozen SC-6 case in `pnpm test` (as MF-0041).
- A whitespace-only key has ratio 0 and passes this rule (reviewer note; zod `min(1)` rejects only empty text).
- `pnpm ticket:github` claim/sync not run: the `gh` token lacks `read:project`.
