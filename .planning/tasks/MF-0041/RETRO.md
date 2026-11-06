---
ticket: MF-0041
outcome: pass
causes: none
actions: none
applied: 2026-11-06
lesson_keys: reserved-ticket-premise-recheck, frozen-shape-collision-grep-in-plan, draft-rule-vs-own-proof-case, proof-case-replay-before-freeze
---
## Numbers
`pnpm ticket:retro` does not exist; facts read from the ticket files.
- tier high-risk, 1 pass through BUILD, 0 re-freezes, 0 refreezes after plan approval
- freeze RED: 20 tests (19 `not implemented` stub, 1 SC-5 CLI exit 0 vs 1), all in the frozen file; the rest of `pnpm test` 764 green
- TEST: 20/20 frozen, `pnpm test` 784 passed, typecheck 0, lint clean, `pnpm gate:planning` ok
- SC-7 `14 hashes identical`; SC-8 MF-0036 sha256 `6fc565c9…4f79` unchanged; SC-9 `7 problem(s)` = baseline, 0 flaw-line
- review: PASS-WITH-NOTES, 0 blocking, 7 notes, no code change after the review
- token metrics: not available

## Went right
- Pickup re-derived the reserved GOAL's premise and found by grep that a flaw-key rule inside `checkCuckooFile` would turn MF-0036's frozen SC-2/SC-3 red (`toEqual([])` on the D6.S1 shape). It was solved before freeze with a separate export `checkFlawKeys` (D-1), so there was no re-freeze and SC-8 is a one-line hash check. The skill already requires this (SKILL.md Stage 2b collision grep over `builds_on` FROZEN.json) and the intake applied it. Evidence: GOAL Facts "Collision found", D-1. — keep: already is: `.claude/skills/gsd-goal-loop/SKILL.md` (frozen-collision grep, ~line 328); the retro gate row's "re-derive at pickup" wording.
- Proof-case replay at intake (pre-fix D6.S1 from `862f462^` fires; 14 cuckoos scanned, 1 hit) and an edge-input table decided the rule before freeze; the user's Q-1 then made the annotation prove which line a human read. Reviewer found no spec defect, only notes that the table already listed as "pass". — keep: already is: lesson key `proof-case-replay-before-freeze`.
- The frozen SC-5 test that spawns the real CLI caught the `/** packs/*/cuckoos */` early-closed comment in BUILD, in the same iteration it was written. — keep: already is: testing.md "frozen SC" CLI test pattern from MF-0036.

## Went wrong
- Nothing that cost an iteration. The one build defect (`*/` inside `packs/*/cuckoos` in a JSDoc block) was caught by SC-5 at once and fixed by a `//` comment. A static check (`node --check scripts/**/*.mjs`, or `biome lint` parse errors) would also flag it, but the frozen CLI test already does, so adding a gate for one occurrence would add load for no saving.
- Reviewer notes 1 (a mis-key passes when the keyed line is unlabelled or its label equals `flawLine`) and 5 (ENOENT on a bad `MF_PACKS_DIR` with no corpus) were left as notes. Both are in the GOAL edge table as decided "pass" rows or unreachable with the default `packs/`, and the user accepted the limit in C-1/Q-1. Cause: none (a stated, accepted scope limit).

## Actions (at most two)
None. Every lesson here (collision grep, premise recheck at pickup, proof-case replay) is already written where it is loaded and was followed.

## Not worth changing
- `/** … */` containing `*/` via a glob in a comment: one occurrence, caught by the frozen CLI test in the same iteration. Not a gate.
- Reviewer note 1 (rule misses mis-keys whose keyed line has no label): a possible follow-up ("fire when label `flawLine` exists on a different line"), but it has zero known real defects (14 cuckoos scanned, 1 numbered list) and would widen a rule the user scoped in Q-1. Do not draft a ticket until a second mis-keyed cuckoo is found.
- Reviewer notes 2-4, 6, 7 (notes above the `- id:` line invisible, block-scalar false positive, label counted as a word, weak SC-1 message assertion): contrived inputs or fail-loud, within spec. Optional doc line "put the note first under `- id:`" can ride on the next touch of `cuckoo-flaw-key.mjs`.
- Baseline `check:packs` red (7 MF-0033 problems) and `check:packs` not being in CI: out of scope per Q-2, owned by other tickets.

## Applied

- No actions proposed; nothing applied, nothing held. Memory: none changed.
