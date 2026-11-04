---
ticket_id: MF-0024
tier: high-risk                   # migration on private.question_keys / private.items
stage: intake
builds_on: [MF-0003, MF-0007]
last_iteration: 0
goal_status: reserved
---

> Drafted 2026-11-04 by MF-0012 (user decision C-3), from the MF-0003 review note "cross-pack
> `question_id` PK". Not started.

## Objective

**Today.** `private.question_keys` is keyed by `question_id` alone (and `private.items` by `item_id`).
Ids follow `<pack>.<skill>.<name>` by schema convention, but nothing in the DB stops two packs from
claiming the same id; the sync's `on conflict (question_id) do update set pack_slug = …` would move a key
between packs silently.

**End state.** Either a composite key `(pack_slug, question_id)` (migration + `record_attempt` +
attempts FK review), or a validator rule that the id prefix equals the pack slug, enforced by the sync
(MF-0012 made it run the app's validator).

## Open questions

- Is the validator rule enough (no migration)? Decide at DESIGN.
