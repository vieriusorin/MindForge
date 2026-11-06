---
ticket: MF-0043
outcome: pass
causes: none
actions: none
lesson_keys: frozen-shape-collision-grep-in-plan, reserved-ticket-premise-recheck, format-before-freeze, hand-run-ticket-scripts
applied: 2026-11-06
---
## Numbers
(No `ticket:retro` script exists; counts taken by hand from the ticket files.)
- Iterations: 0 (`last_iteration: 0`; LOOP-VERIFY iteration 0, verdict PASS, receipt `d4eb6fdc…66f8`).
- Freeze: 1 acceptance file, 6 SCs frozen, 6/6 red at freeze (stub), 0 re-freezes. Hash matched at VERIFY.
- Suite at hand-off: `pnpm typecheck`, `pnpm lint` (640 files), `pnpm test` (156 files, 792 tests), `pnpm gate:planning` (56 folders), `check-hooks`: all pass.
- Checkpoints: 1. Three concerns (C-1 guarded edits, C-2 enforcement, C-3 aliased call sites) resolved together.
- Review: none (normal tier). Not run, by design: `pnpm build`, `pnpm test:db`.

## Went right
- Pickup re-derived the reserved draft's facts instead of trusting them: the line-70 claim was replayed on `862f462~1`, the acceptance-glob vs `FROZEN.json` sets were probed (they coincide), and the draft's open question (run inside a freeze step?) was closed by finding that no `ticket:freeze` script exists. Evidence: GOAL "Facts (re-derived at pickup)" and Iteration Log "proof-case replay: RED". — already is: SKILL.md Stage 1 proof-case replay (line 183) and the `reserved-ticket-premise-recheck` lesson (MF-0033, MF-0041, MF-0053 retros).
- The draft contradicted itself: it called the check at DESIGN (Stage 2) but read `## Symbols changed` only from LOOP-PLAN.md, which does not exist yet at that point. This was caught at DESIGN and fixed as SC-6 (read GOAL.md and LOOP-PLAN.md, union), with the reason in "Decided without a question". Cost: zero iterations and zero re-freezes. — already is: Decided-without-a-question table; the fix itself is now in SKILL.md Stage 2 item 6.
- The lint error (a test helper named `escape` shadowing a global) was found and fixed before the hash was written, so there was no re-freeze. — already is: SKILL.md line 278 ("Before FREEZE, format and lint the acceptance files you wrote").
- SC-1 was built as a replay of the MF-0032 miss from the real `862f462~1` text, in a temp repo through `MF_ROOT`. The red-to-green at freeze therefore tests the original failure rather than a synthetic one. Precedent shape MF-0053 (pure lib plus CLI plus `src/test/__tests__` acceptance test) was reused without re-discovery. — already is: LOOP-PLAN "Discovery" names it, and MF-0053's retro.
- Fail-loud design: a missing or malformed `## Symbols changed` is exit 2, and only `- none` passes. This avoids a silent green on plans that skip the section. — already is: SC-5.
- Closes the loop for `frozen-shape-collision-grep-in-plan` (5 prior retro hits, last MF-0032): the hand grep is now `pnpm ticket:collisions <ID>` at Stage 2 item 6 and Stage 3a.

## Went wrong
- Nothing that cost an iteration or a re-freeze. The two slips (the `escape` lint shadow and the DESIGN-vs-PLAN source mismatch in the draft) were caught before they became rework.
- Residual gap, not a defect: the check is a command the skill tells you to run (prose), not a gate. That was the user's call at C-2 ("command only"), so it is not a finding.

## Actions (at most two)
None. `causes: none` / `actions: none`. The orchestrator can set `applied:` straight away.

## Not worth changing
- Lint shadowing in a frozen-test helper: once, caught before hashing by the existing pre-freeze lint rule. Do not add another line.
- The draft reading from LOOP-PLAN only while calling at DESIGN: caught within the same stage at no cost. It falls under `reserved-ticket-premise-recheck`; a new rule would duplicate it.
- No `ticket:retro` script: this is already the `hand-run-ticket-scripts` lesson. Do not draft a gate from one more data point here. Re-count at the next `--across` run.
- Aliased call sites (`import { x as y }`) go unflagged beyond the import line: accepted at C-3 and documented in SKILL.md Stage 3a and in the evidence file.
- Token usage: no metrics available. The ticket was small (two new scripts, one test file, two skill hunks) and finished in one iteration, so there is nothing to attribute.

## Applied

2026-11-06: nothing to apply (`actions: none`). No memory, skill or gate change; nothing held.
