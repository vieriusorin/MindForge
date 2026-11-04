---
ticket_id: MF-0030
tier: normal                      # offline dev tooling; reuses MF-0008/MF-0014 CLIs
stage: intake
branch: main
builds_on: [MF-0008, MF-0014, MF-0018]
last_iteration: 0
goal_status: reserved
---

> Requested 2026-11-04 by the user, drafted from MF-0014's session.

## Objective

**Today.** The corpus is fetched by hand (`pnpm generate:corpus`), and generating all content means running
three CLIs in the right order (diagrams before cards) with the cost guard in mind.

**End state.**
1. `pnpm dev:setup --with-corpus` also fetches the public docs into `.cache/corpus/` (free, no key, needs network).
2. `pnpm content:all` runs corpus → diagrams → cards → questions in that order. It defaults to `--dry-run`
   (plan + estimated cost, no key) and needs an explicit `--run` to spend money; every batch keeps the
   `MF_MAX_BATCH_USD` guard. Never called by setup or CI.

## Constraints

- `prompts:lock` is never run automatically (it would re-lock an edited prompt and hide a missing version bump).
- Paid runs stay the user's (MF-0022); this ticket proves only the dry-run path offline.

## Open questions

- Should `--run` stop after the first step whose estimate exceeds the cap, or run per domain automatically?
