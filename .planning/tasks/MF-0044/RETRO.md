---
ticket: MF-0044
outcome: pass
causes: known-trap-repeated
actions: skill-edit
lesson_keys: gate-parser-fail-closed, reserved-ticket-premise-recheck, proof-case-replay-before-freeze, red-first-regression-test, review-fix-delta-reread
applied: 2026-11-06
---
## Numbers

No `ticket:retro` script exists; counts come from the artifacts and the session facts.
- Review rounds: 2, both approve, no blocking findings (round 1 had 4 minors, all fixed; round 2 approve).
- Tier after pickup: `high-risk` (corrected from `normal`, gate script). Frozen file never edited (sha256 matches FROZEN.json).
- Final `pnpm check:packs`: `216 checked, 0 problem(s), 156 skipped (grandfathered), 5 multi-select not checked`.
- User checkpoints: 3 design questions + plan approval. Proof case passes at 1.14 (thin margin).

## Went right

- Fail-closed was in the GOAL constraints from the start, applying the MF-0043 retro. The build added a select-type check mid-build, and the review had no blocking finding. MF-0043 needed 3 rounds with 4 blockers, and this ticket needed 2 rounds with none. — keep: already is, `gsd-goal-loop/references/verification.md` §4 ("Writing a gate or check script: its parser fails closed").
- Tier re-derived at pickup (normal to high-risk), and the draft's figure was corrected (40 of 48 single-answer, not 44 of 53). The reserved-ticket premise recheck worked again. — keep: already is, `SKILL.md` pickup.
- The ticket-number collision (MF-0058 was GitHub issue #90 with no folder) was caught by a manual grep and `gh issue list --search` before anything was written, and the follow-up was reserved as MF-0059. — keep: already is, `SKILL.md` line ~102 (check the issue list for the registry).
- The frozen tests ran the real script (no stub), with red as "rule absent". The `ticket:collisions` dogfood gave exit 0. — keep: already is.
- The review's false-clean probe ran the same malformed question in a grandfathered pack and a plain pack. That is a good probe shape, and the fix was RED-first with a delta re-review. — keep: already is, `red-first-regression-test`.

## Went wrong

- Review minor 1: the grandfather skip sat before the structure checks, so a malformed question inside a grandfathered pack (156 questions) was not checked at all. This is fail-open for the exemption path. The §4 rule covers unparseable input but names only parser inputs, so the build applied it to the parser and not to the allowlist or exemption. Cause: known-trap-repeated. The rule was written and loaded, but its wording is about tokens and sections, not about exemptions.
- Cost was small: one fix round after approval, no frozen re-freeze. No other process failures.

## Actions (at most two)

1. skill-edit: `.claude/skills/gsd-goal-loop/references/verification.md` §4 — after the sentence ending "…the literal "None"." (and before "MF-0043 shipped all four…"), add: "The same holds for an exemption, grandfather list or allowlist: it may skip only the one rule it exists for, and the structure and shape checks run first for every item, exempt or not. Add a plan test: the same malformed item inside an exempt set must still fail (MF-0044: the grandfather skip came before structure checks, so 156 questions went unchecked until review minor 1)." Would have saved: the post-approval fix round and the delta re-review.

## Not worth changing

- `pnpm ticket:github next` could not run (gh lacks `read:project`). This is an environment limit, and the manual grep worked.
- The thin proof margin (1.14) was a draft property, and the ticket recorded it. It is not a loop defect.
- The `skipped (grandfathered)` label is now slightly understated. It is pinned by frozen SC-3, and the review marked it as a note.
- A key with empty text passes the length rule (ratio 0). The zod `QuestionSchema` covers it, per a review note. This is a single case.

## Applied
2026-11-06, automatic policy:
- skill-edit (additive), applied: `.claude/skills/gsd-goal-loop/references/verification.md` §4 gains the exemption /
  grandfather / allowlist clause (structure checks run first for every item; a plan test with a malformed item inside
  the exempt set).
- held: nothing.
