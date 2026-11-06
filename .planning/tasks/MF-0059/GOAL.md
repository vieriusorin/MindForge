---
ticket_id: MF-0059
title: Retrofit key-length tells in ccdv-f, prod-prompting, platform-foundations
tier: normal                      # content work: re-grounded option rewrites; no app code, no DB schema
stage: intake
branch:
builds_on: [MF-0044]
last_iteration: 0
goal_status: reserved             # reserved by MF-0044 (user decision C-3); never built automatically
---

> Reserved 2026-11-06 from MF-0044 (user decision C-3 at the DESIGN checkpoint). Not started.

## Objective

**Today.** MF-0044's key-length rule (`pnpm check:packs`: a `select: 1` key ≥ 1.15× its longest distractor, in
characters) skips three grandfathered packs. A read-only probe on 2026-11-06 found 70 hits in them: ccdv-f 40 of 48,
prod-prompting 28 of 54, platform-foundations 2 of 54 (`D1.S1.q4`, `D4.S1.q2`).

**End state (draft).** Every flagged question is rewritten so the key no longer stands out by length (shorten the key
or lengthen the distractors, re-grounded in the cited source per the course-pack brief), the three slugs are removed
from MF-0044's grandfather set, and `pnpm check:packs` still exits 0.

## Open questions (re-derive at pickup)

- One ticket or one per pack (ccdv-f is the exam pack; rewrites change content hashes, so in-flight attempts on old
  versions are voided per MF-0032).
- Re-run the probe at pickup: counts move as packs change.
