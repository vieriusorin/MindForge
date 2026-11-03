---
ticket_id: MF-0009
tier: normal                      # engine selection + UI; reuses MF-0003 grading, no schema
stage: design
branch: main
builds_on: []
last_iteration: 0
goal_status: reserved
track: G                          # seat Coder C
week: W2
depends_on: [Phase 0]
independent: true                # playable filter via MF-0006 seam; MF-0010 embeds its seed step later
---

> Drafted 2026-11-03 from the planning grill (Q11). SCs are proposals; the claimant confirms and freezes them.

## Objective

Today a learner has to choose the Duel and gets 5 questions picked by weight; nothing tells them
"these trees need water today", which is the core habit of the product (MINDFORGE §2.2).

End state: `/today` has one main action, "Start today's walk", showing how many trees need water.
The walk serves up to 10 questions: wilting trees first, then at most one new skill as an inline
Seed Planting step, then the weakest skills not yet due. It ends early with "Your forest is healthy
today" when nothing is due.

## Affected

- **Roles:** learner.
- **Surfaces:** `src/engine/memory/` (walk selection), `src/features/walk/**`, `src/app/(app)/today/page.tsx`, `src/app/(app)/play/[packSlug]/walk/page.tsx`, briefing banner on the dashboard.

## Constraints

- Every figure (trees due, session plan) comes from the engine; no arithmetic in components (ui-design §3.7).
- Answers go through the existing `record_attempt`; the key never reaches the browser before answering.
- Serves only playable items (CONTEXT.md); unreviewed shows a badge.

## Decided without a question

- Walk = up to 10 questions. Order: wilting (R < 0.85) ranked by weight × (1 − R); then ≤ 1 new skill; then weakest not-due. Repeat walks allowed; no streak or bonus (Q11).
- After each answer: feedback with every option's rationale, as in the Duel.
- Until MF-0010 lands, the "new skill" slot is a plain question from that skill.

## Success Criteria

- [ ] SC-1: `planWalk(memory, questions, now)` returns wilting skills first by weight × (1 − R), ≤ 1 unseen skill, total ≤ 10, and an empty plan when nothing is due and every skill is seen. Proof: engine acceptance test with fixed clock.
- [ ] SC-2: `/today` shows "Start today's walk" with the number of trees that need water, from the engine. Proof: browser.
- [ ] SC-3: A full walk on the local stack records every answer as an attempt and the forest reflects it afterwards. Proof: browser + DB row count.
- [ ] SC-4: With nothing due, the page says the forest is healthy and offers the Duel instead. Proof: browser with a fixture user.
- [ ] SC-5: Keyboard-only walk works; feedback is announced by a live region; focus moves to the next question. Proof: browser + a11y check.
- [ ] SC-6: Component-split gate, typecheck, lint, tests, build pass. Proof: receipt.

## Concerns

| # | Collision | Owner | Status |
|---|-----------|-------|--------|
| C-1 | The walk exposes a "new skill" slot that renders a plain question. Whichever of MF-0009 / MF-0010 merges **second** swaps that slot for the Seed Planting component (a few lines). | Coder C + Coder D | resolved 2026-11-03 |

## Out of Scope

- Notifications, streaks, time-of-day reminders.

## Open questions

- none.

## Iteration Log

<!-- append-only -->
