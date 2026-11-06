---
ticket_id: MF-0068
title: "Seed learning-path scenarios: eight named demo learners and path groups (slice B)"
tier: high-risk                   # seed writes and deletes, re-runnable
stage: intake
branch:
builds_on: [MF-0058, MF-0062]
last_iteration: 0
goal_status: reserved             # reserved by MF-0062 (council split, user decision D-1); picked up with /gsd-goal-loop MF-0068
---

> Reserved 2026-11-06 from MF-0062 (learning-path council, split slice). Decisions D-1..D-6 and findings live in
> `.planning/tasks/MF-0062/GOAL.md`; re-derive each fact at pickup (`## Facts`) before asking the user.

## Objective (draft)

Extend `dev-seed` (not a second seeder) with personas fresh, halfway, midpath, finisher, lapsed+path, crammer+path, a
4+ member path group and a you+2 group (heatmap "not enough others"). Each persona's target state is asserted through
the engine (memoryBySkill, buildForest, isCourseComplete) before any write; new personas are appended after the
existing ones so PRNG draws don't shift; nothing path-related is seeded on the author's own account. "Halfway" needs
lesson progress, which is derived (D-4), so it is a learner with some of a skill's steps answered, not a stored row.

## Iteration Log

<!-- append-only -->
- 2026-11-06 reserved from MF-0062.
