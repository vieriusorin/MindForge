---
applied: 2026-11-05
ticket: MF-0021
outcome: pass
causes: known-trap-repeated, missing-context
actions: skill-edit
lesson_keys: aggregate-threshold-inference, viewer-controlled-input-two-load, design-preflight-sc-preconditions, hand-run-ticket-scripts
---
## Numbers
(`node scripts/lib/ticket-retro.mjs MF-0021` printed nothing and exits 0; `pnpm ticket:retro` does not exist. Figures are from the task files.)
- tier high-risk, iterations 2 (`last_iteration: 2`), goal_status complete-pending-manual-commit
- freeze: 3 acceptance files frozen; MF-0011's engine acceptance file re-frozen twice (it-1 for bands, it-2 for others-only), both user-approved
- receipts: it-1 on 0745fa63 superseded; it-2 on 7c029c7b: typecheck 0, lint 542 files clean, test 121 files / 528 tests, build 0; test:db 7 red, all in `mf-0013-storms.db.acceptance.test.ts`, pre-existing and reproduced on the stashed tree
- review: fresh-context reviewer ran twice. It-1 changes-requested with 1 blocking finding (two-load inference, C-4); it-2 approve
- user questions: 4 at DESIGN plus 1 after review (C-4). The C-4 question and the second re-freeze are the cost of this ticket's miss
- tokens: no session metrics in the files, no claim

## Went right
- The non-vacuity probe at DESIGN: a probe over N 3-30 and 1-6 skills showed the rejected 5-bucket scheme could not reach every bucket at N = 3, so SC-3's enumeration failed for it and passed for the 3-band rule (LOOP-VERIFY "Non-vacuity"). It also widened the problem past single-skill regions before any code. -- keep: already is: `gsd-goal-loop` SKILL.md Stage 2 ("probe library behaviour before the oracle", "figure-edge-input-table").
- The it-1 SC-3 test failed red for the SC's own reason, including the line that compared 75 % with 80 % (the leak itself). -- keep: already is: RED stage, "run red twice".
- The fresh-context reviewer found the blocking inference by enumerating attacks with bands only, named the exact line (`group-heatmap.ts:83-84`, `viewer.size > 0 ? [viewer, ...others] : others`), proposed the fix and said why the user had to decide (it reverses an MF-0011 user decision). It-2 then re-ran the enumeration and approved on a recomputed hash. -- keep: already is: Stage 4 fresh-context review.
- The fix was test-first: SC-7 `mf-0021-viewer-excluded.acceptance.test.ts` was frozen red (2 red) before the engine changed. The review's residual (collusion or a second account) was left "flagged for the user, NOT accepted on their behalf". -- keep: already is: escalation.md.

## Went wrong
- Iteration 1 shipped a privacy proof that covered only a single snapshot. SC-3 enumerated "bands reachable for every N", and GOAL "Constraints -> how met" listed (a) "the gate counts contributors OTHER than the viewer". Yet the engine still pooled the viewer's own row into the figures (`contributors = viewer.size > 0 ? [viewer, ...others] : others`, inherited from MF-0011). The viewer controls that row. Two loads around the viewer's own first answer pinned N (REVIEW it-1, Attacks A and B; GOAL C-4). Cost: a second user question, SC-7, a second re-freeze of MF-0011's file, an engine change, UI copy and CONTEXT.md changes (about half of it-2). cause: known-trap-repeated. MF-0011's retro action (applied 2026-11-04, `gsd-goal-loop` SKILL.md Stage 2, "viewer can deduce" paragraph) already told the session to ask what the viewer can deduce. That paragraph's (a) was worded about the gate threshold only. It did not say that the figures themselves must not depend on any input the viewer controls, so a ticket that obeyed it to the letter still passed. The same family was missed in MF-0011 (single snapshot with a viewer-included threshold) and here (two loads with a viewer-included pool).
- The ticket inherited MF-0011's user decision "the figures pool every contributor, the viewer included" (MF-0011 GOAL:60-61) as settled and never re-opened it, although this ticket's own objective is that no figure reveals how many members played. A precedent decision made under a weaker privacy goal was treated as a constraint. cause: missing-context (nothing in the DESIGN step says to re-test a precedent's decision against the new ticket's stronger objective).
- Minor: 7 pre-existing storm DB reds were carried through both iterations; proven pre-existing by stashing, so no iteration was lost. Not a MF-0021 cause.

## Actions (at most two)
1. skill-edit: `/Users/sorinvieriu/Projects/mind-forge/.claude/skills/gsd-goal-loop/SKILL.md`, Stage 2 DESIGN, the paragraph starting "Any SC that shows a figure, rank or flag computed over other people's data". Keep it in place and append this after its last sentence (which ends "...only the fresh-context reviewer caught it)."):
   > Single-snapshot reachability is not a privacy proof. (d) The figures must not depend on any input the viewer controls: their own row, answers or attempts, a join or leave. The viewer can change those between two loads and difference the result, so the pool and the threshold both exclude the viewer, and the SC says so. Every such SC carries a viewer-invariance test: fix the other members, vary the viewer (no memory, a first answer in another region, healthy everywhere) and assert the output is deep-equal. A decision inherited from a precedent ticket ("the viewer is pooled in") is re-tested against this ticket's objective before it is copied into "Constraints -> how met" (MF-0011 retro: threshold included the viewer; MF-0021 retro: pool included the viewer, found at review after the SC-3 enumeration passed). Name the residual that survives (collusion or a second account changing their own row between loads) in Concerns for the user; do not accept it on their behalf.
   Would have saved: the C-4 user question, SC-7 plus the second MF-0011 re-freeze, and the engine/UI/CONTEXT rework (about half of iteration 2).

(No second action. A static gate cannot see which input a figure depends on, and the MF-0011 retro already put the rule into the skill. The fix is a sharper rule in the same place, not a new line elsewhere.)

## Not worth changing
- The 7 `mf-0013-storms` DB reds: pre-existing, proven on the unchanged tree, owned by that ticket's work. Covered by the `ci-red-unobserved` lesson.
- `ticket:verify` / `ticket:freeze` / `ticket:retro` scripts absent and run by hand: already the `hand-run-ticket-scripts` lesson (MF-0003).
- Residual collusion or second-account two-load inference after the fix: a product and privacy decision (a larger gate or noise). It is flagged for the user at hand-off, not a process defect.
- C-3 universal facts at the minimum group size (all or none healthy, "no data"): accepted out of scope by the user twice.
- Reviewer note that the viewer's attempts are still fetched then dropped: a read of the viewer's own data, not a leak. A cleanup, no pattern.
- Tokens: no metrics in the files; the ticket was large (engine, UI, two re-freezes, two reviews).

## Applied

- 2026-11-05: action 1 (skill-edit, additive) applied to `.claude/skills/gsd-goal-loop/SKILL.md` Stage 2, appended after the MF-0011 privacy paragraph. Nothing held.
