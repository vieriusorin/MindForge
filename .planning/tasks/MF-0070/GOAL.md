---
ticket_id: MF-0070
title: "gate:planning follow-ups: one owner for brace expansion, scopes for unowned trees, untrack scheduled_tasks.lock"
tier: high-risk                   # gate scripts and agent scopes
stage: intake
branch:
builds_on: [MF-0060]
last_iteration: 0
goal_status: reserved             # reserved from MF-0060 review; never built automatically
---

> Reserved 2026-11-07 from MF-0060 (fresh-context review findings 3, 5b, 11 and the builder's follow-ups). Not started.

## Objective (draft)

1. `expandOwns` in `scripts/lib/planning-check.mjs` restates `expandBraces` from `scripts/lib/ticket-eval.mjs` (incl. the
   cap 64). Export it once and import it, so `validatePlan` and the scope-fit check can never disagree on a glob.
2. Decide which role agent (if any) may own `src/dev-seed/**`, `src/content-pipeline/**`, `prompts/**`, `evals/**`,
   `paths/**` and `docs/**`; today only orchestrator tasks can. Any `SCOPES` change is widen-only (a narrowing reddens
   merged plans on main, MF-0060 review note 5b). Mirror the SCOPES line in `.claude/agents/ticket-planner.md`.
3. `.claude/scheduled_tasks.lock` is tracked; untrack and ignore it so rule 2 never flags it at hand-off.

## Open questions (user)

- Item 2: which agent gets which tree, or keep them orchestrator-only and only document it?
