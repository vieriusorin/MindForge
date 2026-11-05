---
ticket_id: MF-0045
tier: normal                      # test-fixture isolation; re-freezes a frozen acceptance file
stage: intake
branch:
builds_on: [MF-0013, MF-0007]
last_iteration: 0
goal_status: reserved             # owner: user (re-freeze of a frozen file needs approval)
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
