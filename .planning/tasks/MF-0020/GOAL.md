---
ticket_id: MF-0020
tier: normal                      # a manual run on hosted infra; no code
stage: intake
branch: main
builds_on: [MF-0004, MF-0010]
last_iteration: 0
goal_status: reserved
owner: user
week: W2
depends_on: [MF-0004, MF-0010]
---

> Reserved 2026-11-04 from MF-0010 C-2 (user decision): the hosted release gate is not a code SC.

## Objective

Release gate (ROADMAP §4, Nov 15): a colleague who has never seen the app joins from an invite on the
hosted URL, plants 3 seeds, wins a Scenario Duel, and sees their trees grow.

## Deliverable

A runbook (extend `docs/runbook/deploy.md`) and one recorded run on production: screenshots + the
attempt rows for the colleague's account.

## Preconditions (checked 2026-11-04, read-only)

- No hosted MindForge project yet: `vercel project ls` lists none; `supabase projects list` lists only
  `p4t-staging`. MF-0004's manual deploy steps must run first.
- MF-0010 merged on `main` (Seed Planting).
- Carried from MF-0010 C-1 (owner Coder F): H-2 delivers ≥ 3 nature cards by Nov 13, so the 3 planted
  seeds show a card.

## Success Criteria (proposed)

- [ ] SC-1: the gate above passes on the hosted URL. Proof: browser on production + DB read-back.
