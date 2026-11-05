---
ticket: MF-0028
outcome: pass
causes: known-trap-repeated
actions: skill-edit
lesson_keys: proof-case-replay-before-freeze
applied: 2026-11-05
---
## Numbers
`pnpm ticket:retro` does not exist; from the artifacts:
- Baseline: typecheck 0, lint 0, test 592/592, 49/49 GOAL.md clean under the probe.
- Iterations: 1 (plus INTAKE/DESIGN iteration 0). Re-freezes: 1 (SC-1 widened, FROZEN.json history).
- User questions: 3 (C-1 CI wiring, C-2 fenced blocks, C-3 proof case not RED). C-3 was avoidable.
- SC-6 (live CI run) unverified locally. No fresh-context review (tier normal).

## Went right
- Baseline probe over every shipped GOAL (49/49 clean) before building: the first run of a new check was treated as a review of existing content. Already is: SKILL.md Stage 2.
- C-1 caught that the Stop gate does not fire on a GOAL-only session or a GitHub merge, so CI was added as a second trigger. Decided by the user with the guarded `ci.yml` edit explicit. Keep: already is, Concerns table.
- TEST replayed the real proof case (`git archive 71ac090 .planning/tasks`) and caught the wrong signal rather than shipping a check that passes its own proof.

## Went wrong
- The drafted rule (only repeated `ticket_id:`) was frozen without being replayed on merge 71ac090. The merge had dropped the second `ticket_id:` and duplicated `tier:`/`stage:`/`goal_status:` instead, so the replay passed in TEST (GOAL.md C-3, Iteration Log iteration 1). Cost: one user question, one re-freeze, one iteration. Cause: known-trap-repeated. SKILL.md Stage 2 already says "run the drafted rule over that proof case with a read-only probe before freezing anything" (MF-0036 precedent), but it sits in a long paragraph with no command and no checklist slot, so it was skipped.

## Actions (at most two)
1. skill-edit: `/Users/stefan/Work/ddroidd/MindForge/code/.claude/skills/gsd-goal-loop/SKILL.md`, Stage 2 (DESIGN), the paragraph containing "run the drafted rule over that proof case". Do not add a second rule. Insert, as a separate line immediately before that paragraph, a hard stop so it is read at the moment of freezing:

   `FREEZE STOP: if the GOAL names a proof case (a merge sha, a reserved gate ticket, a bad commit), the Iteration Log must hold a line "proof-case replay: RED|GREEN" before FROZEN.json is written. Replay with a read-only probe, e.g. git archive <sha> <path> into the scratchpad and run the drafted check on it. GREEN means the rule is wrong: raise a Concern, do not freeze (MF-0028: replay passed after the freeze, costing a re-freeze and an iteration).`

   Would have saved: one user question, one re-freeze, one iteration.

## Not worth changing
- A static gate for "replay logged before freeze" is possible (freeze script checks the Iteration Log), but it would only apply to tickets with a proof case. Revisit if the lesson recurs; key `proof-case-replay-before-freeze`.
- C-2 (fenced blocks) was a genuine decision, accepted as is. No change.
- SC-6 live CI unverified is inherent to a ticket that edits CI; the hand-off notes it. No change.

## Applied

2026-11-05, automatic policy:
- Action 1 (skill-edit): applied additively in `.claude/skills/gsd-goal-loop/SKILL.md` Stage 2, as its own
  "FREEZE STOP" line before the edge-input paragraph that holds the existing proof-case rule. Nothing removed
  or loosened.
- Held: nothing.
