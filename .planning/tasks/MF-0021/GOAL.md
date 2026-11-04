---
ticket_id: MF-0021
tier: high-risk                   # learner privacy (group heatmap)
stage: intake
branch: main
builds_on: [MF-0011]
last_iteration: 0
goal_status: reserved
track: S
week: W3
depends_on: [MF-0011]
---

> Reserved 2026-11-04 from the MF-0011 review (residual of concern C-3, accepted by the user for v1).

## Objective

Today the group heatmap shows no member count, but in groups of 5 or more the count can be worked out
from the figures. In a single-skill region (ccdv-f D3, D4), healthy share = healthy members ÷ members who
have played, so 25/50/75 % in a 5-person group means 4 have played, and therefore that one named member
hasn't. Only 0 % and 100 % hide the count. This leaks who has played, never anyone's memory.

End state: the figures shown for a region don't reveal how many members have played, for example by
showing single-skill regions (or every region) as a shade bucket only.

## Open questions

- Which coarsening: bucket only for regions with fewer than N skills, or for every region? Does the
  average recall need the same treatment?
- Is the residual "100 % in a single-skill region means every member's tree there is healthy" in scope?

## Evidence

- `.planning/tasks/MF-0011/REVIEW.md` (iteration 2, note 1); `src/engine/forest/group-heatmap.ts`.
