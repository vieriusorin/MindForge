---
ticket_id: MF-0027
tier: normal
stage: intake
builds_on: [MF-0003, MF-0007]
last_iteration: 0
goal_status: reserved
---

> Renumbered MF-0023 → MF-0027 on 2026-11-04 by MF-0014 (user decision C-2: a merge had concatenated this file with MF-0023's original ticket). Drafted 2026-11-04 by MF-0012 (user decision C-3), from the MF-0003 review note "learn the key from
> the feedback, then answer it". Not started.

## Objective

**Today.** After a wrong answer the Duel reveals the key and every rationale. A learner who meets the
same question again can answer from memory of the reveal, not of the skill. MF-0003 review: this yields a
sprout only (stability ≈ 2.3), so the forest overstates little.

**End state.** A decision, recorded in `docs/adr/` or CONTEXT.md: accept it as recall (spaced retrieval
of the rationale is still learning), or discount a correct answer to a question whose key was revealed
within N days.

## Open questions

- Is this a product decision (owner: user / D-owner) before any code? Likely yes.
