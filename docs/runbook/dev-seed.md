# Local demo data (`pnpm dev:seed`)

Fills the **local** Supabase stack with a demo world, so every signed-in screen has data you can click
through: Today, study groups, Duel, Walk, Plant, Cuckoo, Storm, a finished storm's report, Review and
Flags. Built in MF-0029, extended to every pack in MF-0034, and completed in MF-0052. The records for
those tickets live in `.planning/tasks/<ID>/`.

## Run it

```bash
pnpm install
pnpm dev:setup                                   # local stack, migrations, pack sync, .env.local
pnpm db:reset                                    # optional: wipe the local DB first
MF_AUTHOR_EMAIL=you@example.com pnpm dev:seed    # every pack that has questions
pnpm dev                                         # http://localhost:3001
```

- Pass the email you **sign in with**. The seeded history, groups and storms attach to that account.
  The magic link arrives in Mailpit at http://127.0.0.1:54324.
- `--pack <slug>` (repeatable) narrows the run. A run replaces the whole demo world, so the packs you
  don't name lose their demo group. `--seed <n>` changes the random stream (default 42).
- Raw rows: Supabase Studio at http://127.0.0.1:54323. Pack content and reviews are in schema
  `private`; groups, attempts, storms and expeditions are in `public`.
- Local only. The script refuses `SUPABASE_DB_URL` and any non-local database.

## What it creates

| Data | Detail |
|---|---|
| Learners | 5 demo accounts (`steady`, `crammer`, `lapsed`, `new`, `strong` `@mindforge-demo.test`) plus you |
| Study groups | One per pack with questions: `Demo study group · <pack name>`. All six members are in each, and you are admin |
| Join order | Every `joined_at` is backdated to before the first answer. The exam pack (`ccdv-f`) is your **newest** group, so it is your primary pack in the sidebar on every run |
| Answers | About three weeks of practice per learner and persona, so trees are at seed, sprout and sapling stages, some wilting (Walk has skills to water) and some skills never answered (Walk offers "new", and the group page shows Plant links) |
| Storms | Exam packs only (today `ccdv-f`). You get 1 Full and 1 Boss Storm, and each demo learner gets 1 Full Storm. All are **finished and graded by the DB's own `private.finalize_storm`**, which also writes their attempts. This fills Readiness ("last storm"), Tree-stage trees, the storm report and the "Your recent storms" list |
| Expedition | One active expedition per demo group, started 3 days ago. Its target leaves progress between 0 and 100% |
| Reviews | A few demo approvals and one demo flag per pack, so Flags has an item. You are a content maintainer and analogy owner for every seeded pack |

The closing output prints, per pack, an account whose **review queue** is non-empty. Your own items
never appear in your queue (`list_reviewable` excludes the author). Today every non-ccdv-f item is
authored by `sorin.vieriu@ddroidd.com`, so for those packs the line names a demo account. Sign in as
that account to review.

## Re-running is safe

- The seed replaces only what it wrote: the demo users (cascading their rows), plus your seeded answers
  and storms listed in `.cache/dev-seed/manifest.json`. Hand-played answers and storms survive.
- Your rows are deleted only when the manifest's user id equals your current id. After `db:reset` your
  id changes, so an old manifest deletes nothing.
- Every check (pack registered, content hashes fresh, storm questions playable, expedition domain
  valid) runs for **all** packs before the first delete, and again inside the transaction.
- It refuses to run while you have an unfinished storm. Finish it first, or the unique "one running
  storm" index would block the insert.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| No study groups | Signed in with a different email than `MF_AUTHOR_EMAIL`, the app points at a hosted project (check `NEXT_PUBLIC_SUPABASE_URL` in `.env.local`), or `db:reset` ran without a seed afterwards |
| Storm shows "This pack has no mock exam" | Expected for a pack without an `exam:` block in `pack.yaml`. The sidebar hides Storm for such a pack (MF-0052; before that it was a 404) |
| `ccdv-f not synced: run pnpm db:sync-keys` in a DB test | Pack content isn't in the DB: run `pnpm db:sync-keys` (`db:reset` does it for you) |
| `pnpm test:db` red only after seeding | Some DB tests share the local DB with the seed. MF-0052 fixed the known case (the MF-0013 storm fixture now picks only playable questions). A new one should get its own ticket |

## What MF-0052 changed (2026-11-05)

- **Fresh-machine Storm 404.** The seed wrote every group in one transaction, so all `joined_at` values
  tied and the primary pack (newest join) was arbitrary. On a non-exam pack, the Storm link 404'd.
  Fixed in the seed (backdated, ordered joins) and in the app (Storm hidden or explained without an exam).
- **New in the seed:** finished storms, expeditions, the review-queue owner line, and the manifest's
  `youStormIds`.
- **New in the app:**
  - "Your recent storms" on `/play/<pack>/storm/full`, with the verdict from `stormSurvived` in
    `src/engine/storm`: a storm survives when every scored domain does;
  - the `StormUnavailable` empty state;
  - `formatUtcDate`, moved to `src/lib`.
- **Code map:**
  - `scripts/dev-seed.ts` is the CLI.
  - `src/dev-seed/plan-demo-world.ts` holds the pure plan (`planDemoWorlds`).
  - `src/dev-seed/seed-demo-world.ts` holds the writes and guards.
  - `src/dev-seed/manifest.ts` and `review-queue-owners.ts` are helpers.

## Known limits

- Trees reach **Tree**, not **Ancient** (that needs 45+ days of stability). This was a deliberate choice.
- If the process dies between the DB commit and the manifest write, the next run duplicates your seeded
  storms and answers. Run `pnpm db:reset` to recover.
- The recent-storms badge says "Not survived", while the storm report says "Not yet" per domain.
- MF-0052's browser walkthrough was done over HTTP only (the shared browser was busy). Clicking through
  the interactions on a seeded stack is still worth doing.
