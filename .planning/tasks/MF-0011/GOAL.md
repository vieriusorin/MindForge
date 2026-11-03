---
ticket_id: MF-0011
tier: high-risk                   # cross-user read through SECURITY DEFINER; privacy of learners
stage: design
branch: main
builds_on: []
last_iteration: 0
goal_status: reserved
track: S                          # seat Coder E
week: W2
depends_on: [MF-0006]             # review filters via the getReviewContext seam
---

> Drafted 2026-11-03 from the planning grill (Q5). SCs are proposals; the claimant confirms and freezes them.

## Objective

Today a group page shows only the viewer's own forest; nobody can see where the group as a whole is
weak (MINDFORGE §1.1, "learn together").

End state: the group page shows a **group heatmap**: per region, the members' average retrievability
and the share of healthy trees, plus the member avatars. It appears only when at least 3 members have
attempts. No individual forest, score or attempt of another member is ever readable.

## Affected

- **Roles:** group member (sees the aggregate), group admin (same view).
- **Surfaces:** a `private` SECURITY DEFINER aggregate function exposed through a narrow public RPC; `src/server/groups/**`; `src/features/groups/**` (heatmap card); `src/app/(app)/groups/[groupId]/page.tsx`.

## Constraints

- Terms: Group heatmap (CONTEXT.md). Aggregates only; minimum 3 contributing members, else "not enough data yet".
- Memory is computed by the engine replay (MF-0003), not re-implemented in SQL. If the aggregate must be computed server-side in TS, the cross-user read happens inside one server-only service that returns aggregates only.
- Revoke-all-first; `auth.uid()` must be a member of the group; grants gate stays green.
- Heatmap colour is never the only signal: each region shows words and a number (ui-design §5).

## Decided without a question

- Visibility rule = aggregate only, ≥ 3 members, avatars list; individual sharing after Dec 7 (Q5).
- Attempt filters from MF-0007 (rejected, spoiled) apply to the aggregate too.

## Success Criteria

- [ ] SC-1: A non-member calling the aggregate for G1 gets an error or nothing. Proof: DB acceptance test with real tokens.
- [ ] SC-2: With 2 members having attempts the result is "not enough data"; with 3 it returns per-region figures and nothing per member. Proof: DB/service test.
- [ ] SC-3: No API path returns another member's attempts or per-skill memory (attempt RLS unchanged, verified). Proof: DB test.
- [ ] SC-4: Figures equal the mean of each member's engine replay for the same fixtures (calculation parity). Proof: test comparing service output with engine output.
- [ ] SC-5: The group page shows the heatmap with region names, numbers and a legend, plus member avatars. Proof: browser with 3 users.
- [ ] SC-6: Advisors clean, grants gate green, component split, typecheck, lint, build. Proof: receipt.

## Concerns

| # | Collision | Owner | Status |
|---|-----------|-------|--------|
| C-1 | Replaying every member's attempts per page view: fine at 6 members × hundreds of attempts; if slow, cache per group with a short `cacheLife` and tag on new attempts (nextjs-data skill: aggregates are not per-user PII, but confirm). | Coder E | open |

## Out of Scope

- Individual forest sharing, leaderboards, Expedition (MF-0017).

## Open questions

- none.

## Iteration Log

<!-- append-only -->
