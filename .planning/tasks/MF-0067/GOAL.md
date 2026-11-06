---
ticket_id: MF-0067
title: "Retry-safe answers: idempotency key on record_attempt (slice F)"
tier: high-risk                   # SECURITY DEFINER function signature, grants test re-freeze
stage: intake
branch:
builds_on: [MF-0062]
last_iteration: 0
goal_status: reserved             # reserved by MF-0062 (council split, user decision D-1); picked up with /gsd-goal-loop MF-0067
---

> Reserved 2026-11-06 from MF-0062 (learning-path council, split slice). Decisions D-1..D-6 and findings live in
> `.planning/tasks/MF-0062/GOAL.md`; re-derive each fact at pickup (`## Facts`) before asking the user.

## Objective (draft)

Today a retried request writes two attempts and the replay counts two FSRS reviews. Add a client attempt id with a unique (user_id, client_attempt_id) constraint; a repeat returns the first result. New signature replaces the old one (MF-0032 pattern). No session or telemetry tables (user decision D-5).

## Iteration Log

<!-- append-only -->
- 2026-11-06 reserved from MF-0062.
