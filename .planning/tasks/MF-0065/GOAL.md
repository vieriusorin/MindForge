---
ticket_id: MF-0065
title: "Confidence-graded recall, misconception tags and smarter next question (slice D)"
tier: high-risk                   # attempts column, record_attempt signature, FSRS grading change (new ADR)
stage: intake
branch:
builds_on: [MF-0062, MF-0064, MF-0067]
last_iteration: 0
goal_status: reserved             # reserved by MF-0062 (council split, user decision D-1); picked up with /gsd-goal-loop MF-0065
---

> Reserved 2026-11-06 from MF-0062 (learning-path council, split slice). Decisions D-1..D-6 and findings live in
> `.planning/tasks/MF-0062/GOAL.md`; re-derive each fact at pickup (`## Facts`) before asking the user.

## Objective (draft)

Sure/unsure tap before reveal stored on attempts and mapped to FSRS (correct+sure Good, correct+unsure Hard, wrong Again; wrong+sure adds a review within 24 h), recorded in a new ADR beside ADR 0005. Distractors tagged with misconception ids in pack files (reviewed); `chosen` read by a pure engine tally. Next item in a skill: last wrong, then unseen, then least recent; interleave confusable skills. No group figure from confidence.

## Iteration Log

<!-- append-only -->
- 2026-11-06 reserved from MF-0062.
