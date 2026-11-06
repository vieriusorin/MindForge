---
ticket: MF-0043
outcome: pass
causes: wrong-plan, missing-context
actions: skill-edit, skill-edit
lesson_keys: gate-parser-fail-closed, replace-hand-procedure-keep-every-clause, proof-case-replay-before-freeze, reserved-ticket-premise-recheck, red-first-regression-test, review-fix-delta-reread
applied: 2026-11-06
---
## Numbers

No `ticket:retro` script exists; counts come from the artifacts and the session facts.
- Review rounds: 3 (round 1: 3 blocking, round 2: 1 blocking, round 3: approve). Tier after pickup: `high-risk` (corrected from `normal`).
- Frozen acceptance file: 5 cases, never edited. Every fix went through `scripts/lib/frozen-collisions.mjs` and the non-frozen `src/test/__tests__/frozen-collisions.test.ts`, each with a RED-first regression test.
- Proof-case replay RED/GREEN done on `git archive da583a0` before FROZEN.json was written.
- Not done: `pnpm ticket:github --claim` (gh token lacks read:project). CI not yet run on the branch. Commit pending.

## Went right

- The tier was re-derived at pickup (normal to high-risk, since it is a gate script), and the proof case was replayed with a throwaway probe before freezing. Both are the loop's own rules from earlier retros. They worked here and caused no re-freeze. — keep: already is, `gsd-goal-loop/SKILL.md` (HIGH_RISK binding on gate scripts, FREEZE STOP replay line).
- The frozen file stayed untouched across 3 review rounds, so no re-freeze was needed. Fixes went into the lib and an inner test. — keep: already is, `testing.md` ("Acceptance tests are frozen").
- The fresh-context review caught 4 blocking "false clean" paths that the frozen cases and the author's tests did not. Each fix had a RED regression test, which is the `red-first-regression-test` rule. — keep: already is.
- The frozen tests caught the first B2 fix when it broke the MF-0032 layout (`### Frozen files…` nested under `## Symbols changed`). The frozen cases are real layouts, and they protected the fix. — keep: already is.

## Went wrong

- **The parser failed open.** The first draft filtered tokens that were not plain identifiers (`filter()`), so unusable input was dropped and the check exited 0 like "None". A `###` subheading emptied the Symbols section, and `Promise<PackContent>` kept only `Promise`. These were blockers 1, 2 and 4, and three of the four review findings share one shape: for a gate, unknown input must be rejected, not skipped. Nothing in the plan or the skill said so. Cause: missing-context. The skill has the proof-case replay but no rule on how a gate parser treats input it cannot parse.
- **The skill rewrite dropped part of the old hand grep.** The old procedure grepped for symbols "as literals"; the new text lost that clause (blocker 3). The SCs were written from the script's behaviour, not from a clause-by-clause read of the procedure being replaced. Cause: wrong-plan.
- **The first B2 fix broke two frozen cases** because it was not run against every layout in the shipped GOAL files first. The frozen tests caught it, so the cost was one iteration, not a defect. Cause: wrong-plan, same pattern as `draft-rule-vs-own-proof-case`.

## Actions (at most two)

1. skill-edit: `.claude/skills/gsd-goal-loop/references/verification.md` — add this paragraph under the section on gate and check scripts, or at the end of the file if no such section exists: "A gate parser fails closed. Any token, section, heading level or syntax it cannot parse is an error (non-zero exit, naming the input), never dropped and never read as 'none found'. Do not `filter()` unparseable input; `reduce` to a result plus a `rejected` list and fail when it is non-empty. In the plan, list the four inputs the parser must reject with a test each: an unparseable token, a nested subheading inside the section, a generic or qualified name, an empty section that is not the literal 'None' (MF-0043: all four were shipped as exit 0 and found only at review, 3 rounds)." Would have saved: review rounds 1 and 2, roughly two iterations.
2. skill-edit: `.claude/skills/gsd-goal-loop/references/templates.md` — in the SC guidance for a ticket that replaces a hand procedure with a script or a skill rewrite, add: "List every clause of the old procedure as its own SC row, or mark it dropped on purpose in Concerns, and run the new text against all shipped layouts before freezing (MF-0043: the 'as literals' clause was lost in the skill rewrite and the first parser fix broke the MF-0032 layout)." Would have saved: blocker 3 and one iteration on the B2 fix.

## Not worth changing

- `pnpm ticket:github --claim` could not run because the token lacks `read:project`. This is an environment limit, not a loop defect. The memory entry `windows-dev-environment` is not the right place; the claim step already says it may be skipped.
- No CI run yet and the commit is pending. That is the normal hand-off state under `no-commit.md`.
- Tier correction at pickup worked, so there is no further tier action. The HIGH_RISK binding for gate scripts is already in `SKILL.md`.

## Applied
2026-11-06, automatic policy:
- skill-edit 1 (additive), applied: `.claude/skills/gsd-goal-loop/references/verification.md` §4 gains "Writing a gate
  or check script: its parser fails closed" with the four must-reject inputs.
- skill-edit 2 (additive), applied: `.claude/skills/gsd-goal-loop/references/templates.md` GOAL Success Criteria gains
  the "replacing a hand procedure: one SC row per old clause, run over every shipped layout" note.
- held: nothing.
