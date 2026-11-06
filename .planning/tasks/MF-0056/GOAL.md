---
ticket_id: MF-0056
title: gate:planning rejects a hand-off ticket with no LOOP-VERIFY.md / FROZEN.json
tier: high-risk                   # a gate script (MF-0055 retro: gates are high-risk)
stage: intake
builds_on: [MF-0053, MF-0055]
last_iteration: 0
goal_status: reserved
---

> Reserved 2026-11-06 by the MF-0055 retro (gate action). Not built; a hypothesis until re-derived at pickup.

## Objective

**Today.** `pnpm gate:planning` checks GOAL front matter, the design-preflight line (MF-0053) and the evidence's
"See it yourself" heading (MF-0055). It does not check which records a hand-off folder holds: MF-0055 reached
`complete-pending-manual-commit` with only GOAL.md (no LOOP-VERIFY.md, no FROZEN.json, no RETRO until close-out), and the
gate printed `ok`.

**End state (draft).** A new check beside `checkSeeItYourself` in `scripts/lib/planning-check.mjs`, wired in
`scripts/check-planning.mjs`: a ticket after a cutoff (draft: MF-0055) with `goal_status: complete-pending-manual-commit`
and tier normal or high-risk fails without `LOOP-VERIFY.md`; for high-risk, also without `FROZEN.json` and `REVIEW.md`.

## Open questions (re-derive at pickup, before asking)

- Yield: a read-only pass over all ticket folders: how many at hand-off or complete lack LOOP-VERIFY.md / FROZEN.json? It decides the cutoff.
- Does `ticket-traceability` (lines ~41-43) let a normal-tier ticket skip FROZEN.json? If so, require FROZEN.json only for high-risk.
- Proof case to replay read-only: MF-0055's folder as handed off (GOAL.md + evidence only) must turn RED.
