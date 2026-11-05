---
ticket: MF-0033
outcome: pass
causes: wrong-plan
actions: skill-edit
applied: 2026-11-05
lesson_keys: draft-rule-vs-own-proof-case, new-check-reviews-shipped-content, reserved-ticket-premise-recheck, proof-case-replay-before-freeze
---
## Numbers
(no `ticket:retro` script; read from GOAL.md and the diff)
- Iterations of rework: 0. Build T1 (checker 7/7 green) -> T2 (wiring, first run 7 problems) -> T3 (2 fixes + 4 `# framing:`, 0 problems).
- TEST: typecheck 0, lint clean, 652/652 (645 before), frozen hash OK, receipt DONE @ 62ad9ef7266d.
- Dry run of the drafted rules over shipped content: 50 hits over 312 checkable items, about 2 real (precision about 4%).
- Coverage: 178 of 490 items cite no cached page, 42 cite at least one uncached page.
- Diff: 7 tracked files (+154/-9), plus the new `scripts/lib/item-grounding.mjs` and the acceptance test.

## Went right
- A read-only dry run of the drafted rule set at pickup, before any freeze, measured precision (4%), found that one proof case cannot go RED, and found the coverage hole. The user narrowed the scope at a checkpoint, so no acceptance test was frozen on a rule that would have been dropped. Evidence: GOAL.md "Dry run" and "Decided by the user", then 0 rework iterations. Keep: already is `gsd-goal-loop/SKILL.md:142` (proof-case replay before FROZEN.json) and the MF-0037 "run read-only before building" open question. This ticket is the second time it paid off.
- The dry run found a real cross-page leak in shipped content (`ccdv-f.D5.S1.q2`, `bee-agent-loop` node E) and the user got a measured "fix now" decision (C-1). Keep: already is SKILL.md Stage 3 ("the first run of a new check reviews shipped content").
- Allow-list as YAML comments, which stay outside `contentHash`, so annotations reset no reviews. This was checked against `scripts/lib/content-hash.mjs` rather than assumed. Keep: already is in GOAL.md "Decided without a question"; no new rule needed.
- SC-3 makes an uncached item a counted skip, never a silent pass. Keep: already is in the script summary output.

## Went wrong
- The MF-0031 retro reserved this gate with a yield claim ("about 8 of 19") that no one had measured. The MF-0037 retro showed 0 of 22 and added a "dry-run before building" caveat only inside the reserved ticket's Open questions. The claim sat in a reserved GOAL for a day and the pickup session had to re-derive it. Cause: wrong-plan (the gate ticket's premise was drafted unmeasured). Cost was small, because the pickup dry run caught it before the freeze.
- Rule wording and its own proof case disagreed: the D3.S3.q5 "never carry retry-after" case could not go RED, because the cited page says "never" too (the same trap as MF-0036, lesson key `draft-rule-vs-own-proof-case`). The replay caught it at DESIGN, so this was cheap, but the drafting step produced it.

## Actions (at most two)
1. skill-edit: `.claude/skills/gsd-goal-loop/references/retro.md`, the `gate` row of the apply-policy table (line 40). Append to that row's interactive-session cell: "; state the measured hit count and the number of real defects from a read-only run over shipped content in the reserved GOAL, or write `yield: unmeasured` and list the unmeasured figure as the first thing the pickup session checks. Never put a predicted yield in the Objective." Would have saved: the MF-0031-to-MF-0033 round trip, where a reserved ticket carried an unverified "about 8 of 19" claim until pickup. It would also have flagged the draft as unmeasured at reservation time.

## Not worth changing
- 36% of items cite uncached pages, so the new rules skip them. This is a corpus-cache coverage fact, not a process bug. The skip counter makes it visible. A follow-up to cache more `support.claude.com` and `agent-sdk/*` pages is a pack-owner decision.
- Quantifier class dropped and the "any term on a sibling page" variant dropped. Both are recorded in GOAL.md; nothing further.
- The 2-item review reset (C-1) was accepted by the user.
- No memory change. Checked `MEMORY.md` (ticket sequencing, Windows dev environment); neither covers this, and the lesson belongs in the skill, not in a per-session memory line.

## Applied
- Action 1 (skill-edit, additive) applied to `.claude/skills/gsd-goal-loop/references/retro.md`, the `gate` row of
  the apply-policy table: a reserved gate states its measured yield or `yield: unmeasured`, and never puts a
  predicted yield in the Objective.
- Held: nothing. Memory: no change.
