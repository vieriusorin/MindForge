---
verdict: approve
reviewed_hash: 3a9b867fb7bd489bef008d040db86cef95c6abb99928c2f2f0c55ebac04665db
reviewed_at: 2026-11-04T10:11:44Z
---
Overall verdict: **PASS-WITH-NITS** for iteration 2. There are no blocking findings. This review
replaces the iteration-1 review, which was bound to `bc4a71d3…` and is now void.

I recomputed the hash with the same recipe and it matches the hash above. On the local DB, the
applied `private.group_attempts` and `public.group_attempts` both return
`TABLE(member_key integer, is_viewer boolean, attempts jsonb)`. Both have the ACL
`postgres=X, service_role=X` and no PUBLIC entry. `database.types.ts:136-143` matches.

## C-3 fix: complete as specified

- **The type has no count field.** `GroupHeatmap` (`src/engine/forest/group-heatmap.ts:31-33`) is
  `{status:"not-enough-data"} | {status:"ready"; regions}`. `summarizeGroupHeatmap` returns
  nothing else (`:70`, `:106`).
- **No count leftovers anywhere.** `contributors` is only a local array in the engine
  (`:72-99`). Nothing under `src/` outside tests reads a count from the result.
- **The RSC payload carries no count.** `GroupHeatmapSlot` (`page.tsx`) is a Server Component.
  It passes only `heatmap` to `<GroupHeatmap>`, which is also a Server Component. So the payload
  holds rendered text only. `pack`, `now` and `viewerId` are server-to-server props and are
  never serialised to a client component.
- **The copy states no count.**
  - The not-enough line (`utils.ts:53-55`) states only the constant threshold
    (`MIN_OTHER_CONTRIBUTORS`), never a live number.
  - The ready description is "Pooled from every member who has played".
- **The gate counts others only.** `others.filter(size > 0).length < 3` → hidden.
  - The viewer is pooled into the figures only when they have memory (`:72-73`).
  - The healthy-share denominator is `contributors.length × skills`, consistent with the pooling.

## is_viewer SQL: correct

- `m.user_id = p_viewer_id as is_viewer` (`migration:43`) is non-null. The membership check
  already rejected a null or non-member viewer (`:31-36`).
- `(group_id, user_id)` is unique, so there is at most one viewer row.
- A viewer with no attempts on the pack has no row, because of the inner join at `:75`.
  `fetchGroupAttempts` then returns `viewer: null` (`fetch-group-attempts.ts:48-50`).
- `group by mb.member_key, mb.is_viewer` is functionally the same as before.
- Rejected, spoiled, pack scoping and definer hygiene are unchanged from iteration 1, which I
  had already verified.
- The DB acceptance test now also covers exclusion of attempts on other packs (FROZEN.json
  history, re-freeze approved by the user).

## N1 / N10: nothing regressed

- **N1:** `statusOf` (`group-heatmap.ts:51-57`) now compares the shown percent with
  `Math.round(0.85 * 100)`, which is 85. The word can no longer contradict the number, and the
  legend at `group-heatmap.tsx:86` is now exactly true. Inner test `group-heatmap.test.ts:54`
  pins 0.846 → 85 % → holding.
- **N10:** the heatmap streams in its own `<Suspense>` with a shadcn `Skeleton` fallback (not
  `SidebarMenuSkeleton`, so there is no `Math.random` prerender trap). The forest no longer waits
  on the privileged read.

## Findings

- [note] **The count is still partly derivable from figure granularity in groups of 5 or
  more.** Location: `src/engine/forest/group-heatmap.ts:97-100`. The healthy share is
  `k ÷ (N × |S|)`, and ccdv-f has two single-skill regions (D3, D4).
  - Example: a 5-person group where the viewer has played. D3 reading 25/50/75 % means N = 4,
    so exactly one named member hasn't played. D3 reading 20/40/60/80 % means everyone has.
  - Only 0 % and 100 % hide N. Multi-skill regions narrow it further.
  - In a 4-person group, "ready" already implies all three others played. This is the accepted
    "group fact" residual in C-3.

  The leak is "how many have played", not anyone's memory. The user should either accept it
  explicitly as part of the C-3 residual, or coarsen single-skill regions (for example, show
  the shade bucket only). Not blocking: C-3 as decided ("≥ 3 others, no count shown") is met
  literally.
- [note] **A heatmap error still takes down the whole page.** Location: `page.tsx`, the
  `GroupHeatmapSlot` `<Suspense>`. Suspense fixes latency only. A heatmap failure (missing
  `SUPABASE_SECRET_KEY`, an RPC error) still bubbles to `groups/[groupId]/error.tsx` and replaces
  the whole page, forest and invite link included. If the card is meant to fail alone, it needs
  its own error boundary. Acceptable as is, since the runbook documents that the key is required.
- [note] **The migration was edited in place.** Location:
  `supabase/migrations/20261104100000_mf0011_group_heatmap.sql`. The return type changed
  (`is_viewer`). Any other local stack that already applied the iteration-1 version will not
  pick up the change from `supabase migration up --local`, because the version is already
  recorded. It will then fail the zod parse (`is_viewer` missing) and the group page will throw.
  This matters only for parallel sessions on other machines, since the migration is
  uncommitted. Tell them to re-apply it.
- [note] **N3 is still open.** The SQL `rejected: true` path has no DB test. The deferral is
  recorded in LOOP-PLAN:12, and the SQL is correct by reading.
- [note] **Iteration-1 nits are closed:**
  - N4: ADR 0004 line 7 wording is accurate now.
  - N5: the importer lock matches any string literal (`secret-client-importers.test.ts:30`).
  - N6: `z.iso.datetime({ offset: true })` is used at `types.ts`.
  - N7: `owns` now includes `index.ts`, `error.tsx` and the MF-0004 GOAL.
  - N8: `.env.example`, the `dev-setup.mjs` comments and the MF-0004 GOAL:34 amendment are done.
