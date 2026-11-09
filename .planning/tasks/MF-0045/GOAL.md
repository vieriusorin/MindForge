---
ticket_id: MF-0045
title: "Storm DB test fixture must skip flagged questions"
tier: normal                      # test-fixture isolation; re-freezes a frozen acceptance file
stage: intake
branch: feat/MF-0045
builds_on: [MF-0013, MF-0007]
last_iteration: 0
goal_status: withdrawn            # superseded by MF-0052 (re-derived 2026-11-09)
---

> Found in MF-0019 (2026-11-05) while proving CI. Evidence: `.planning/evidence/MF-0019.md` § "DB suite".

## Objective

`src/server/db/__tests__/mf-0013-storms.db.acceptance.test.ts` picks its fixture as "the first 3 synced
D2 questions of ccdv-f" (`beforeAll`, `D2 = rows.filter(D2).slice(0, 3)`). `start_storm` refuses any
question whose `private.item_state` is `flagged` or `rejected` (migration `20261104130000_mf0013_storms.sql:253`).
After `pnpm dev:seed`, the demo user `new@mindforge-demo.test` flags `ccdv-f.D2.S2.q1`. So on any
seeded local stack, SC-3's first `start_storm` returns `22023 not a playable question for this storm`
and all 7 tests in the file fail. CI's fresh `db:reset` does not seed, so CI is expected to pass.

End state: the fixture selects only playable questions (not flagged/rejected, not reviewed by the
actor), so the file passes on a seeded local stack and on a fresh one.

## Open questions

- Re-freezing the file needs the user's approval (`FROZEN.json` history entry). Alternative without a re-freeze: keep `dev:seed` off the first 3 D2 items. That couples the seed to a test, so it isn't recommended.
- The `D2_13` fixture needs all 13 D2 questions. If one is flagged it can't pick 13 playable ones, so decide whether that case skips or uses its own synced fixture pack (as MF-0016 does with `MINDFORGE_PACKS_DIR`).

## Facts (re-derived 2026-11-09 at pickup)

- **Already fixed by MF-0052.** In `.planning/tasks/MF-0013/FROZEN.json` history, MF-0052 re-froze
  `src/server/db/__tests__/mf-0013-storms.db.acceptance.test.ts` on 2026-11-05 (approved by the user at the
  MF-0052 test:db checkpoint), `d774d647…` → `ac81d043…`. Its reason is this ticket's objective: D2 and D1 now
  come only from questions whose `private.item_state` is not `flagged`/`rejected`. The change is on `main`.
- **The D2_13 question resolves itself.** `private.start_storm` refuses an oversized storm
  (`20261104130000_mf0013_storms.sql:224`, "a % storm holds 1 to % questions") before the playability check
  (`:253`), so `boss13` is refused by the cap whether or not one of the 13 is flagged. It needs neither a skip nor a fixture pack.
- "Not reviewed by the actor": the fixture's actors are fresh `createTestUser` accounts, so no seeded review
  reaches them.

## Iteration Log

- 2026-11-09: picked up and re-derived (Facts above). Nothing left to change. Not re-proved on a seeded stack
  (Docker was not running). User decision 2026-11-09: withdraw as superseded by MF-0052, and take MF-0051 next.
