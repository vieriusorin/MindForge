---
ticket_id: MF-0050
tier: normal
stage: intake
builds_on: [MF-0013]
last_iteration: 0
goal_status: reserved
---

> Drafted 2026-11-05 by MF-0025 (user decision: SC-6 amended, baseline red split out). Not started.

## Objective

**Today.** `src/server/db/__tests__/mf-0013-storms.db.acceptance.test.ts` fails 7 of 8 on the local
stack at `32d0abe` (`main` merge of MF-0024), with no MF-0025 change applied (`git stash -u`, 2026-11-05).
First failure, SC-3 line 137:

```
AssertionError: expected { code: '22023', … } to be null
  "message": "not a playable question for this storm"
```

`start_storm('ccdv-f', 'boss', 'D2', <first 3 D2 questions from private.question_keys ⋈ items>)` refuses
them. The other 6 fail downstream (no storm id).

**End state.** `pnpm test:db` exits 0: either the fixture picks questions `start_storm` treats as
playable, or `start_storm`'s playability check is fixed, whichever is wrong.

## Open questions

- Which check in `private.start_storm` raises 22023 (the `item_state` / review filter around
  `20261104130000_mf0013_storms.sql:140-150, 349`)? Did shipped ccdv-f content change (origin `ai`,
  unreviewed, flagged) after MF-0013 froze its fixture (MF-0039 content edits are a candidate)?
- Is the frozen fixture wrong (needs a re-freeze → user) or the function (a migration → high-risk)?
