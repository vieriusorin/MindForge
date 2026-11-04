---
ticket_id: MF-0029
tier: high-risk                   # privileged DB client + auth users (local only); no migration expected
stage: handoff
branch: main
builds_on: [MF-0002, MF-0003, MF-0007, MF-0011, MF-0018]
last_iteration: 0
goal_status: complete-pending-manual-commit
---

> Requested 2026-11-04 by the user ("seed … so we can see an entire application"), drafted from MF-0014's session.

## Objective

**Today.** `pnpm dev:setup` loads every question, card and diagram (answer keys + item registry), but a fresh
local stack has no people: no users, groups, attempts, memory or reviews. The dashboard forest, the group
heatmap and the review queue all render empty, so nobody can see the whole app without playing for weeks.

**End state.** `pnpm dev:seed` fills the LOCAL stack with a deterministic demo world: a few demo accounts
you can sign in as, a group, about three weeks of simulated answers (so trees sit at different stages and
some wilt), and a handful of reviews (some items approved, one flagged). Re-running it gives the same
world; `pnpm db:reset` removes it.

## Constraints

- Local only: refuses `SUPABASE_DB_URL` and any non-local DB URL (same guard as MF-0012's fixture rule).
- Data goes through the same rules as real use where they exist (MF-0007: an author never approves their own
  item; review verdicts bind to the content hash). Figures still come from `src/engine/**`; the seed writes
  inputs (attempts, reviews), never derived figures.
- Clock and randomness injected (fixed seed + fixed "now"), so the world is reproducible.
- No secrets in logs (memory: no keys in logs); demo passwords exist only for the local stack.

## Decided by the user (2026-11-04, INTAKE)

- 5 demo learners with distinct habits (steady, crammer, lapsed, new, strong) + the developer's own account
  (sign-in email) in the demo group as admin.
- Demo users sign in by magic link through Mailpit (local), the app's only sign-in path; no passwords added.
- Answer history: backdated direct inserts as the local superuser, correctness computed from the same answer
  keys; a test proves they match what `private.record_attempt` would decide. (`record_attempt` stamps `now()`,
  so dated history cannot go through it.)
- On demand only: `pnpm dev:seed`, idempotent, touches only demo rows; `pnpm dev:setup` stays non-destructive.

- (DESIGN) Your own account gets its own ~3 weeks of history (a "steady" persona) so Today shows a forest at once.
- (DESIGN) Your email is added to `private.content_maintainers` for the pack with `is_analogy_owner = true`
  (local DB only), so the flag-resolution and analogy screens are reachable.

## Decided without a question (DESIGN, from the code)

- "You" = `MF_AUTHOR_EMAIL` (MF-0008's "your sign-in email" variable). The seed refuses without it. When
  `pnpm db:reset` wiped your auth user, the seed recreates it with `email_confirm` and no password (magic
  link still works); otherwise it reuses it.
- Users are created only through the GoTrue admin API (`src/test/local-stack.ts:64-80` pattern), never raw
  `auth.users` inserts; `handle_new_user` makes the profile, the seed then sets readable display names.
- The group is inserted as superuser, so the seed re-checks what `private.create_group` would: the pack slug is
  in `private.packs`, the creator is an `admin` member. Pack = `ccdv-f` (= the dashboard default, so your Today
  page keeps the same pack, `primary-pack.ts:2`).
- Attempts: `question_id`, `skill_code`, `pack_slug` from `private.question_keys`; `correct` = exact set equality
  with `correct_options` (the `record_attempt` rule, mf0003:73-74); `answered_at` backdated (column name per mf0003).
- Reviews are direct inserts, so the seed enforces `review_item`'s rules itself: reviewer is a pack member, never
  the item's author (all 53 non-official items are by one author, who is not a demo user), current `content_hash`,
  and a reviewer reviews only questions they never answered (a review spoils the reviewer's later attempts,
  `countable.ts:9-20`). Flags carry a comment (required).
- Seeded trees top out at **sapling**: tree/ancient need Feynman and Storm results that replay never sets
  (`replay.ts:34-35`). Stated, not worked around.
- Heatmap: `MIN_OTHER_CONTRIBUTORS = 3` others with countable attempts; 5 demo learners clear it for every member.
  MF-0011 rule: the seed writes inputs only; what a viewer can deduce is unchanged by seeding.
- Demo users are recognised by their email domain `@mindforge-demo.test` (reserved `.test` TLD, delivered to
  Mailpit locally). Re-running deletes them through the admin API (cascades: profiles, attempts, reviews,
  memberships, their groups) and recreates them; your own demo attempts, reviews and maintainer row are replaced
  too. Nothing else is touched.
- Pure parts (personas → planned attempts and reviews, with injected `now` and seeded randomness) live in
  `src/dev-seed/**` (Vitest picks up only `src/**`, MF-0008 precedent); the CLI `scripts/dev-seed.ts` (tsx) does I/O.
- Preflight 2026-11-04: `pnpm typecheck`/`lint`/`test` green (MF-0014 tree, 255/255); `pnpm test:db` 32/32 on the
  running local stack. No proof needs `db:reset` or a stack restart: DB tests use their own run-scoped email
  domain and clean up after themselves.

## Success Criteria (confirmed by the user and frozen 2026-11-04)

- [x] SC-1: Local-only guard: `assertLocalSeedTarget({ env, dbUrl })` refuses when `SUPABASE_DB_URL` is set, when
  the DB host is not `127.0.0.1`/`localhost`, and when `MF_AUTHOR_EMAIL` is missing or invalid; `pnpm dev:seed`
  exits 1 before any write in each case. Proof: unit test + one CLI run with `SUPABASE_DB_URL=postgres://x@example.com/db`.
- [x] SC-2: `planDemoWorld({ now, seed, keys, items })` is deterministic (same inputs → deep-equal output; another
  seed → different), plans 6 learners (5 personas + you), every `answeredAt` in `[now − 21 days, now)`, and every
  planned `correct` equals exact set equality of `chosen` with the key. Proof: unit test.
- [x] SC-3: Replaying each planned history through the engine at `now` (`memoryBySkill` → `buildForest` → `summarizeForest`, the Today page's path) gives:
  steady and you ≥ 3 saplings each; lapsed ≥ 2 wilting skills; new ≥ 20 seed skills; strong the highest
  retrievability mean; nobody above sapling. Proof: unit test using the engine functions, literal thresholds.
- [x] SC-4: After the seed runs against the local stack: 5 demo users with readable display names; one group on
  `ccdv-f` with 6 members, you as `admin`; attempt rows per user = planned count; you are in
  `private.content_maintainers` as analogy owner; the group heatmap for you is not `not-enough-data`. Proof: DB test.
- [x] SC-5: Seeded reviews follow `review_item`'s rules: no reviewer reviews their own item or a question they
  answered; every review carries the item's current hash; ≥ 1 question ends `approved` (2 approvers), ≥ 1 item
  `flagged` (with a comment); `list_reviewable` for you is non-empty. For 10 sampled planned answers,
  `record_attempt` (called as that user) returns the same `correct` as the seeded row. Proof: DB test.
- [x] SC-6: Idempotent and contained: a second run gives the same counts (no duplicate users or groups); a
  non-demo user's attempts, profile and memberships are byte-identical before and after. Proof: DB test.
- [x] SC-7: In the browser on port 3001, signed in as you via Mailpit: Today shows saplings, wilting and seeds;
  the demo group page shows the heatmap; the review queue lists items; the flags screen shows the seeded flag.
  Proof: browser check (screenshots in evidence).

## Concerns

| # | Collision | Owner | Status |
|---|-----------|-------|--------|
| C-1 | Re-running replaces your seeded history and reviews; anything you played by hand in between is kept only if it isn't a demo row. Your own manual attempts are not demo rows, so they stay, mixed with the seeded ones. | user | resolved 2026-11-04 (user): acceptable |

## Open questions

- none.

## Iteration Log

<!-- append-only -->

- 2026-11-04 · intake → design · Claimed from the MF-0014 session (number free in tree, refs and worktrees).
  User answered the 4 intake questions above.
- 2026-11-04 · design · Table map (Explore, file:line). User: own history = yes, maintainer + analogy owner =
  yes. Preflight green incl. test:db 32/32. SCs drafted; C-1 open.
- 2026-11-04 · design → plan · User confirmed SCs and C-1. Froze 2 files (unit 3 red, db 4 skipped behind the
  not-implemented plan); 0 leftovers.
- 2026-11-04 · plan → build · LOOP-PLAN.md (3 tasks) approved by the user (high-risk).
- 2026-11-04 · build → test → handoff · T1–T3 built; 3 plan divergences recorded (persona retune for whole-day
  FSRS, you = 20 skills, AI-only flag). Real seed on the local stack + browser SC-7. Review round 1 changes-requested
  (manifest id reuse after reset; reviews on resolved items) → regression tests RED first, fixed. Round 2 approve,
  hash cf2457fe…. Gate 270/270 + db 38/38.
