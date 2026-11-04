# MF-0011 LOOP-PLAN — iteration 2

## Iteration 2 delta (2026-11-04, after review)

- C-3 (user): the gate counts contributors OTHER than the viewer (`MIN_OTHER_CONTRIBUTORS = 3`); the figures
  pool every contributor; `GroupHeatmap` carries no count. `group_attempts` returns `is_viewer`;
  `fetchGroupAttempts` returns `{ viewer, others }`. The migration is local-only and uncommitted, so it was edited in
  place and reapplied (functions dropped, history row removed, `migration up`), with no reset.
- Review nits: N1 status from the shown percent (regression test seen red), N4 ADR wording, N5 importer lock
  matches any string literal, N6 `z.iso.datetime` at the boundary, N7 owns below, N8 docs drift, N10 heatmap
  streamed in its own `<Suspense>` (no longer serial; an error still reaches the segment's `error.tsx`).
- Not done: N3 rejected-path DB coverage (it would reject a real shared item mid-run), covered by the engine test.

(Iteration 1 plan follows, unchanged except `owns`.)


## Discovery

- Attempts: `public.attempts`, RLS "read own" (MF-0003). Review state: `private.item_reviews`,
  `private.item_state()` (MF-0007); a learner's spoiled set = min(created_at) of their reviews per item,
  any hash (`private.review_states`). `countableAttempts` (engine/memory) applies rejected + spoiled.
- Privileged pattern: `private.*` SECURITY DEFINER + `public.*` SECURITY INVOKER shim; revoke from
  `public, anon, authenticated` (MF-0002/0003/0007). Grants gate (MF-0005) checks relation/column grants
  and anon/PUBLIC EXECUTE on `public` functions; a service_role-only function needs no allow-list line.
- Server clients: only `createServerSupabase` (publishable key + cookies). No secret client exists.
  MF-0004 SC-8 + runbook A4 + `.env.example` say "no secret key in the app": **superseded by the user
  on 2026-11-04 (C-2)**, recorded as ADR 0004.
- Group page `src/app/(app)/groups/[groupId]/page.tsx`: GroupSlot under Suspense already reads
  per-user data and calls `new Date()`; members already render as an `AvatarGroup` (`member-list`).
- Data API `max_rows` 1000 (MF-0003 review): the read returns ONE row per member with a jsonb array,
  so ≤ group-size rows, no paging.

## SC → steps

| SC | Steps | Proof |
|---|---|---|
| SC-1 | T1 | `mf-0011-group-heatmap.db.acceptance.test.ts` SC-1 ×2 |
| SC-2 | T2, T3 | engine acceptance SC-2 ×2, DB acceptance SC-2 |
| SC-3 | T1 | DB acceptance SC-3 |
| SC-4 | T2 | engine acceptance SC-4 ×3 |
| SC-5 | T4 | browser, 3 local users (and 2 for "not enough data") |
| SC-6 | all | advisors (`supabase db advisors --local`), test:db (grants gate), receipt |

## Steps

1. **T1 migration** `supabase/migrations/20261104100000_mf0011_group_heatmap.sql`:
   - `grant usage on schema private to service_role;`
   - `private.group_attempts(p_group_id uuid, p_viewer_id uuid) returns table (member_key int, attempts jsonb)`,
     plpgsql, stable, SECURITY DEFINER, `search_path = ''`. Raises 42501 unless `p_viewer_id` is in
     `group_members` for the group. One row per member with attempts on the group's pack; `member_key` =
     row_number over md5(user_id‖group_id) (opaque, never a user id). Each attempt: question_id,
     skill_code, correct, answered_at, rejected (`item_state = 'rejected'`), spoiled_at (that member's
     min review created_at for the item).
   - `public.group_attempts` SECURITY INVOKER shim.
   - Revoke EXECUTE on both from `public, anon, authenticated`; grant to `service_role` only.
   - Apply: `supabase migration up --local`; then `pnpm db:types`.
2. **T2 engine** `src/engine/forest/group-heatmap.ts` (stub exists): `summarizeGroupHeatmap(pack, memories)`
   and `groupHeatmapFromAttempts({pack, members, now})` = countableAttempts → memoryBySkill → summarize.
   Inner tests `__tests__/group-heatmap.test.ts` (rounding, empty pack, exactly 3, a member with memory only
   in another pack's skills).
3. **T3 server**
   - `src/server/supabase/secret.ts`: `createSecretSupabase()`, `server-only`, reads `SUPABASE_SECRET_KEY`
     (throws if missing), no session persistence.
   - `src/server/groups/fetch-group-attempts.ts` (stub exists): rpc → zod parse (`GroupAttemptRows` in
     `src/server/groups/types.ts`) → `GroupMemberAttempts[]` with a per-member `ReviewContext`.
   - `src/server/groups/get-group-heatmap.ts`: `server-only`; `getGroupHeatmap({ groupId, viewerId, pack, now })`
     → `GroupHeatmap`. The ONLY importer of `secret.ts`, locked by
     `src/server/supabase/__tests__/secret-client-importers.test.ts`.
   - `scripts/dev-setup.mjs` writes `SUPABASE_SECRET_KEY` (server-only, from `supabase status`) into
     `.env.local`; `.env.example`, `docs/runbook/deploy.md` A4 (four vars), ADR `docs/adr/0004-…`.
4. **T4 UI** `src/features/groups/components/group-heatmap/` (Server Component; no hooks):
   `index.ts`, `group-heatmap.tsx`, `types.ts`, `utils.ts` (`heatBucket(healthyPercent)` 1–5,
   `regionSummary(region)` words), `__tests__/utils.test.ts`. A `Card` "Group heatmap": per region a tile
   with a `bg-chart-n` swatch (aria-hidden), the region name, a `Badge` word (Holding / Fading /
   No data yet), "NN % healthy trees · NN % average recall"; a legend for the swatch ramp; "Based on N
   members". Not-enough state: "Not enough data yet: N of 3 members have played." Wired in the page
   under the existing Suspense, between the members row and "Your forest".

## Riskiest step

T1/T3, the privileged read. Risks and guards:
- A member reaching other members' raw attempts → EXECUTE for `service_role` only (SC-3 catalog check), the
  secret key lives only in `src/server/supabase/secret.ts`, one importer (locked by test), never `NEXT_PUBLIC_`.
- Trusting the viewer id → `viewerId` comes from `getCurrentUser()` (verified session) in the page, never
  from the client; `getGroup` (RLS) has already proven membership; the function re-checks (SC-1).
- Leaking per-member data through the DTO → the page only receives `GroupHeatmap` (aggregates + count);
  rows stay inside `src/server/groups/`.
- Versioned-content rule (MF-0007 retro): this ticket records no judgement; it is read-only. N/A.

## Rejected options

- Definer read callable by `authenticated`: hands any member the others' raw attempts via the Data API (SC-3).
- FSRS in SQL: breaks "replay in the engine" and creates two copies of the formula (user, C-2).
- `use cache` per group: group-scoped, access-controlled, function of `now` (C-1).
- Paging rows like `fetchAttempts`: one jsonb row per member keeps it under max_rows without paging.

```json tasks
[
  {"id": "T1", "agent": "schema-builder", "owns": ["supabase/migrations/20261104100000_mf0011_group_heatmap.sql", "src/server/db/database.types.ts"], "depends_on": [], "closes": ["SC-1", "SC-3"], "done_when": "migration applied locally; DB acceptance SC-1/SC-3 green; grants gate green", "context": "LOOP-PLAN step 1"},
  {"id": "T2", "agent": "service-builder", "owns": ["src/engine/forest/group-heatmap.ts", "src/engine/forest/index.ts", "src/engine/forest/__tests__/group-heatmap.test.ts"], "depends_on": [], "closes": ["SC-2", "SC-4"], "done_when": "engine acceptance green", "context": "LOOP-PLAN step 2"},
  {"id": "T3", "agent": "service-builder", "owns": ["src/server/supabase/secret.ts", "src/server/supabase/__tests__/secret-client-importers.test.ts", "src/server/groups/fetch-group-attempts.ts", "src/server/groups/get-group-heatmap.ts", "src/server/groups/types.ts", "scripts/dev-setup.mjs", ".env.example", "docs/runbook/deploy.md", ".planning/tasks/MF-0004/GOAL.md", "docs/adr/0004-server-only-secret-key-for-group-aggregates.md"], "depends_on": ["T1", "T2"], "closes": ["SC-2"], "done_when": "DB acceptance SC-2 green", "context": "LOOP-PLAN step 3"},
  {"id": "T4", "agent": "ui-builder", "owns": ["src/features/groups/components/group-heatmap/**", "src/app/(app)/groups/[groupId]/page.tsx", "src/app/(app)/groups/[groupId]/error.tsx"], "depends_on": ["T3"], "closes": ["SC-5", "SC-6"], "done_when": "build green; browser check with 3 and 2 contributors", "context": "LOOP-PLAN step 4"}
]
```
