---
ticket_id: MF-0080
title: "ticket:* CLIs: wire ticket:verify, ticket:freeze, ticket:eval and ticket:retro over scripts/lib"
tier: high-risk                   # gate scripts + receipts (HIGH_RISK binding)
stage: intake
branch:
builds_on: [MF-0051]
last_iteration: 0
goal_status: reserved             # owner: user (scope and order of the four CLIs)
---

> Reserved 2026-11-09 from MF-0051 (user decision Q-1: check + fix text now, build the CLIs later).

## Objective

**Today.** `scripts/lib/ticket-receipts.mjs`, `ticket-eval.mjs` and `ticket-retro.mjs` (~1,300 lines, pure) exist,
but no CLI or `package.json` script ever wired them: `git log -S'"ticket:verify"' -- package.json` is empty. The
gsd-goal-loop skill runs its VERIFY / FREEZE / EVAL / RETRO_FACTS defaults by hand, and MF-0051 rewrote the
hook and agent text that named `pnpm ticket:verify|freeze|eval|retro` to describe those manual steps.

**End state.** `pnpm ticket:verify <ID> [--status|--full]`, `pnpm ticket:freeze <ID> <file>…`,
`pnpm ticket:eval <ID>` and `pnpm ticket:retro <ID> [--across]` exist, each a thin CLI over its lib, and the
hook and agent text names them again (the MF-0051 `check-hooks` rule then accepts it).

## Open questions

- Q-1 (owner: user): all four in one ticket, or one per CLI (retro and eval are reads; verify and freeze write
  receipts and FROZEN.json)?
- At pickup: re-derive each lib's expected inputs (`.planning/evidence/<ID>.receipts.jsonl`, session metrics) from
  the code, since they were imported from another project and never ran here.
