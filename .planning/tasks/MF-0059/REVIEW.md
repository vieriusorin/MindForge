---
verdict: approve-with-fixes
reviewed_hash: ec1295e74954b9df6f4c05d92e755bd9259359ff82fe4e97c365e8db84db4a65
reviewed_at: 2026-11-06T13:19:35Z
---
<!-- reviewed_hash = `git diff main | shasum -a 256` (tracked files, including .planning). I also read the untracked
files from `git status --porcelain`. MF-0062…MF-0068 and the `[ELIFECYCLE] …` folder were excluded.
`pnpm ticket:verify` does not exist in this repo, so there was no receipt hash to bind to.
Round 1 reviewed 591f2ecb…91d73. Round 2 (this file) re-reviewed the delta only: the three expedition writers in the
migration, mf-0059-review-fixes.db.test.ts, lock case (c), the `movedOnLine` copy, and the evidence/GOAL edits that
came with them. -->

## Findings

### Blocker
None.

### Should-fix

- [resolved] (round 1 #1) The close time could fall before a start's `starts_at` (23514).
  supabase/migrations/20261106140000_mf0059_path_groups.sql:182, :231, :365 now set `v_now := clock_timestamp()`
  right after the `for no key update` on the group row, and every close and the start's insert use `v_now`
  (:202, :207, :233, :397).
  - **Interleavings.** Every app writer of `expeditions` (start, end, advance) holds the same group-row lock. So any
    `starts_at` a closer can see was written by a transaction that committed before this one got the lock, and its
    `v_now` was read before that commit. The closer's `v_now` is read after the lock grant, so it is strictly later,
    except for the clock caveat below.
  - **Two writers in one statement or one transaction.** For example `select start(g,…), end(g)`: the lock is already
    held (re-entrant). `clock_timestamp()` advances between calls, unlike `now()`, and a start is a count query plus
    an insert, far more than 1 µs. So the end's `v_now` is greater than the start's. Two starts in one statement:
    the second sees the first's open, unreached row and gets 23P01, as before.
  - **Frozen SC-10.** The reached row closes at `v_now` and the new row starts at the same `v_now`. "Closes at exactly
    the new start" holds, and `[s, v_now)` / `[v_now, ∞)` abut without overlap, so the exclusion constraint passes.
  - **Proof.** f1 and f2 were red before the fix with exactly 23514 (LOOP-VERIFY "Review fixes: RED before fix") and
    are green after. The test is not vacuous: the bug condition is early `now()` < late `starts_at`, which the 50 ms
    gap forces, and that is asserted (`starts_at > earlyNow`). The `>=` in the assertion is right because JS Dates
    truncate to ms and equality in the DB would already fail as 23514.
  - **Lock case (c).** The claim "the move's time stays" is kept. The test reads the `ends_at` the move wrote, inside
    the move's own transaction, and asserts the later `end_expedition` (P0002) left it byte-identical. It no longer
    ties the close to the transaction's `now()`, which is correct because that is no longer the semantics.
  - **Residual (accepted, no action).** `clock_timestamp()` is wall-clock, not monotonic. A backward NTP step between
    two writers could still give `ends_at <= starts_at`. That fails closed as 23514 (no write), which is the same
    outcome class as round 1, at negligible likelihood.

- [resolved] (round 1 #2) Move onto an unregistered pack. :385-391 add
  `exists (select 1 from private.packs p where p.slug = pc.pack_slug)` to the next-course select. Case (g) was red
  before the fix (`ok`) and is now green: P0001, pack unchanged.
  - P0001 is acceptable. It is a refusal raised before any write, consistent with the other "cannot move" cases, and
    the MF-0004 invariant (a group's pack is registered) holds again.
  - See the nit on its message below.

- [resolved] (round 1 #3) Browser proofs for SC-7 and SC-10 are now in `.planning/evidence/MF-0059/`:
  `sc-7-join-pack-only-no-notice.png`, `sc-7-last-course-move-disabled.png`, `sc-7-pack-only-group-no-path-card.png`
  and `sc-10-ended-by-admin.png`.
  - The SC-9 screenshots show the earlier moved-on wording. The evidence says so, and the new string is pinned by
    `expedition-card/__tests__/utils.test.ts:37`. Accepted, because it is a copy-only change the user decided.

- [should-fix, still open] (round 1 #4) Hosted rollout window. docs/runbook/deploy.md:63-79 and
  src/server/groups/get-group.ts:11.
  - Vercel deploys `main` before B2. Until B2 runs, `getGroup` selects the not-yet-existing `groups.path_slug`, so
    every group page throws.
  - Between B2 and B3, choosing "Path" is refused (22023 → "Pick a path.").
  - The evidence's "Not verified" still says only "needs the migration, then `pnpm db:sync-keys`".
  - Fix (docs only): in the hand-off/evidence, say that B2+B3 must run immediately after the merge and that group
    pages error until B2.

### Nit

- [nit] supabase/migrations/20261106140000_mf0059_path_groups.sql:393-395 + src/features/groups/utils/rpc-errors.ts:92.
  An unregistered next course raises 'already on the last course', which the UI words as "This group has no next
  course to move to." Meanwhile the Path card is built from the file, so it shows a next course and an enabled Move.
  The admin presses a button that always refuses, with a message that contradicts the card. It is safe (no write).
  For a clearer message, raise a distinct text such as 'the next course is not available' (still P0001), or check
  `listPacks()` when building `moveDisabledReason`.
- [nit] src/app/(app)/groups/[groupId]/page.tsx:96. `getPack(expeditionPack)` throws if the old course's pack folder
  is gone. Fall back to the domain code as the comment promises. (Unchanged from round 1.)
- [nit] scripts/sync-question-keys.mjs:195 + :273. The missing/empty paths dir (delete-all with an empty `any(...)`
  bind) is untested. (Unchanged.)
- [nit] src/features/groups/components/create-group-form/types.ts:21. `GroupFormFields` restates the fields of
  `GroupFormValues` by hand. (Unchanged.)

## Delta questions answered

- **Does `clock_timestamp()` after the lock keep `ends_at > starts_at` everywhere?** Yes, for every interleaving of
  the three app writers, including two calls in one statement, because they all serialise on the group row and the
  time is read after the grant. The only exception is a non-monotonic wall clock, which fails closed. Direct-SQL
  inserts (seed, fixtures) take no lock, but they are not an app path.
- **Does "a reached one closes at exactly the new start" still hold (frozen SC-10)?** Yes. One `v_now` is used for
  both. The frozen `mf-0059-path-groups` file (34/34) and MF-0017 (13/13) are green after the fix, and the frozen
  hash is unchanged.
- **Does any definer function now write before its checks?** No. The auth/role check still comes first in all three
  functions. The new statements are a variable assignment and a read-only `exists` inside a select. The first write in
  each function still follows every refusal.
- **Is P0001 acceptable for "next pack unregistered"?** Yes as a code. The message is a nit (above).
- **Function definitions in the DB match the file.** Applied in place with `create or replace` and checked by
  `md5(prosrc)` against the file bodies (LOOP-VERIFY). The signatures are unchanged, so `db:types` was correctly not
  rerun.

## Checked and found sound in round 1 (unchanged by the delta)

- **Function security.** Every new definer function sets `search_path = ''` and checks auth and role before any
  write. anon/PUBLIC execute is revoked, and there is no new table or column grant (MF-0005 untouched).
- **Invite preview.** `group_invite_preview` returns name + path_slug to signed-in callers only.
- **Joining.** `join_group` enrolls on a new membership only.
- **Recall count.** `expedition_count` is the single copy of the countable-recall rule (MF-0007 + tenure B1 kept).
- **Migration on real data.** The backfill and the open-row conversion are safe.
- **Privacy.** No one can deduce another member's enrollment or contribution.
- **Sync.** It keeps the MF-0034 failure order.
- **Re-frozen tests.** The MF-0017 SC-1 and MF-0052 SC-5 edits are exactly the approved lines, and the hashes match.
- **Rules.** The `state-and-data`, `react-client-patterns`, `ui-design` and code-conventions rules are followed.
