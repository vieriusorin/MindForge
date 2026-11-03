---
ticket_id: MF-0017
tier: high-risk                   # new table + cross-member aggregate
stage: design
branch: main
builds_on: []
last_iteration: 0
goal_status: reserved
track: S                          # seat Coder E
week: W4 (stretch: only if W3 is green; after MF-0016)
depends_on: [MF-0006]             # count goal only; no dependency on the heatmap
---

> Drafted 2026-11-03 from the planning grill (Q5, Q14). Stretch scope. SCs are proposals; the claimant
> confirms and freezes them.

## Objective

Groups can see their weak regions (MF-0011) but have no shared goal to act on.

End state: **Group Expedition.** A group admin starts a weekly goal ("Together, bring Security &
Safety to 80% healthy" or "Together, make 200 correct recalls in Security"); every member's correct
recalls in that region count; the group page shows one shared progress bar and the deadline. Only the
group total is shown.

## Affected

- **Roles:** group admin (starts), group member (contributes, sees total).
- **Surfaces:** table `expeditions`, a `private` aggregate RPC; `src/engine/expedition/` (progress); `src/features/groups/**` (expedition card).

## Constraints

- Group totals only; no per-member contribution shown (Q5).
- Progress counts only measured recalls (correct attempts, filters from MF-0007); nothing for time or clicks.
- Revoke-all-first, `auth.uid()` membership check, grants gate; migrations follow the parallel rule (ROADMAP §4).

## Decided without a question

- One active expedition per group; 7-day window; one goal kind: correct-recall count in a domain. (A "healthy share" goal would depend on MF-0011; after Dec 7.)

## Success Criteria

- [ ] SC-1: Only the group admin can start an expedition; a second active one is refused. Proof: DB acceptance test.
- [ ] SC-2: Progress = correct attempts by members in the domain within the window, excluding attempts the review context excludes. Proof: DB/service test.
- [ ] SC-3: Non-members can't read it; no per-member numbers are returned. Proof: DB test.
- [ ] SC-4: The group page shows the goal, progress with words and number, and time left. Proof: browser with 3 users.
- [ ] SC-5: Advisors, grants gate, component split, typecheck, lint, build. Proof: receipt.

## Concerns

- none.

## Out of Scope

- Rewards, cross-group competitions, notifications.

## Open questions

- none.

## Iteration Log

<!-- append-only -->
