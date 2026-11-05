---
ticket_id: MF-0053
tier: normal
stage: intake
builds_on: [MF-0052, MF-0025]
last_iteration: 0
goal_status: reserved             # created by the MF-0052 retro (gate action); never built automatically
---

> Drafted 2026-11-05 by the MF-0052 retro (cause: known-trap-repeated). Not started.

## Objective

**Today.** The gsd-goal-loop DESIGN preflight says to run every command an SC names as its proof (`pnpm test:db`,
`pnpm build`, `pnpm check:packs`) before the checkpoint. MF-0025 and MF-0052 both skipped `pnpm test:db`, and the same
`mf-0013-storms` red surfaced only in TEST (MF-0052: a plan amendment and a user-approved re-freeze). Prose has failed twice.

**End state.** `pnpm gate:planning` (`scripts/check-planning.mjs` → pure `scripts/lib/planning-check.mjs`, already in the
Stop gate and CI) fails a GOAL.md whose Success Criteria name a `pnpm <script>` that its Iteration Log's "design preflight"
line does not mention.

## Proposed rule (from MF-0052 RETRO.md)

- Scope: GOAL.md with `goal_status` not `reserved` and folder sorting after `MF-0052` (no retroactive flags).
- Collect every `pnpm <script>` named in `## Success Criteria`; the Iteration Log line containing "design preflight" must
  mention each, or say `not run: <reason>` for it. Message: `MF-XXXX: design preflight does not mention pnpm test:db, named by an SC`.
- Also flag a ticket with `stage` past `design` and no "design preflight" line.
- Proof cases (replay read-only before freezing): MF-0052 (SC-10 names `test:db` and `build`; preflight line names neither)
  and MF-0025 (SC-6).

## Open questions

- Gate scripts are guarded (`.claude/rules`, hooks): the user approves the change to `planning-check.mjs` at pickup.
