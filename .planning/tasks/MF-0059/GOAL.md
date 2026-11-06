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
