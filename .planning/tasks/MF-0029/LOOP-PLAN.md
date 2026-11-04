---
phase: 1-planning
ticket_id: MF-0029
status: executing
verdict: IN_PROGRESS
started_at: "2026-11-04"
resume_with: /gsd-goal-loop
---

# Loop Plan — Iteration 1

## Discovery summary

Table map (Explore, file:line, in GOAL "Decided without a question"). Key facts the steps depend on:
- Users only through the GoTrue admin API; `handle_new_user` makes `profiles` (mf0002:167-183).
- `public.attempts.answered_at` (no `created_at`), superuser insert sets `user_id` explicitly; no triggers (mf0003:23-42).
- `private.item_reviews` keyed by reviewer **uuid**, `content_hash` must equal `private.items.content_hash`, flag needs
  a comment (mf0007:52-65); `review_item`'s rules (member, not author, hash, not rejected) are re-checked by the seed.
- Forest = FSRS replay from attempts at request time (`replay.ts`); stages top out at sapling without Feynman/Storm.
- Heatmap needs ≥ 3 OTHER contributors (`group-heatmap.ts:16`).
- Local connection: `src/test/local-stack.ts` (`stackEnv`, `adminClient`, `sql`) parses `supabase status -o json`.
- Precedent for tool code in `src/` + thin `tsx` CLI: MF-0008 (`src/content-pipeline`, `scripts/generate`).

## SC coverage

| SC | Steps | Proof |
|----|-------|-------|
| SC-1 | 1, 6 | plan acceptance SC-1 + CLI run with a remote `SUPABASE_DB_URL` |
| SC-2 | 2, 3 | plan acceptance SC-2 |
| SC-3 | 2, 3 | plan acceptance SC-3 (engine replay) |
| SC-4 | 4, 5 | db acceptance SC-4 |
| SC-5 | 3, 5 | db acceptance SC-5 |
| SC-6 | 5 | db acceptance SC-6 |
| SC-7 | 6, 8 | browser on :3001, magic link via Mailpit |

## Steps

1. `src/dev-seed/guard.ts` — `assertLocalSeedTarget`: non-empty `SUPABASE_DB_URL` → throw ("refusing SUPABASE_DB_URL: the
   demo seed is local only"); parse `dbUrl` with `new URL`, host must be `127.0.0.1` or `localhost` (else "local stack
   only"); `MF_AUTHOR_EMAIL` parsed with `z.email()`, lower-cased. Inner test: IPv6 `[::1]` accepted, `0.0.0.0` refused.
2. `src/dev-seed/random.ts` — seeded PRNG (mulberry32) + `pick`, `chance`; inner tests (same seed → same sequence).
3. `src/dev-seed/plan-demo-world.ts` — a `PERSONA_HABITS` table (`as const satisfies Record<Persona, Habit>`):
   | persona | active days ago | session every | answers / session | accuracy | skills |
   |---|---|---|---|---|---|
   | steady | 21 → 1 | 2 days | 10 | 0.85 | all, round-robin |
   | you | 21 → 1 | 2 days | 8 | 0.8 | all, round-robin |
   | strong | 21 → 1 | 1 day | 10 | 0.95 | all |
   | crammer | 3 → 1 | 1 day | 30 | 0.6 | all |
   | lapsed | 21 → 14 | 2 days | 10 | 0.8 | all |
   | new | 2 → 1 | 1 day | 4 | 0.5 | 3 skills |
   A correct answer = the key; a wrong one = one option id outside the key (always ≠ key as a set). Times are
   `now − d days` at a seeded hour, never ≥ `now`. Display names from a fixed table (e.g. "Ana Steady").
   Group: "Demo study group", created by the steady learner. Reviews (by demo learners only, on items whose author
   is not them, on questions they never answered, current hash, `createdAt = now − 1 day`): 1 question approved by
   2 reviewers, 1 item flagged with a comment, 2 single approvals. Throws when the inputs can't satisfy that.
   Habits are tuned until frozen SC-3 passes; inner tests pin the review rules on a small fixture.
4. `src/dev-seed/seed-demo-world.ts` — order: (a) refuse an empty / dot-less `demoDomain`; delete every auth user whose
   lower-cased email ends with `@<demoDomain>` via the admin API (cascades to profiles, attempts, reviews,
   memberships, their group); (b) delete `previous.youAttemptIds` **where user_id = you**; (c) find you in
   `auth.users` or `admin.createUser({ email, email_confirm: true })`; (d) create the 5 demo users, set
   display names; (e) in one `sql.begin` transaction: check the pack slug in `private.packs`; insert the group
   (`invite_code = replace(gen_random_uuid()::text,'-','')`) and its 6 members (creator + you `admin`, others
   `member`); bulk-insert attempts (returning ids → your ids into the manifest); check each review's item + hash in
   `private.items` (throw "registry is stale: run pnpm db:sync-keys"); insert reviews; upsert your
   `content_maintainers` row (`is_analogy_owner = true`).
5. Inner unit tests for any pure helper extracted from step 4 (email-suffix match is the one candidate).
6. `scripts/dev-seed.ts` (tsx CLI) — `stackEnv()` from `@/test/local-stack` (local-only tool; see Rejected) →
   `assertLocalSeedTarget` → `loadSeedInputs(packs/ccdv-f)` → `planDemoWorld({ now: new Date(), seed: --seed ?? 42 })`
   → `seedDemoWorld` with the manifest from `.cache/dev-seed/manifest.json` (git-ignored) → write the new manifest →
   print the logins (your email + the 5 demo emails) and "magic links arrive in Mailpit: http://127.0.0.1:54324".
7. `package.json` — `"dev:seed": "tsx scripts/dev-seed.ts"`.
8. Run it for real on the local stack with your `MF_AUTHOR_EMAIL`, then the browser check (SC-7) on :3001.

## Riskiest step

**Step 4 (a)/(b): the deletes.** A wrong filter would delete real local users or your hand-played answers.
Guards: deletes only (a) admin-API users whose email ends with `@<demoDomain>` (exact suffix, lower-cased, the
domain must contain a dot, never empty), and (b) attempt ids recorded by the previous run AND owned by you.
Proof: frozen SC-6 (an outsider's attempts, profile and memberships are byte-identical across a run), SC-1 (local
target only). No judgement about versioned content is written by a user (reviews are fixtures bound to the hash the
registry holds right now, and refused when it differs: step 4e). No new figure over other people's data: the
heatmap's existing threshold applies unchanged.

## Rejected options

- **`supabase/seed.sql`** — runs only on `db reset`, can't call the admin API (users), and can't read the pack files
  for keys and hashes.
- **Attempts through `record_attempt`** — stamps `now()`; no history (user decision).
- **Passwords for demo users** — the app signs in by magic link only (user decision).
- **Hoisting `stackEnv` out of `src/test/`** — one extra consumer, and it's a local-only tool; hoist when a third appears.
- **Marking seeded attempts with a magic value** (e.g. a millisecond pattern) — a local manifest is explicit.

## Verify

- `pnpm typecheck && pnpm lint && pnpm test && pnpm test:db` to a log; receipt hash as MF-0014.
- Fresh-context reviewer (high-risk) on the diff against GOAL + this plan.
- Browser (SC-7): signed in as you via Mailpit on :3001 — Today, the demo group page, Review, flags.

## Tasks — the graph the orchestrator dispatches; exactly one block

```json tasks
[
  { "id": "T1", "title": "guard + PRNG + planner", "agent": "inline",
    "owns": ["src/dev-seed/guard.ts", "src/dev-seed/random.ts", "src/dev-seed/plan-demo-world.ts", "src/dev-seed/types.ts",
             "src/dev-seed/__tests__/guard.test.ts", "src/dev-seed/__tests__/random.test.ts", "src/dev-seed/__tests__/plan-units.test.ts"],
    "depends_on": [], "closes": ["SC-1", "SC-2", "SC-3"],
    "done_when": ["pnpm exec vitest run --project unit src/dev-seed", "pnpm typecheck"],
    "context": ["skill:tdd", "skill:typescript-strict"] },
  { "id": "T2", "title": "writes to the local stack", "agent": "inline",
    "owns": ["src/dev-seed/seed-demo-world.ts", "src/dev-seed/__tests__/seed-units.test.ts"],
    "depends_on": ["T1"], "closes": ["SC-4", "SC-5", "SC-6"],
    "done_when": ["pnpm exec vitest run --project db src/dev-seed", "pnpm test:db"],
    "context": ["skill:supabase", "supabase/migrations/20261103160000_mf0007_reviews.sql"] },
  { "id": "T3", "title": "CLI + package script + real run + browser", "agent": "inline",
    "owns": ["scripts/dev-seed.ts", "package.json"],
    "depends_on": ["T2"], "closes": ["SC-1", "SC-7"],
    "done_when": ["pnpm typecheck", "pnpm lint", "SUPABASE_DB_URL=postgres://x@example.com/db pnpm dev:seed (exit 1)", "pnpm dev:seed"],
    "context": [] }
]
```

## Divergences (recorded during BUILD)

- Step 3 habits retuned: ts-fsrs counts elapsed time in whole days, so a skill answered < 24 h ago reads
  retrievability 1. "strong" now covers all 25 skills daily (25/session); "crammer" ends day 2 (4 → 2); "new" ends
  day 2 (3 → 2). Needed for frozen SC-3 "strong remembers best" (strictly greater). Commented in `PERSONA_HABITS`.
- "you" limited to 20 of 25 skills so your Today page shows seeds (SC-7 names seeds).
- The flag goes to an AI-written item only: the first real run flagged the human bee diagram (D1.S3), which hides
  the showcase diagram from Seed Planting. Inner test shown RED on the old rule first.
