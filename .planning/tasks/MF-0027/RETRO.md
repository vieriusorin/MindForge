---
ticket: MF-0027
outcome: pass
causes: tooling
actions: skill-edit, gate
applied: 2026-11-05
lesson_keys: reserved-ticket-premise-recheck, probe-library-behaviour-before-oracle, hook-names-missing-command
---
## Numbers
`pnpm ticket:retro MF-0027` does not exist (no `ticket:*` entry in package.json, no `scripts/ticket-retro.mjs`), so these come from the ticket's files:
- tier normal, decision only; `last_iteration: 0`, no frozen tests, no code, no refreeze, no review stage
- 1 question put to the user (Q-1, answered "Count it"); 0 research files
- Facts gathered read-only: questions per skill, ts-fsrs 5.4.2 probe (5 cases, fuzz off), Spoiled precedent
- Outputs: ADR 0005 (9 lines), CONTEXT.md **Revealed** (+1 line); `pnpm lint` PASS (575 files)
- Token and session metrics: not available, so no median comparison

## Went right
- The reserved GOAL was treated as a hypothesis, not a spec. Before asking, the session re-derived every claim from source: it counted questions per skill, read `least-recently-seen.ts` and `memory-by-skill.ts`, and probed ts-fsrs. That corrected two inherited premises: the MF-0003 note "sprout only (stability ≈ 2.3)" (repeated reveals reach S 9.7 / 24.0 / 50.0, so Tree and Ancient thresholds are reachable on 2 to 3 question banks), and the framing "after a wrong answer in the Duel" (every mode reveals after every answer). The user then chose with the real numbers in front of them (GOAL.md Facts 4 and 6, ADR 0005 Consequences). — keep: sharpen the existing sentence in `.claude/skills/gsd-goal-loop/SKILL.md` that covers reserved sibling tickets (Action 1), so it is not limited to gate tickets.
- The ADR states how the new term differs from the precedent (**Spoiled** = key before any retrieval, **Revealed** = key as feedback on one) and names the residual risk plus a revisit trigger, which is what SC-1 and SC-2 asked for. — already is: GOAL.md SCs.
- The decision-only tier choice was written down ("Decided without a question") and the follow-up ticket was correctly not created (SC-3). — already is: GOAL.md.

## Went wrong
- The orchestrator wrote the first RETRO.md itself, so the fresh-context step in `references/retro.md` ("Why a separate agent") was skipped. The draft had no front matter and used a cause (`premise-unchecked`) that is not in the closed set. It also said "nothing material went wrong" about a premise error, while the same file listed the wrong "Duel only" framing. Cause: tooling. The Stop hook's instruction (`.claude/hooks/lib/retro-trigger.mjs` line 78) tells the session to run `pnpm ticket:retro <ID>`, which does not exist, so step 1 (RETRO_FACTS) could not run and the session had no facts file to hand a retro agent. The hook header also points at `pnpm ticket:retro --across`.
- The reserved GOAL and the MF-0003 review note it came from carried two false or incomplete premises into a ticket (above). The loop caught them only because this session chose to probe; no rule says a reserved non-gate ticket gets that re-check. Cause: missing-context (the closest rule, SKILL.md line 136 to 137, covers a reserved gate ticket and an oracle over library numbers, not a decision ticket drafted from a review note).

## Actions (at most two)
1. skill-edit: `/Users/sorinvieriu/Projects/mind-forge/.claude/skills/gsd-goal-loop/SKILL.md` — in the paragraph that already says "A reserved sibling that states the same rule (MF-0033) gets the same probe when it is picked up.", append this sentence directly after it: "Any reserved ticket drafted from a review note or a deferred concern is a hypothesis too: at pickup, re-derive each factual claim in it from source or a one-line probe, list the corrections in a `## Facts` section of the GOAL, and only then ask the user (MF-0027: the MF-0003 note said 'sprout only' and the GOAL said 'after a wrong answer in the Duel'; a ts-fsrs probe and a read of the pickers showed every mode reveals and that Tree and Ancient stability are reachable on 2 to 3 question banks)." Would have saved: nothing this time, since the session did it unprompted; it makes the step a rule for the next decision ticket drafted from a note (MF-0012 drafts several), where the user would otherwise be asked a question built on a wrong premise.
2. gate: draft a new reserved ticket (claim the next free number, `goal_status: reserved`) for a check in `/Users/sorinvieriu/Projects/mind-forge/scripts/check-hooks.mjs`: scan `.claude/hooks/**/*.mjs`, `.claude/skills/**/*.md` and `.claude/settings.json` for `pnpm <name>` where `<name>` has no key in `package.json` `scripts` (and is not a built-in pnpm command such as `install`, `dlx`, `exec`, `run`). It would have flagged `pnpm ticket:retro` in `.claude/hooks/lib/retro-trigger.mjs` (line 78) and `.claude/hooks/retro-trigger.mjs` (header). The ticket must also decide the other half: build `scripts/ticket-retro.mjs` plus the `ticket:retro` package.json entry (RETRO_FACTS and `--across`), or rewrite the hook text to match what exists; the hook and gate script are held paths, so the user reviews that diff. Would have saved: a retro written without facts and without a fresh agent (this ticket), and a retro hook that can only be satisfied by hand-gathering facts every time.

## Not worth changing
- The draft RETRO's invalid cause `premise-unchecked`: the closed set already has `missing-context`; the fresh retro replaces it, no rule change needed.
- No memory change: `feedback-verify-derived-facts.md` already says to re-count from source before SCs and frozen tests. This ticket followed it. Action 1 puts the reserved-ticket case in the skill, where the stage reads it, not in memory.
- Whole-ticket token cost: not measurable here, and the ticket was small (no code, one question).
- ADR 0005 itself: the "Count it" decision carries a stated residual (small banks overstate readiness) and a revisit trigger. That is a product risk, not a process one.

## Applied

- 2026-11-05 · skill-edit (additive) applied: `.claude/skills/gsd-goal-loop/SKILL.md` DESIGN paragraph, reserved-ticket premise re-check sentence appended after the MF-0033 sentence.
- 2026-11-05 · gate → reserved ticket `.planning/tasks/MF-0051/GOAL.md` drafted (`goal_status: reserved`), not built.
- Held: nothing.
