---
verdict: approve
reviewed_hash: cf2457fe4a44a0f71b76ac5917a9eccd7a95b7e47ac614c27f0940f6e520a314
reviewed_at: 2026-11-04T13:18:47Z
---
## Findings

Round 2 (fresh context). Scope: src/dev-seed/** (incl. `__tests__/seed-regressions.db.test.ts`), scripts/dev-seed.ts,
the `dev:seed` line in package.json. MF-0014's files in the same tree are not reviewed. The hash was recomputed with
the LOOP-VERIFY recipe (`git diff HEAD -- . ':!.planning'` + sorted untracked "== path" + content, shasum -a 256) and it
matches the tree.

### Round 1 findings

- [resolved] (round-1 blocking 1) src/dev-seed/seed-demo-world.ts:73-77 + scripts/dev-seed.ts:23-34 — the manifest now
  records `youId` (types.ts:69-73). Step (b) runs only when `previous.youId === youId`, so after a `db:reset` (new uuid)
  it deletes nothing. A manifest written before the fix (no `youId`) fails the `z.strictObject` parse and gives `null`,
  so nothing is deleted. A manifest for another email also gives `null`. The delete still needs `user_id = youId`.
  The only case left open is a sequence restart while your auth user survives (e.g. a hand-run
  `truncate public.attempts restart identity`). `db:reset` and the repo's own tooling never do that, and no file in
  src/, scripts/ or supabase/ truncates attempts. Closed in intent. The regression test is RED-proven (LOOP-VERIFY).
- [resolved] (round-1 blocking 2) seed-demo-world.ts:151-156 + plan-demo-world.ts:213-215 + scripts/dev-seed.ts:64-75
  — (1) Reject: the writer re-checks `private.item_state` in the transaction and refuses `rejected`, as `review_item`
  does (mf0007:219). (2) Dismiss: the CLI passes every item with any `flag_resolutions` row (any hash, either action)
  to the planner as `excludeItemIds`, so no review, flag or approval lands on a resolved item. A re-run moves the flag
  to another AI item, and `item_state` reads it as `flagged` because that item has no dismiss. The world keeps the
  same shape (≥ 1 flagged, 1 approved pair). The flagged item id can change after you resolve one, which is the
  intended trade. Exclusion is unit-tested (plan-units.test.ts:111-120), and the reject refusal is RED-proven.
- [resolved] (round-1 note) API_URL not checked — guard.ts:25-38 now checks `apiUrl` for loopback, and the CLI passes
  `env.API_URL` (scripts/dev-seed.ts:57-61).
- [open, note] (round-1 note) deleting the demo creator cascades the demo group, so a non-demo account that joined it
  by invite loses that membership on re-run. Unchanged. GOAL doesn't state it.
- [open, note] (round-1 note) idempotency for "you" depends on the git-ignored manifest. Unchanged, and now also skipped
  after a reset (by design: those rows were wiped anyway).
- [open, note] (round-1 note) reviews are dated `now − 1 day`, before the reviewers' accounts and memberships exist.
- [open, note] (round-1 note) steps (a), (b), (d) run outside the (e) transaction. This matters a little more now: the
  new rejected refusal throws inside (e), after the demo users have been recreated and your previous seeded attempts
  deleted. On the CLI path, though, the planner already excludes resolved items, so the refusal is a backstop and
  should never fire there.
- [open, note] (round-1 note) SC-3 "strong remembers best" holds at R = 1.000 through whole-day rounding.

### New in round 2

- [note] src/dev-seed/seed-demo-world.ts:141-165 — the writer refuses `rejected`, but it doesn't check the dismiss case
  (a flag dated before the latest dismiss reads unflagged). That case is closed only by the CLI's `excludeItemIds`. A
  caller that skips `listResolvedItems` (the DB tests do) can still write an invisible flag. Today the only real
  caller is the CLI, so no user path is affected.
- [note] src/dev-seed/__tests__/mf-0029-seed.db.acceptance.test.ts:79-87 and seed-regressions.db.test.ts:29-37 — both
  plan with seed 42 and no `excludeItemIds` against the shared local DB. If you reject the seeded flag on the flags
  screen (the SC-7 workflow), the same item is likely planned again and `pnpm test:db` fails (the writer now throws
  "rejected"). Before the fix it failed SC-5's "≥ 1 flagged" instead. This is environment coupling, not a product bug.
  The frozen file can't change, but the regression test could pass `await listResolvedItems(db)`.
- [note] src/dev-seed/__tests__/seed-regressions.db.test.ts:82-84 — while the test runs, it inserts a real `reject`
  resolution on a real pack item in your local DB. It removes it in `afterAll` by its run-unique comment, so cleanup is
  exact. Until then the item reads `rejected` (it leaves play and the heatmap, mf0011:56). Tests run serially, so this
  is transient.

### Checked in round 2 and found clean

- No new delete path. The fixes add one read (`listResolvedItems`, select only) and narrow delete (b). Delete (a) is
  unchanged: exact lower-cased suffix, `assertDemoDomain`, and your email refused as a demo address. Regression-test
  cleanup deletes only its run-scoped demo domain, your test user's maintainer row and its own `flag_resolutions` row,
  matched by a unique comment.
- No new route to a non-local target. `SUPABASE_DB_URL` is still refused before `supabase status` is read, and both
  the DB URL and the Auth API URL must be loopback before `listResolvedItems` or any write runs (scripts/dev-seed.ts:54-65).
- Rules: the only `as` is the allowed errno cast (scripts/dev-seed.ts:36). Exported functions have explicit return
  types and `/** */` contracts. No `Date.now()`/`new Date()` in src/dev-seed outside tests. The manifest is parsed with
  zod at the boundary. The only package.json change in scope is the `dev:seed` line. The `generate:cards`/
  `generate:diagrams` lines belong to MF-0014.
