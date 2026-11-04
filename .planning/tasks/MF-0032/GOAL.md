---
ticket_id: MF-0032
tier: high-risk                   # changes the security-definer grading function
stage: intake
branch: main
builds_on: [MF-0003, MF-0007, MF-0016]
last_iteration: 0
goal_status: reserved             # created by MF-0016 K-4 (user-approved 2026-11-04); never built automatically
---

## Objective

**Today.** `record_attempt(p_question_id, p_chosen)` grades against `private.question_keys`, which has no
content hash. Between a deploy that changes an item's key (a question's correct options, a cuckoo's
`flawLine`) and the matching `pnpm db:sync-keys`, the database grades against the other version than the
learner read. MF-0016 binds a cuckoo answer to the deployed file's hash only (C-4).

**End state.** An attempt names the content hash the learner read, and `record_attempt` refuses it when
the hash differs from `private.items.content_hash` (as `review_item` does since MF-0007), for every item
type that is graded.

## Open questions

- Optional parameter (`p_content_hash text default null`, like `review_item`) or required?
- Store the hash on `attempts` for the replay?
