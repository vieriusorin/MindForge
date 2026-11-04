---
ticket_id: MF-0025
tier: normal
stage: intake
builds_on: [MF-0003, MF-0004, MF-0012]
last_iteration: 0
goal_status: reserved
---

> Drafted 2026-11-04 by MF-0012 (user decision C-3), from the MF-0003 review note "orphaned keys".
> Not started.

## Objective

**Today.** `scripts/sync-question-keys.mjs` deletes stale `question_keys` / `items` rows only for packs
whose folder still exists. When a pack folder is removed, its slug leaves `private.packs` but its keys
and item rows stay.

**End state.** The sync removes keys and items of unregistered packs in the same transaction as the
registry delete, or a decision records why they are kept (e.g. attempts or reviews still reference them).

## Open questions

- Do `attempts` / review rows reference these keys (FK or by value)? Read the MF-0003 / MF-0007
  migrations before deciding the delete.
