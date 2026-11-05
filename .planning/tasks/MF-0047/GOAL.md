---
ticket_id: MF-0047
tier: normal
stage: intake
branch: main
builds_on: [MF-0022]
last_iteration: 0
goal_status: reserved             # owner: user (December API budget)
depends_on: [MF-0022]
---

> Reserved 2026-11-05 from MF-0022 (user decision C-1: stop at $100/month). Holds the pack-domain
> question batches MF-0022 did not reach this month. MF-0022's hand-off lists them exactly.

## Objective

Run the remaining `pnpm generate:questions` pack-domain batches with the proven MF-0022 pipeline
(same prompts, same eval bar), each under `MF_MAX_BATCH_USD`, and land the survivors for review.
