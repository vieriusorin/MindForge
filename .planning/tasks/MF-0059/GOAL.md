---
ticket_id: MF-0059
title: "Groups follow a path: joining a group enrolls you in its path"
tier: high-risk                   # group model, RLS, possibly figures over other members' data
stage: intake
branch: MF-0059
builds_on: [MF-0058]
last_iteration: 0
goal_status: reserved             # split out of MF-0058 on 2026-11-06; built after MF-0058
---

> Split out of MF-0058 on 2026-11-06. The user's answer to "should a group follow a path?" was "yes, we assume that
> if you enter a group you expect to follow a path, there can be discussions and so on".

## Objective

**Today.** A group follows one pack (`public.groups.pack_slug`). Its heatmap, expedition and review membership all key
on that pack. MF-0058 adds per-learner paths, but a group knows nothing about them.

**End state.** A group can follow a path. Joining it means the member is following that path: they are enrolled
(MF-0058 `path_enrollments`) on join, and the group page shows the path and the group's current course. Discussion
around the path is a later step, but the model leaves room for it.

## Open questions (all user-owned; re-derive facts at pickup)

1. Does a path replace `groups.pack_slug`, or sit beside it, with the pack becoming "the group's current course"? Who
   moves the group to the next course: the admin, or automatically?
2. Do existing groups (one pack each) migrate to a path, or stay pack-only?
3. On join: enroll automatically, or prompt with the join? On leaving the group: keep the enrollment (the
   recommendation, since it is the learner's own) or remove it?
4. Is any group-level path figure shown (for example how many members completed course n)? If yes, it's a figure
   over other members' data, and the MF-0011/MF-0021 privacy rules apply: a threshold that excludes the viewer, no
   counts, viewer invariance, and join/leave tenure.
5. "Discussions": what is the smallest thing wanted (a link per course to an external chat, a comment thread per
   course)? Probably its own ticket.

## Out of Scope (until answered)

- Any per-member path status visible to other members.
title: Retrofit key-length tells in ccdv-f, prod-prompting, platform-foundations
tier: normal                      # content work: re-grounded option rewrites; no app code, no DB schema
stage: intake
branch:
builds_on: [MF-0044]
last_iteration: 0
goal_status: reserved             # reserved by MF-0044 (user decision C-3); never built automatically
---

> Reserved 2026-11-06 from MF-0044 (user decision C-3 at the DESIGN checkpoint). Not started.

## Objective

**Today.** MF-0044's key-length rule (`pnpm check:packs`: a `select: 1` key ≥ 1.15× its longest distractor, in
characters) skips three grandfathered packs. A read-only probe on 2026-11-06 found 70 hits in them: ccdv-f 40 of 48,
prod-prompting 28 of 54, platform-foundations 2 of 54 (`D1.S1.q4`, `D4.S1.q2`).

**End state (draft).** Every flagged question is rewritten so the key no longer stands out by length (shorten the key
or lengthen the distractors, re-grounded in the cited source per the course-pack brief), the three slugs are removed
from MF-0044's grandfather set, and `pnpm check:packs` still exits 0.

## Open questions (re-derive at pickup)

- One ticket or one per pack (ccdv-f is the exam pack; rewrites change content hashes, so in-flight attempts on old
  versions are voided per MF-0032).
- Re-run the probe at pickup: counts move as packs change.
