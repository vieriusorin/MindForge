---
ticket_id: MF-0069
title: "Plan lint: a plan that adds or changes a parser must carry an accepted grammar and a rejected-inputs table"
tier: high-risk                   # a gate script
stage: intake
branch:
builds_on: [MF-0048]
last_iteration: 0
goal_status: reserved             # RETRO gate action; never built automatically
---

> Reserved 2026-11-06 from MF-0048 RETRO (action 1, gate). Third occurrence of lesson `gate-parser-fail-closed`
> (MF-0043, MF-0046, MF-0048). Built only when the user picks it up.

## Objective

**Today.** `verification.md` §4 says gate parsers fail closed by an allowlist and that exemptions skip only their own
rule, and the LOOP-PLAN template now has a `## Parsers` section (MF-0048 retro). Both are prose. MF-0048 still shipped
its secondary `owns` parser as a blocklist with the main-session exemption before the syntax check (review B1, B2).

**End state (draft, for DESIGN).** `pnpm ticket:plan-lint <ID>` (`scripts/ticket-plan-lint.mjs`, pure core in
`scripts/lib/`) fails when a LOOP-PLAN whose planned files touch `scripts/`, `.claude/hooks/` or `src/engine/` and
whose path or plan text matches `/pars(e|er)|check-|gate|exempt|allowlist|grandfather/i` lacks a `## Parsers` section.
The check also fails when a parser block has no `Accepted grammar` line, a `Rejected inputs` table under 3 rows, or no
`Exempt-path test` row. It fails closed on its own input. It may also call `validatePlan` (MF-0048), which nothing
runs today.

## Open questions

- Q-1 (user): coordinate with MF-0060 (another contributor wires `validatePlan` into `gate:planning`). Should this
  lint live there too?
- Q-2: proof case. The MF-0048 LOOP-PLAN as frozen before review (no Parsers section) must turn it RED.
