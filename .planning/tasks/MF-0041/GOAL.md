---
ticket_id: MF-0041
title: "MF-0041: pnpm check:packs gains a flaw-key rule for numbered cuckoo snippets"
tier: high-risk                   # gate script (scripts/check-*.mjs + its lib): HIGH_RISK binding, MF-0055 retro
stage: handoff
goal_status: complete-pending-manual-commit
branch: feat/MF-0041
builds_on: [MF-0016, MF-0036]
---

> Reserved 2026-11-04 by the MF-0036 retro (Action 2). Picked up 2026-11-06 (claimed, issue #71).

## Objective

**Today.** `src/engine/content/schema.ts:159-176` only checks that `flawLine` is in range and not blank.
`ccdv-f.D6.S1.cuckoo-keep-every-tool-result` shipped with `flawLine: 3` keying `"2. Fetch files…"` (a true
line). The snippet's numbered-list labels ran one behind the 1-based line index, so a learner who found the
real flaw was graded wrong. MF-0016's tests and review missed it. The MF-0036 intake probe found it.

**End state.** `pnpm check:packs` runs a flaw-key rule over every `packs/*/cuckoos/*.yaml`. When two or more
`lines` start with a numeric label (`/^\s*\d+[.)]\s/`) and the label of `lines[flawLine - 1]` is not
`flawLine`, the item fails unless it carries a `# flaw-line:` annotation that a human wrote after looking at
the keyed line. The rule does not fire when the flaw line has no label.

## Facts (re-derived at pickup, 2026-11-06)
- Pre-fix shape confirmed: `git show 862f462^:packs/ccdv-f/cuckoos/D6.S1.yaml` has `flawLine: 3`, and line 3 is
  `2. Fetch files…`. Current `flawLine: 4` is `"3. Never clear old tool results…"`.
- Schema check is at `schema.ts:159-176` (the reserved draft said 161-172).
- 14 cuckoos ship (7 files, all `packs/ccdv-f/cuckoos/`). Only D6.S1's has numbered lines.
- **Collision found:** MF-0036's frozen `mf-0036-cuckoo-grounding.acceptance.test.ts` asserts
  `checkCuckooFile(D6S1 keyed on 4)` `toEqual([])` (SC-2) and the same for SC-3. That shape is labels-trail-by-1,
  so a flaw-key rule inside `checkCuckooFile` turns two frozen MF-0036 tests red. See D-1.
- `pnpm check:packs` is red at baseline: 7 problems, all from MF-0033's item rule (5 × leak `claude.ai` in
  `platform-foundations` questions, 2 × token in `subagents` cards). None is a cuckoo problem.
- `check:packs` is not in CI or any hook; it exits 0 "skipped" when `.cache/corpus` is absent.

## Proof-case probe (read-only, scratchpad `probe.mjs`)
proof-case replay: RED. The drafted rule fires on pre-fix D6.S1 (`flawLine 3`, label `2`), on the real pre-fix file
from `862f462^`, and on the fixed shape (`flawLine 4`, label `3`; this needs the annotation). It fires on no
other shipped cuckoo (14 scanned, 1 hit: D6.S1, expected).

Limit stated plainly: the wrong key and the right key look the same to the rule (both trail by 1). The rule
forces a human statement. It cannot tell which line is false. See Concern C-1.

## Affected users and surfaces
- Pack authors and reviewers (`pnpm check:packs`), CI via `pnpm test` (SC-6).
- `scripts/check-pack-grounding.mjs`, new `scripts/lib/cuckoo-flaw-key.mjs`, `packs/ccdv-f/cuckoos/D6.S1.yaml`
  (one comment). No app code, no DB, no UI.

## Constraints
- MF-0036 frozen file stays byte-identical, and its tests stay green.
- Annotations are YAML comments. `contentHash` is unchanged, so no review resets (MF-0036 SC-7 precedent).
- Pure checker in `scripts/lib/`, CLI only does I/O (MF-0036 D-5). Pack-agnostic: no slug in code.

## Out of Scope
- The 7 baseline `check:packs` problems in `platform-foundations` / `subagents` (MF-0033 item rule, other owners).
  Q-2 decides.
- Moving `flawLine` checks into the zod schema: the schema never sees YAML comments.
- Questions, cards, diagrams: they have no `flawLine`.

## Decided without a question
- D-1 The rule is a **separate export** `checkFlawKeys({ file, text })` in `scripts/lib/cuckoo-flaw-key.mjs`, called by
  the CLI beside `checkCuckooFile`. The MF-0036 frozen tests keep calling `checkCuckooFile` unchanged (Facts:
  collision). Source: the frozen-file contract, and the rule that every new behaviour is a new function
  (engineering-principles §2, O/C). Rejected: folding it into `checkCuckooFile` and re-freezing MF-0036 SC-2/SC-3.
- D-2 The flaw-key rule runs **even when `.cache/corpus` is absent**. It needs no corpus, and the CLI test
  (SC-5) must pass in CI, where the corpus is absent. The corpus-dependent rules still skip as today.
- D-3 Problems use the existing `GroundingProblem` shape with `rule: "flaw-key"` and `line: flawLine`.
- D-4 Annotation errors fail (MF-0036 precedent for `# grounded:`): `n ≠ flawLine`, missing reason, malformed,
  and a stale annotation on an item where the rule does not fire.
- D-6 (follows from Q-1: the note must identify the line a human read) The fragment is an exact, case-sensitive
  substring of `lines[n-1]`, occurs in no other line, and has at least 3 words. Form:
  `# flaw-line: <n> — "<fragment>" — <reason>` (`--` accepted for `—`, as in `# grounded:`).
- D-7 SC-5's corpus-absent path is proved by the same test running in CI, where `.cache/corpus` does not exist.
  Locally the corpus exists. No env override is added for it (YAGNI).
- D-5 Shipped-content proof runs in `pnpm test` (SC-6), so CI enforces the rule on every pack without a corpus.

## Edge-input table (the flag: does the item fail?)
| Input | Result | Decided by |
|---|---|---|
| no labelled line | pass | draft (retro) |
| exactly one labelled line | pass | draft ("two or more") |
| ≥2 labelled, flaw line unlabelled (heading, code) | pass | draft |
| ≥2 labelled, flaw label == flawLine | pass, no annotation needed | draft |
| ≥2 labelled, label ≠ flawLine, no annotation | **fail** | draft |
| same, valid annotation | pass | draft |
| annotation with `n ≠ flawLine` | fail (stale) | D-4 |
| annotation, reason empty or malformed | fail | D-4 |
| annotation on an item where the rule does not fire | fail (stale) | D-4 |
| `2)` style, leading spaces, `10.` | counted as labels | draft regex |
| `1.5 GB` (no space after the dot) | not a label | draft regex |
| flawLine out of range / not an int | rule skips (schema reports it) | D-3 |
| annotation's quoted fragment not in the keyed line | fail | Q-1 (user) |
| fragment also found in another line, or fewer than 3 words | fail (does not identify the line) | D-6 |

## Success Criteria (frozen 2026-11-06)
- [x] SC-1 Pre-fix D6.S1 shape (`flawLine: 3`, label `2.`, no annotation) → `checkFlawKeys` returns one problem
  `{ id, line: 3, rule: "flaw-key" }` whose message names label `2`, line `3` and the `# flaw-line:` fix. Proof: frozen test.
- [x] SC-2 Fixed shape (`flawLine: 4`, label `3.`): fails without the annotation, passes with a valid one. Proof: frozen test.
- [x] SC-3 Every "pass" row of the edge table returns `[]`, labels `2)` / indented / `10.` count, `1.5 GB` does not. Proof: frozen test.
- [x] SC-4 Every annotation-error row (incl. D-6) fails with `rule: "flaw-key"`. Proof: frozen test.
- [x] SC-5 `pnpm check:packs` with `MF_PACKS_DIR` at a fixture pack holding the pre-fix shape exits 1 and prints
  the flaw-key line, whether or not `.cache/corpus` exists. Proof: frozen test spawning the CLI.
- [x] SC-6 Every shipped `packs/*/cuckoos/*.yaml` passes `checkFlawKeys` (D6.S1 gains its annotation). Proof: frozen
  test over the real `packs/` dir, in `pnpm test`.
- [x] SC-7 Every shipped cuckoo's `contentHash` is unchanged. Proof: hashes before/after (`content-hash.mjs`) in evidence.
- [x] SC-8 MF-0036's frozen file hash still matches its FROZEN.json, and its 20 tests pass. Proof: shasum + `pnpm test`.
- [x] SC-9 `pnpm check:packs` reports no `flaw-key` problem on the shipped packs, and its problem count equals the baseline
  (7, all MF-0033 item problems; Q-2). Proof: command output in evidence.

## Concerns
- C-1 (user, resolved by Q-1) The rule cannot tell the right key from the wrong one, because both trail by 1. Its value is that
  it forces a human look. The quoted fragment makes the note prove which line was read, and catches drift.

## Open questions
(none)

## Decided by the user
- Q-1 (2026-11-06) Annotation = number + quoted fragment of the keyed line + reason, fragment checked by the rule.
- Q-2 (2026-11-06) The 7 baseline `check:packs` problems stay out of scope. SC-9 is "no flaw-key problem, count = baseline 7".
- No proof command wipes or restarts shared local state, so no approval was needed for one.

## Iteration Log
- 2026-11-06 intake: claimed #71. Proof-case replay: RED (pre-fix D6.S1 fires; 14 cuckoos scanned, 1 hit).
- 2026-11-06 design preflight: `pnpm typecheck` exit 0 · `pnpm lint` clean (634 files) · `pnpm test` 153 files / 764 tests
  passed · `pnpm check:packs` exit 1, 7 problems (baseline, MF-0033 items, not cuckoos) · main CI `success` (303616f).
  No proof command wipes shared state (no `db:reset`, no `supabase stop/start`).
- 2026-11-06 freeze: 20 tests RED (see LOOP-VERIFY), FROZEN.json written. Stage → plan.
- 2026-11-06 plan approved by the user (high-risk checkpoint). Stage → build. Baseline: typecheck 0, lint clean, test 20 failed (frozen MF-0041 only) | 764 passed, check:packs 7 problems.
- 2026-11-06 TEST: all SCs PASS (LOOP-VERIFY). diff-reviewer PASS-WITH-NOTES (7 notes, none blocking: rule misses a label-2 line keyed
  by a different flawLine when the keyed line has no label or another list restarts numbering; notes outside the item block are invisible; the label
  counts toward the 3-word minimum; ENOENT on a bad MF_PACKS_DIR with no corpus). Stage → handoff.
