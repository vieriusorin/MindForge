---
phase: 1-planning
ticket_id: MF-0059
status: executing
verdict: IN_PROGRESS
started_at: "2026-11-06"
resume_with: /gsd-goal-loop
---

# Loop Plan — Iteration 1

Written by `ticket-planner` (2026-11-06) from GOAL.md (Facts F1–F7, Q1–Q4, C-1…C-4, "Expeditions at your own pace",
SC-1…SC-10, edge table), FROZEN.json (3 files, read whole), LOOP-VERIFY.md (RED at freeze) and the DESIGN draft of
this file. High-risk: **the user approves this plan, including the "Approval items" batch, before any BUILD task
runs.** "Symbols changed" and "Frozen files this will re-freeze" are the DESIGN draft kept verbatim, with lines
appended at their end (marked "Appended at PLAN").

## Discovery summary

**Precedents.** MF-0004 (`private.packs` registry written by `db:sync-keys`; cap via advisory lock), MF-0017
(expedition definer functions, exclusion constraint, privacy rules), MF-0054 (additive RPCs that keep MF-0005 green),
MF-0058 (task-graph shape, the `T1R` re-freeze task, orchestrator-owned tasks for paths no role agent may write).
Form + mutation reference: `src/features/groups/components/create-group-form/`. useMutation-on-a-button reference:
`src/features/paths/components/path-menu/hooks/use-path-menu.ts`. Confirm dialog precedent:
`src/features/storm/components/storm-session/components/finish-storm-dialog.tsx` (shadcn `AlertDialog`).

**DB today (read whole).**
- `supabase/migrations/20261103064106_mf0002_groups.sql`: `groups` (no `path_slug`), `group_members`;
  `private.join_group` (l.128–148) inserts the membership `on conflict do nothing` and returns the group id;
  `revoke execute on all functions in schema private` then per-function grants to `authenticated`. Table-level
  `select` on `groups` (a new column is readable with no new grant) and column `update (name)` only.
- `20261103150000_mf0004_create_group_guards.sql`: `private.packs` (RLS on, no policy, revoked from public/anon/
  authenticated); `private.create_group` = auth → slug in `private.packs` (22023) →
  `pg_advisory_xact_lock(hashtextextended('mf.create_group:'||uid, 0))` (l.43) → count ≥ 10 (54000) → insert group +
  admin row.
- `20261105100000_mf0017_expeditions.sql`: `expeditions.ends_at not null`; CHECK `expeditions_seven_days` (l.27);
  `expeditions_one_active` = gist exclusion over `tstzrange(starts_at, ends_at)` (l.28; a null upper bound is
  unbounded, so it keeps working). `start_expedition` reads the pack with a plain select (l.62) and inserts
  `now() + 7 days` (l.77). `expedition_progress` joins `groups` for the pack at read time (l.122–125) and bounds
  `answered_at < v_ends` (l.148). The table has no grant; members read through definer functions only.
- `20261106120000_mf0058_paths.sql`: `path_enrollments` (own rows; PK `(user_id, path_slug)` makes a repeat a no-op);
  newer tables also revoke from `service_role`.
- MF-0005 (`src/server/db/__tests__/mf-0005-grants.db.acceptance.test.ts`) gates relation and column privileges of
  anon/authenticated/PUBLIC in `public` and `private`, and EXECUTE on `public` functions for anon/PUBLIC. This plan
  adds no line to it: no table or column grant, every new `public` function revoked from `public, anon`.

**Sync script.** `scripts/sync-question-keys.mjs` refuses in this order: `MINDFORGE_PACKS_DIR` + `SUPABASE_DB_URL`
(l.38), remote checkout not `main` or dirty under `packs/` (l.150–161), `validatePacks` (l.170, "Not syncing:
invalid pack content."). Then the registry transaction (l.178–196), then one transaction per pack (skills; keys +
items). `scripts/lib/validate-packs.mjs` registers `ts-resolve.mjs`, so the script can `import()`
`src/engine/path/parse-path.ts` the same way it imports the pack loaders. `scripts/**` is NEVER-writable by role
agents (`.claude/hooks/lib/agent-scopes.mjs`): the orchestrator owns that task.

**Paths.** `paths/claude-developer.yaml` (5 courses, each a folder in `packs/`); `parsePath` / `PathFileSchema`
(`src/engine/path/{parse-path,schema}.ts`); `getPath(slug)` / `listPaths()` (`src/server/paths/`, file-backed,
`"use cache"`). `groupCourseStep` is a throwing stub (`src/engine/path/group-course-step.ts`), already exported.

**Groups feature.** `actions.ts`: `createGroup(input: unknown)` (ActionResult via useMutation, the reference);
`joinGroup(code: string): Promise<void>` redirect-style, bound into `JoinCard`, which is a `<form action>` with no
hook. `schemas.ts`: `CreateGroupInput`. `utils/rpc-errors.ts`: `createGroupRpcError`, `rotateInviteRpcError`,
`pinRpcError` (+ tests). The join page `src/app/(public)/join/[code]/page.tsx` reads only `?error=invalid`. There is
no `error.tsx` in `(public)/join/[code]/` nor in `(app)/groups/` (only `(app)/groups/[groupId]/error.tsx`). The group
page `src/app/(app)/groups/[groupId]/page.tsx` streams `ExpeditionSlot` (l.46–88): `new Date(latest.endsAt)` (l.71),
the domain named from the CURRENT pack (l.75), the start form only when `!summary.isActive` (l.85).

**Expeditions feature.** `expedition-card/utils.ts`: `timeLeftLabel` switches exhaustively over
`ExpeditionTimeLeft` (no default), so the `"open"` member and its label must land in one task; `noneLine(true)` says
"Set a 7-day goal…" (asserted by the non-frozen `__tests__/utils.test.ts`). `start-expedition-form.tsx` hint
"Correct recalls the group makes together in 7 days." is not asserted by the frozen MF-0017 form test (it queries by
label and button names only). `src/server/expeditions/types.ts`: `LatestExpeditionRows.ends_at: z.string()` is
imported by the frozen `mf-0052-seed.db.acceptance.test.ts`, which calls `new Date(row.ends_at)`. Making the field
nullable is a **typecheck** error in that frozen file until it is re-frozen, so the re-freeze task (TR) precedes the
server-read task (T6) in the graph.

**Seed.** `src/dev-seed/seed-demo-world.ts:466-471` inserts `ends_at = starts_at + 7 days` by direct SQL;
`plan-demo-world.ts:406-407,687,696` bounds the planned window at 7 days (the planned answers never pass `now`, so
dropping the bound changes no planned value); `__tests__/plan-units.test.ts:284` restates the bound.
`src/dev-seed/**` is in no role agent's scope: orchestrator.

**Gates the touched paths sit on.** No `*_MIGRATED_PATHS` list or allowlist exists in this repo (grep
`MIGRATED_PATHS|ALLOWLIST` over `scripts/` and `.claude/hooks/`: none). Protected paths touched: the FROZEN.json of
MF-0017 and MF-0052 (orchestrator only, after approval). MF-0005's allow-list is NOT touched. shadcn `alert-dialog`,
`radio-group`, `badge`, `progress`, `select`, `field` are installed (`src/components/ui/`): no CLI add, no
`package.json` change.

**Current vs required.** Groups know one pack; paths are files only; an expedition is a fixed 7-day window counted
in the group's *current* pack. Required: a path registry in the DB; path groups that enroll on create and on join;
an admin step to the next course that ends a running expedition; expeditions open until ended (or replaced once
reached); each expedition counted in its own pack.

## Symbols changed

- `join_group`: same signature; also enrolls a new member of a path group in that group's path
- `joinGroup`: action migrated from redirect-style to a result through useMutation (F6)
- `JoinCardProps`: loses the bound action, gains the preview and the hook's state
- `GroupDetail`: gains a path slug field
- `sync-question-keys`: also writes the path registry table
- `start_expedition`: re-reads the pack under a row lock and stores it on the row (C-1)
- `expedition_progress`: counts in the expedition's own pack (C-1)
- `expeditions_seven_days`: becomes "ends_at is null or after starts_at" (own pace)
- `summarizeExpedition`: endsAt may be null (open), new time-left kind "open"; bounded behaviour unchanged
- `ExpeditionTimeLeft`: gains the "open" member
- `LatestExpeditionRows`: ends_at nullable
- `latest_expedition`: NOT changed (its columns are frozen); listed so the scan reads every use

Appended at PLAN (2026-11-06):

- `timeLeftLabel`: gains the label for the "open" kind
- `noneLine`: the admin's line drops "7-day"
- `ExpeditionCardProps`: the "shown" variant gains an end-expedition slot and a moved-on flag
- `Expedition.endsAt`: string or null (open)
- `StartExpeditionForm`: the target hint drops "in 7 days"
- `useCreateGroupForm`: gains a second argument (default path) and exposes the chosen kind
- `CreateGroupFormProps`: gains the paths list
- `planExpedition`: the planned window has no 7-day end (seed)

## Frozen files this will re-freeze

**Re-freeze (needs user approval at plan approval):**

- `src/server/db/__tests__/mf-0017-expedition.db.acceptance.test.ts` SC-1 "the admin starts one … the database sets a
  7-day window": breaks at `ends_at - starts_at = interval '7 days' as seven_days` / `seven_days: true` (null ends_at
  gives null). New: `ends_at is null as open` / `open: true`, title "… the database starts it open, from its own
  clock". Reason: own pace (user 2026-11-06). Every other MF-0017 case keeps bounded fixtures and stays as is.
- `src/dev-seed/__tests__/mf-0052-seed.db.acceptance.test.ts` SC-5 "one active expedition (started 3 days ago)":
  breaks at `expect(endsAt).toBeGreaterThan(Date.now())` and at `a.answered_at < ${row.ends_at}` in the per-domain
  query (an open row has a null end). New: `expect(row.ends_at).toBeNull()` and
  `a.answered_at < coalesce(${row.ends_at}::timestamptz, 'infinity')`. Reason: the seed creates open expeditions,
  as the product now does (`seed-demo-world.ts:466` inserts `ends_at` null).


Listed for review, **no re-freeze expected**. Each file's assertions were read on 2026-11-06:

- `src/server/db/__tests__/mf-0002-rls.db.acceptance.test.ts`: joins pack-only groups made by create_group; asserts membership, idempotence, bad codes. Adds no enrollment, assertions unchanged.
- `src/server/db/__tests__/mf-0011-group-heatmap.db.acceptance.test.ts`: joins a pack-only group as fixture; heatmap figures unchanged.
- `src/server/db/__tests__/mf-0017-expedition.db.acceptance.test.ts`: joins a pack-only group as fixture; unchanged.
- `src/server/db/__tests__/mf-0054-group-pins.db.acceptance.test.ts`: joins pack-only groups as fixture; unchanged.
- `src/server/db/__tests__/mf-0003-attempts.db.acceptance.test.ts`, `src/server/db/__tests__/mf-0007-review.db.acceptance.test.ts`, `src/server/db/__tests__/mf-0012-sync-keys.db.acceptance.test.ts`, `src/server/db/__tests__/mf-0016-cuckoo-keys.db.acceptance.test.ts`, `src/server/db/__tests__/mf-0024-id-prefix.db.acceptance.test.ts`, `src/server/db/__tests__/mf-0025-orphan-keys.db.acceptance.test.ts`: run the sync script (some with a fixture packs dir) and assert only the exit status and the "Not syncing" stderr refusals. Stay green if the registry write (a) runs after every existing refusal, (b) reads `paths/` regardless of the packs dir and does not cross-check pack folders (check:packs owns that), (c) fails closed on a bad path file before the first delete (MF-0034).
- `src/dev-seed/__tests__/mf-0052-seed.db.acceptance.test.ts`: SC-5 reads latest_expedition / expedition_progress on pack-only demo groups whose expeditions the seed inserts by direct SQL with a 7-day window (`seed-demo-world.ts:466`). The insert trigger fills the pack from the group, and the relaxed CHECK accepts exactly 7 days. No re-freeze. Also re-read for the C-1 symbols (already-listed files are skipped by the scan): `mf-0017-expedition.db.acceptance.test.ts` SC-1 still sees 7 days on start, SC-2 fixture updates keep 7 days, and SC-3's frozen column list of latest_expedition is not changed.
- `src/engine/expedition/__tests__/mf-0017-expedition.acceptance.test.ts`: every case passes a Date `endsAt` and asserts the bounded summary (percent, status, days / hours / under-an-hour / ended, isActive). Allowing `null` and adding the "open" kind leaves each of those results unchanged. No re-freeze.

Appended at PLAN (2026-11-06):

- **Superseded lines above.** The two "no re-freeze" notes on `mf-0052-seed.db.acceptance.test.ts` SC-5 and on
  `mf-0017-expedition.db.acceptance.test.ts` SC-1 ("still sees 7 days on start") predate "Expeditions at your own
  pace". The **Re-freeze** block wins for both. The rest of those two files is unchanged (MF-0017 SC-2/SC-3 fixtures
  insert bounded rows the relaxed CHECK accepts; the `before insert` trigger fills `pack_slug`).
- **Exact edits, MF-0017 SC-1** (one `it`, nothing else in the file): the title's "sets a 7-day window from its own
  clock" → "starts it open, from its own clock"; the row type field `seven_days: boolean` → `open: boolean`; the select
  line `ends_at - starts_at = interval '7 days' as seven_days` → `ends_at is null as open`; `seven_days: true` →
  `open: true`.
- **Exact edits, MF-0052 SC-5** (one `it`): delete `const endsAt = new Date(row.ends_at).getTime();` (with
  `ends_at` nullable it is a typecheck error in this frozen file, see Discovery); replace
  `expect(endsAt).toBeGreaterThan(Date.now());` with `expect(row.ends_at).toBeNull();`; in the per-domain query
  replace `a.answered_at < ${row.ends_at}` with `a.answered_at < coalesce(${row.ends_at}::timestamptz, 'infinity')`.
  The title stays ("one active expedition (started 3 days ago)" is still true).
- `src/features/expeditions/components/start-expedition-form/__tests__/mf-0017-start-expedition-form.acceptance.test.tsx`
  (scanned for `StartExpeditionForm`): asserts the Domain label, Target value and label, the button names, the range
  message and two server messages. The hint text is not asserted. No re-freeze.
- `src/dev-seed/__tests__/mf-0052-plan.acceptance.test.ts` (scanned for `planExpedition`): SC-5 asserts each
  planned expedition's `startsAt` (now − 3 days), domain and target bounds; nothing reads a planned end. No re-freeze.
- `src/features/groups/__tests__/mf-0004-rotate-invite.acceptance.test.ts`, `mf-0054-pin-actions.acceptance.test.ts`:
  mock and call `rotateInviteCode` / `pinGroup` / `unpinGroup`, which this plan does not change; `actions.ts` gains
  exports only. No re-freeze.

## SC coverage

| SC | Steps | Proof |
|----|-------|-------|
| SC-1 | 1.2, 2.1–2.4 | frozen `src/server/db/__tests__/mf-0059-path-groups.db.acceptance.test.ts` SC-1 (4 cases); `src/server/db/__tests__/mf-0059-sync-paths.db.test.ts` (MF-0034 failure order); two `pnpm db:sync-keys` runs |
| SC-2 | 1.1, 1.9, 7.1–7.3, 8.1, 10.1–10.3 | frozen DB file SC-2 (3 cases); `create-group-form` ui tests |
| SC-3 | 1.10 | frozen DB file SC-3 (5 cases) |
| SC-4 | 1.11 | frozen DB file SC-4 (6 cases); lock test (d) stale move |
| SC-5 | 1.12, 6.2 | frozen DB file SC-5 (4 cases); MF-0005 suite unchanged |
| SC-6 | 4.1 | frozen `src/engine/path/__tests__/mf-0059-group-course-step.acceptance.test.ts` (6 cases) |
| SC-7 | 7.1–7.4, 8.1–8.5, 10.1–10.7 | ui tests (create form, join card, move button, end button), `utils.test.ts` files, `pnpm build`, browser (T14) |
| SC-8 | T0, TR, 13.1–13.3, T14 | gate list in "Verify"; `git diff --exit-code main --` the five untouched frozen suites |
| SC-9 | 1.3–1.8, 1.11, 3.2, 3.4, 6.3, 10.4, 10.7 | frozen DB file SC-9 (5 cases); lock tests (a), (c); browser "Ended: the group moved to the next course" |
| SC-10 | 1.3–1.8, 3.1–3.4, 5.1–5.3, TR, 9.1, 10.4, 10.7 | frozen DB file SC-10 (7 cases); frozen `src/engine/expedition/__tests__/mf-0059-open-expedition.acceptance.test.ts` (6 cases); re-frozen MF-0017 SC-1 and MF-0052 SC-5; lock test (b); browser |

## Steps

Numbering: `<task>.<step>`. Every SQL function below is `set search_path = ''`, fully qualifies every name, and is
created in `private` as `security definer` with an invoker shim in `public` (MF-0002 pattern) unless stated.

### T0 — GOAL split + key-length comment (DONE at pickup; nothing to build)

0.1 `scripts/lib/key-length.mjs:15` comment repointed MF-0059 → MF-0061, and the GOAL.md split (Iteration Log
2026-11-06 pickup). It ships as its own hunk and its own commit (user, T0). Proof: `pnpm gate:planning` exit 0 on
this tree (F7).

### TF — RED freeze record (DONE; nothing to build)

The three frozen files and the two typed stubs exist (LOOP-VERIFY "RED at freeze"). The stubs are replaced by T3/T4.
Listed only so every changed file sits in exactly one task's `owns`.

### T1 — migration (schema-builder): `supabase/migrations/20261106140000_mf0059_path_groups.sql`

One new file; header comment states the access model like MF-0017's. Apply with `supabase migration up --local`
(never `db reset`, C-4), then `pnpm db:types`. If it must be re-applied while uncommitted (memory
`project-supabase-migration-rules` #5), this migration alters tables, so dropping functions is not enough: write a
scratch revert (drop the new functions, trigger, `private.path_courses`, `groups.path_slug`,
`expeditions.pack_slug`; set open rows' `ends_at = starts_at + 7 days`; restore the old CHECK and `not null`), delete
the `schema_migrations` row, then `migration up` again. Never commit the revert.

1.1 `alter table public.groups add column path_slug text check (path_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')`. No FK to the
registry (the sync deletes registry rows; C-3 says the group keeps working). **No grant statement**: the existing
table-level `select` covers it; `update` stays `(name)` only.

1.2 `create table private.path_courses (path_slug text not null check (slug regex), position integer not null check
(position > 0), pack_slug text not null check (slug regex), primary key (path_slug, position), unique (path_slug,
pack_slug))`; `enable row level security`; no policy; `revoke all on private.path_courses from public, anon,
authenticated, service_role` (MF-0058's stricter form; only the postgres-role sync writes it). Comment: written only
by `db:sync-keys` from `paths/*.yaml`.

1.3 `alter table public.expeditions add column pack_slug text`; backfill
`update public.expeditions e set pack_slug = g.pack_slug from public.groups g where g.id = e.group_id` (correct for
every existing row: no group's pack has ever changed, F2); `alter column pack_slug set not null`; add a slug-regex
CHECK. Trigger function `private.expedition_fill_pack()` (`returns trigger`, `security invoker`): when
`new.pack_slug is null`, set it from `public.groups` for `new.group_id`. `create trigger expeditions_fill_pack before
insert on public.expeditions for each row execute function private.expedition_fill_pack()`. MF-0017's direct-SQL
fixtures and the seed's insert omit the column and stay valid. `revoke execute on function
private.expedition_fill_pack() from public, anon, authenticated`.

1.4 Own pace: `alter table public.expeditions drop constraint expeditions_seven_days`; `alter column ends_at drop not
null`; `add constraint expeditions_ends_after_start check (ends_at is null or ends_at > starts_at)`. Then running rows
become open: `update public.expeditions e set ends_at = null where e.ends_at > now() and not exists (select 1 from
public.expeditions l where l.group_id = e.group_id and l.starts_at > e.starts_at)` (the guard keeps a future-dated row
from making the exclusion constraint fail mid-migration). Ended rows keep their dates. The exclusion constraint is
unchanged. Read-back recorded in LOOP-VERIFY right after `migration up`:
`select count(*) filter (where pack_slug is null), count(*) filter (where ends_at > now()) from public.expeditions`
→ `0, 0`.

1.5 New `private.expedition_count(p_expedition_id uuid) returns integer`, `language sql stable security invoker`:
the **one** countable-recall query, moved verbatim from `expedition_progress` (MF-0017 l.137–158: tenure join
`a.answered_at >= m.joined_at`, `pack_skills` domain join, `a.correct`, rejected-item and reviewed-item exclusions),
with two changes only: the pack is `e.pack_slug` (no join to `groups`) and the upper bound is
`a.answered_at < coalesce(e.ends_at, 'infinity'::timestamptz)`. No auth check, so `revoke execute … from public, anon,
authenticated`; only the two definer functions below call it (they run as the owner).

1.6 `create or replace private.expedition_progress(uuid)` (same signature, owner and grants kept): keep the
membership check (42501, no existence oracle) and the 4-member check (P0001) exactly as MF-0017, then
`return private.expedition_count(p_expedition_id)`. The membership lookup reads `e.group_id` only.

1.7 `create or replace private.start_expedition(uuid, text, integer)` (same signature; frozen MF-0017 SC-1 asserts
the argument list). Order:
  1. `auth.uid()` null or not `private.is_admin` → 42501.
  2. member count < 4 → P0001.
  3. `select g.pack_slug into v_pack from public.groups g where g.id = p_group_id for no key update` (Approval item 2:
     the GOAL says `for share`; see Riskiest step).
  4. target outside 10–1000 → 22023; domain not in `private.pack_skills` for `v_pack` → 22023 (unchanged).
  5. `select e.id, e.target into v_open, v_open_target from public.expeditions e where e.group_id = p_group_id and
     e.ends_at is null for update`.
  6. If `v_open` is not null and `private.expedition_count(v_open) >= v_open_target`:
     `update public.expeditions set ends_at = now() where id = v_open` (the reached one closes at the new start time:
     same transaction, same `now()`).
  7. `insert into public.expeditions (group_id, domain_code, target, pack_slug, starts_at, ends_at, created_by) values
     (p_group_id, p_domain_code, p_target, v_pack, now(), null, v_uid)`. An unreached open one is still there, so the
     exclusion constraint raises 23P01 (MF-0017 SC-1, frozen SC-10).

1.8 New `private.end_expedition(p_group_id uuid) returns void`: not admin → 42501;
`perform 1 from public.groups where id = p_group_id for no key update`;
`update public.expeditions set ends_at = now() where group_id = p_group_id and ends_at is null`; no row updated →
P0002 ('no expedition is running'). New `private.expedition_pack(p_expedition_id uuid) returns text`, `stable`: read
`e.group_id, e.pack_slug`; unknown id or non-member → 42501 (same message as `expedition_progress`); return the slug.
Shims `public.end_expedition(uuid)`, `public.expedition_pack(uuid)`.

1.9 New `private.create_path_group(p_name text, p_path_slug text) returns uuid`: `auth.uid()` null → 42501;
`select pack_slug into v_first from private.path_courses where path_slug = p_path_slug and position = 1`; null →
22023 ('unknown learning path'); `v_id := private.create_group(p_name, v_first)` — the existing function does the pack
check, the per-creator advisory lock and the cap of 10 (54000) and inserts the admin row, so nothing is duplicated and
the cap is shared by construction; then `update public.groups set path_slug = p_path_slug where id = v_id`;
`insert into public.path_enrollments (user_id, path_slug) values (v_uid, p_path_slug) on conflict do nothing`;
return `v_id`. Shim `public.create_path_group(text, text)`.

1.10 `create or replace private.join_group(p_code text)` (same signature, owner, grants): as MF-0002, plus: the
membership insert's row count (`get diagnostics v_new = row_count`); when `v_new = 1` and the group's `path_slug` is
not null **and** `exists (select 1 from private.path_courses where path_slug = v_path)` (Approval item 6), insert
`(v_uid, v_path)` into `public.path_enrollments on conflict (user_id, path_slug) do nothing` (keeps `started_at`, SC-3).
A re-join is not a new row, so a learner who left the path stays out (SC-3).

1.11 New `private.advance_group_course(p_group_id uuid, p_from_pack text default null) returns text` (the new pack):
  1. not admin → 42501.
  2. `select pack_slug, path_slug from public.groups where id = p_group_id for no key update`.
  3. `path_slug` null → P0001 ('this group follows no path').
  4. `p_from_pack is not null and p_from_pack <> pack_slug` → 40001 ('the group has already moved') — Approval item 3.
  5. current position = `private.path_courses` row for `(path_slug, pack_slug)`; none → P0001 ('the group''s course is
     not in its path').
  6. next = row at position + 1; none → P0001 ('already on the last course').
  7. `update public.expeditions set ends_at = now() where group_id = p_group_id and ends_at is null` (C-1: same
     transaction, the move time).
  8. `update public.groups set pack_slug = v_next where id = p_group_id`; return `v_next`.
  Shim `public.advance_group_course(p_group_id uuid, p_from_pack text default null)`; the frozen SC-4/SC-9 calls pass
  `p_group_id` only and resolve to it.

1.12 New `private.group_invite_preview(p_code text) returns table (name text, path_slug text)`, `stable`: when
`auth.uid()` is null return nothing; else `select g.name, g.path_slug from public.groups g where g.invite_code =
p_code`. Shim returns the same table (PostgREST returns an array: `[]` or one row, exactly the two keys, SC-5).

1.13 Privileges, at the end, MF-0017 style: for every new function `revoke execute … from public, anon,
authenticated` on the `private` version and `from public, anon` on the `public` shim; then `grant execute … to
authenticated` on `private.{create_path_group, advance_group_course, group_invite_preview, expedition_pack,
end_expedition}` and their shims. `private.expedition_count` and `private.expedition_fill_pack` get no grant.
`create or replace` keeps the existing grants of `join_group`, `start_expedition`, `expedition_progress`.

1.14 `pnpm db:types` (regenerates `src/server/db/database.types.ts`: `groups.path_slug`, `expeditions.pack_slug`,
the new RPCs).

1.15 `src/server/db/__tests__/mf-0059-expedition-locks.db.test.ts` (new, non-frozen): own fixture path
`mf0059-locks-<run>` written straight into `private.path_courses` by the test (positions 1 `ccdv-f`, 2
`prod-prompting`: both registered with skills), deleted in `afterAll`; a 4-member path group. Each interleaving case
holds one side open in `db.begin(...)` as the superuser connection that impersonates the admin (`set local role
authenticated; select set_config('request.jwt.claims', json_build_object('sub', <admin id>, 'role',
'authenticated')::text, true)`), sends the other side through the admin's Supabase client by calling `.then(...)` (a
lazy builder sends nothing until then), waits 500 ms, records `settledBeforeCommit`, and commits. Cases (a)–(e) are
listed under "Riskiest step". Before hand-off, run each case once against the opposite variant (lock line removed,
in a scratch copy of the function applied with `create or replace` and restored after) and paste the result in
LOOP-VERIFY: a case that stays green there is vacuous and is rewritten.

### T2 — sync writes the path registry (orchestrator: `scripts/**`)

2.1 `scripts/sync-question-keys.mjs`: `PATHS_DIR = process.env.MINDFORGE_PATHS_DIR || join(ROOT, "paths")`; refuse
`MINDFORGE_PATHS_DIR` together with `SUPABASE_DB_URL` (same message shape as the packs one). The remote check's
`git status --porcelain` covers `packs paths`, and its message says "under packs/ or paths/" (Approval item 7).

2.2 After `validatePacks` and before `postgres(...)` connects: read every `*.yaml` in `PATHS_DIR` (ENOENT = no paths,
any other error throws), `parsePath(text, "paths/<file>")` through the engine (`import()` of
`src/engine/path/parse-path.ts`, as `validatePacks` does), and also refuse: a file whose name is not `<slug>.yaml`
(`getPath` reads by that name), two files with one slug, a course listed twice in one path. Any problem →
`console.error("Not syncing: invalid path file.\n" + problems.join("\n"))`, `process.exit(1)`. No pack-folder
cross-check (check:packs owns it; fixture packs dirs would fail it).

2.3 Inside the existing registry transaction (l.178), after the pack registry writes: for each parsed path
`delete from private.path_courses where path_slug = ${slug}` then insert `(slug, i + 1, course)` per course; then
`delete from private.path_courses where not (path_slug = any(${slugs}))`. One transaction: a failure leaves the old
registry whole. Log `path registry: <slug> (<n> courses), …`. Header comment gains an `MF-0059:` line.

2.4 `src/server/db/__tests__/mf-0059-sync-paths.db.test.ts` (new): (i) a real run → `claude-developer` 1–5;
(ii) `MINDFORGE_PATHS_DIR` = a `mkdtemp` copy of `paths/` plus `zz-broken.yaml` (valid YAML, missing `courses`) →
exit 1, stderr contains "Not syncing: invalid path file", the 5 rows are still there, and `private.packs` row count is
unchanged (nothing written before the refusal: the MF-0034 regression); (iii) a copy where one path lists a course
twice → exit 1, rows unchanged; (iv) `MINDFORGE_PATHS_DIR` with `SUPABASE_DB_URL` set → exit 1 before any DB call.
Then `pnpm db:sync-keys` twice on the local stack (C-4): second run identical (SC-1).

### T3 — open expedition: engine + card copy (orchestrator: crosses `src/engine` and `src/features`)

One task so `pnpm typecheck` never goes red between tasks: `timeLeftLabel` switches exhaustively.

3.1 `src/engine/expedition/summarize-expedition.ts`: `ExpeditionTimeLeft` gains `{ readonly kind: "open" }`; export
`isExpeditionActive({ startsAt, endsAt, now }): boolean` = `startsAt <= now && (endsAt === null || now < endsAt)`;
`summarizeExpedition` uses it; when `endsAt === null`: `timeLeft = { kind: "open" }`, status `reached` when
`progress >= target` else `on-the-way` (never `not-reached`: an open one has not ended). Bounded inputs: identical
code path (frozen MF-0017 engine file). Update the file's top comment ("for 7 days" → own pace). Remove the stub
throw.

3.2 New `src/engine/expedition/can-start-expedition.ts`: `canStartExpedition(summary: ExpeditionSummary): boolean` =
`!summary.isActive || summary.status === "reached"` (mirrors 1.7: a reached open one is replaced, an unreached one
refuses). New `src/engine/expedition/is-ended-by-course-move.ts`: `isEndedByCourseMove({ expeditionPack,
currentPack, isActive }): boolean` = `!isActive && expeditionPack !== currentPack`. Both exported from
`src/engine/expedition/index.ts` with `isExpeditionActive`.

3.3 Tests (literals from the GOAL edge table): `__tests__/can-start-expedition.test.ts` (none running → n/a, the page
passes no summary; ended → true; open on the way → false; open reached → true; bounded active on the way → false);
`__tests__/is-ended-by-course-move.test.ts` (ended + other pack → true; ended + same pack → false; active + other pack
→ false); `__tests__/is-expedition-active.test.ts` (open at startsAt → true; open before startsAt → false; bounded at
endsAt → false).

3.4 `src/features/expeditions/components/expedition-card/utils.ts`: `timeLeftLabel({ kind: "open" })` →
`"No end date"`; `noneLine(true)` → `"Set a goal: every member's correct recalls in one domain count until you end
it."` (member line unchanged); new `movedOnLine()` → `"Ended: the group moved to the next course"`. Update
`__tests__/utils.test.ts` for all three (copy is Approval item 5).

### T4 — `groupCourseStep` (service-builder)

4.1 `src/engine/path/group-course-step.ts`: `index = path.courses.indexOf(currentPack)`; `-1` → `null`; else
`{ position: index + 1, total: path.courses.length, next: path.courses[index + 1] ?? null }`. Replace the stub; keep
the types and the contract comment. The frozen file is the oracle (6 cases); no inner test needed beyond it.

### T5 — seed: open expeditions (orchestrator: `src/dev-seed/**`)

5.1 `src/dev-seed/seed-demo-world.ts:466-471`: insert `ends_at` = `null` (drop the `+ interval '7 days'` expression).
5.2 `src/dev-seed/plan-demo-world.ts`: delete `EXPEDITION_DAYS` and the `at >= endsAt` bound in `planExpedition`
(answers never pass `now`, so every planned value is unchanged); fix the comments at l.406 and the
`PlannedExpedition` comment in `src/dev-seed/types.ts:96` (open, no end).
5.3 `src/dev-seed/__tests__/plan-units.test.ts:284`: drop `t.answeredAt.getTime() < start + 7 * DAY &&`. Proof:
`pnpm test src/dev-seed` (same counts as before).

### TR — re-freeze MF-0017 SC-1 and MF-0052 SC-5 (acceptance-writer edits; orchestrator writes FROZEN.json)

Runs only after the user approved this plan (Approval item 1). Edits exactly the lines listed under "Frozen files this
will re-freeze → Exact edits". Then the orchestrator appends one `history` entry to each of
`.planning/tasks/MF-0017/FROZEN.json` and `.planning/tasks/MF-0052/FROZEN.json` (`at`, `path`, `from`, `to` = sha256
over LF-normalised content, `reason`: "MF-0059 own pace (user 2026-11-06): start_expedition opens an expedition
(ends_at null); …", `approved_by`: "user <date> (MF-0059 plan approval)"), and updates the file's `sha256`, the way
MF-0058's T1R did for MF-0005. Proof: both files green, and both were red against the T1+T5 tree before the edit
(paste the red lines in LOOP-VERIFY).

### T6 — server reads (service-builder)

6.1 `src/server/groups/types.ts`: `GroupDetail.pathSlug: string | null`; `InvitePreview { name: string; pathSlug:
string | null }`; `InviteCode = z.string().regex(/^[0-9a-f]{16,64}$/)` (moved here from `actions.ts` so the read and
the action share one owner; `features → server` is an allowed import). `src/server/groups/get-group.ts`: select
`path_slug`, map to `pathSlug`.
6.2 New `src/server/groups/get-invite-preview.ts` (`server-only`): `getInvitePreview(code: string):
Promise<InvitePreview | null>`; a code failing `InviteCode` → `null` without a query; RPC `group_invite_preview`;
parse rows with zod (`z.array(z.object({ name: z.string(), path_slug: z.string().nullable() })).max(1)`); no row →
`null`; error → throw `getInvitePreview: …`. Never cached (per-user call).
6.3 `src/server/expeditions/types.ts`: `LatestExpeditionRows.ends_at` → `z.string().nullable()`; `Expedition.endsAt:
string | null`. New pure `src/server/expeditions/to-expedition.ts` (`toExpedition(row)`: ISO strings, `null` kept) +
`__tests__/to-expedition.test.ts` (open row → `endsAt: null`; bounded row → ISO). `get-latest-expedition.ts` uses it.
New `src/server/expeditions/get-expedition-pack.ts` (`server-only`): `getExpeditionPack(id): Promise<string>`, RPC
`expedition_pack`, zod-parse a non-empty string, throw on error (the page gates membership first).

### T7 — feature contracts, additive only (ui-builder: `schemas.ts` / `types.ts` / `utils/` are outside service-builder's scope)

Nothing existing changes shape, so typecheck stays green until T8–T10 use them.
7.1 `src/features/groups/schemas.ts`: extract the name rule to a `GroupName` const used by `CreateGroupInput`
(unchanged output); new `CreatePathGroupInput = z.strictObject({ name: GroupName, pathSlug: slug regex "Pick a
path." })`; new form schema `GroupFormInput = z.discriminatedUnion("kind", [z.object({ kind: z.literal("pack"),
name: GroupName, packSlug }), z.object({ kind: z.literal("path"), name: GroupName, pathSlug })])` (non-strict
objects so the other kind's leftover field is stripped, not an error); `JoinGroupInput = z.strictObject({ code:
InviteCode })`; `AdvanceGroupCourseInput = z.strictObject({ groupId: z.uuid(), fromPack: slug })`. Types:
`CreatePathGroupValues`, `GroupFormValues = z.input<typeof GroupFormInput>`.
7.2 `src/features/groups/types.ts`: `CreatePathGroupResult = FormActionResult<{ groupId: string },
CreatePathGroupValues>`, `JoinGroupResult = ActionResult<{ groupId: string }>`, `AdvanceGroupCourseResult =
ActionResult`.
7.3 `src/features/groups/utils/rpc-errors.ts`: `createPathGroupRpcError` (22023 → field `pathSlug` "Pick a path.";
54000 → the cap message; else "Could not create the group. Try again."); `joinGroupRpcError` (P0002 → "This invite
link is invalid or has been reset. Ask a group member for a new one."; else "Could not join the group. Try again.");
`advanceGroupCourseRpcError` (42501 → "Only the group admin can move the group to the next course."; 40001 → "The
group has already moved. Refresh to see its course."; P0001 → "This group has no next course to move to."; else
"Could not move the group. Try again."). New `src/features/groups/utils/path-notice.ts` (second consumer rule:
create form + join card): `joinNotice(pathName)` → `"This group follows the {pathName} path. Joining starts it for
you."` (Q3 literal); `createNotice(pathName)` → `"This group follows the {pathName} path. Creating it starts the path
for you, and joining starts it for each member."`. Tests: extend `utils/__tests__/rpc-errors.test.ts`; new
`utils/__tests__/path-notice.test.ts`; new `src/features/groups/__tests__/group-form-input.test.ts` (pack kind keeps
`packSlug` and drops `pathSlug`; path kind needs `pathSlug` "Pick a path."; name trimmed; output re-parses with
`CreateGroupInput` / `CreatePathGroupInput` after `kind` is dropped).
7.4 `src/features/expeditions/schemas.ts`: `EndExpeditionInput = z.strictObject({ groupId: z.uuid() })`; `types.ts`:
`EndExpeditionResult = ActionResult`; `utils/rpc-errors.ts`: `endExpeditionRpcError` (42501 → "Only the group admin
can end an expedition."; P0002 → "No expedition is running."; else "Couldn't end the expedition. Try again.") + test.
Update the `startExpedition` doc comment's "7-day" in T9, not here.

### T8 — groups actions + join migration (ui-builder: `joinGroup`'s new signature and its only consumer must land together; a `() => Promise<JoinGroupResult>` is not assignable to the old `() => Promise<void>` prop, probed)

8.1 `src/features/groups/actions.ts`: new `createPathGroup(input: unknown): Promise<CreatePathGroupResult>` — user or
`redirect("/sign-in?next=/groups")` → `CreatePathGroupInput.safeParse` (→ `formErrorFromZod`) → `getPath(pathSlug)`
null → field error "Pick a path." → RPC `create_path_group` → `createPathGroupRpcError` → `{ ok: true, groupId }`.
`joinGroup(input: unknown): Promise<JoinGroupResult>` — user or the existing sign-in redirect (needs the code: parse
first, fall back to `/groups` when the input has none) → `JoinGroupInput.safeParse` (invalid → the invalid-link
message) → RPC `join_group` → `joinGroupRpcError` → `refresh()` (the sidebar lists the new group) → `{ ok: true,
groupId }`. No `redirect()` on success. New `advanceGroupCourse(input: unknown): Promise<AdvanceGroupCourseResult>` —
user → `AdvanceGroupCourseInput` → RPC `advance_group_course({ p_group_id, p_from_pack: fromPack })` →
`advanceGroupCourseRpcError` → `refresh()` → `{ ok: true }`. Authorization: the definer function is the role check
(no column grant lets anyone else change `pack_slug`); the hidden button is not. Remove the local `Code` const (now
`InviteCode`).
8.2 `src/features/groups/components/join-card/`: `types.ts` → `JoinCardProps = { status: "invalid" } | { status:
"ready"; code: string; groupName: string; pathName: string | null }`; `UseJoinCardReturn { join(): void; isPending:
boolean; errorMessage: string | null }`. `hooks/use-join-card.ts` (`"use client"`): `useMutation({ mutationFn: () =>
joinGroup({ code }) })`; success → `router.push(\`/groups/${groupId}\`)`; failure → `errorMessage` (result error or
"Could not reach the server. Try again."); `isPending` stays true after success (no double join). `join-card.tsx`
(`"use client"`, no hooks of its own besides `useJoinCard`): invalid → the existing alert text; ready → "You've been
invited to {groupName}.", the notice (`joinNotice(pathName)`) in a `<p>` **before** the button when `pathName` is not
null, `Button` "Join the group" / "Joining…" disabled while pending, error in `role="alert"`.
8.3 `src/app/(public)/join/[code]/page.tsx`: drop `searchParams`; after the auth redirect, `getInvitePreview(code)`;
null → `<JoinCard status="invalid" />`; else `getPath(preview.pathSlug)` when not null (a removed path file → no
notice, edge table) and render `status="ready"` with `pathName = path?.name ?? null`. Still no mutation on GET.
8.4 New `src/app/(public)/join/[code]/error.tsx` (client-side.md §6), shape of `(app)/groups/[groupId]/error.tsx`:
"The invite could not load" + Try again.
8.5 Tests (`ui` project, `@/test/render`, mock `next/navigation` and `@/features/groups/actions`):
`join-card/__tests__/join-card.test.tsx`: path group shows "This group follows the Claude Developer path. Joining
starts it for you." before the Join button (DOM order); pack-only shows no notice; Join calls `joinGroup({ code })`
and pushes `/groups/g-1`; a server error shows its message and re-enables the button; pending shows "Joining…"
disabled; network failure shows "Could not reach the server. Try again."; invalid shows the alert and no button.
`join-card/__tests__/use-join-card.test.tsx`: success / error / network branches and `isPending` after success.

### T9 — expeditions action (service-builder)

9.1 `src/features/expeditions/actions.ts`: new `endExpedition(input: unknown): Promise<EndExpeditionResult>` (auth →
`EndExpeditionInput` → RPC `end_expedition` → `endExpeditionRpcError` → `refresh()` → `{ ok: true }`); the
`startExpedition` doc comment loses "7-day" (own pace; a reached running one is replaced, see 1.7).

### T10 — group page, create form (ui-builder)

10.1 `src/features/groups/components/create-group-form/`: `types.ts` → `CreateGroupFormProps { packs: PackOption[];
paths: readonly Pick<PathContent, "slug" | "name">[] }`. `hooks/use-create-group-form.ts`:
`useCreateGroupForm(defaultPackSlug: string, defaultPathSlug = "")`, resolver `GroupFormInput`, default `kind:
"pack"`; `mutationFn: (values) => values.kind === "path" ? createPathGroup({ name, pathSlug }) : createGroup({ name,
packSlug })` (the pack call is byte-for-byte what the existing tests expect); `useWatch` exposes `kind` and the chosen
path slug; derived `pathNotice: string | null` (`createNotice` of the chosen path's name) and `canChoosePath =
paths.length > 0` (the hook receives `paths` through a second options argument if needed; no setters returned).
`create-group-form.tsx`: `RadioGroup` "Pack" / "Path" through `Controller` (shown only when `canChoosePath`), the pack
`Select` or the path `Select` by `kind` (each `FieldLabel htmlFor` matches its control `id`), the notice under the
path select, everything else as today.
10.2 `src/app/(app)/groups/page.tsx`: `listPaths()` in the same `Promise.all`; pass `paths` as `{ slug, name }`.
New `src/app/(app)/groups/error.tsx` (client-side.md §6).
10.3 Create-form tests: the 4 existing cases in `__tests__/create-group-form.test.tsx` stay as written (pack is the
default); add: choosing Path shows the notice "This group follows the Claude Developer path. Creating it starts the
path for you, and joining starts it for each member."; submitting with Path calls `createPathGroup({ name, pathSlug:
"claude-developer" })` and pushes `/groups/g-2`; a `pathSlug` server field error lands on the path select; pending
shows "Creating…" disabled. `__tests__/use-create-group-form.test.tsx`: existing 3 cases unchanged; add kind path
with an empty path → "Pick a path." and no call.
10.4 Group page `src/app/(app)/groups/[groupId]/page.tsx`:
  - `ExpeditionSlot`: `endsAt: latest.endsAt === null ? null : new Date(latest.endsAt)`; read
    `getExpeditionPack(latest.id)` in parallel with the progress read; when it differs from `group.packSlug`, name the
    domain from `getPack(expeditionPack)` (fallback to the code, as today); `movedOn = isEndedByCourseMove(...)`;
    start form when `canStartExpedition(summary)`; End button (admin) when `summary.isActive`.
  - New `GroupPathSlot` under its own `<Suspense>` (skeleton `h-40`), only when `group.pathSlug`: `getPath(pathSlug)`
    (null → render nothing: path file removed = pack-only on screen), `listPacks()` for course names, and for the admin
    `getLatestExpedition(group.id)` → `hasRunningExpedition = latest !== null && isExpeditionActive({...})`.
    `step = groupCourseStep({ path, currentPack: group.packSlug })`. Renders `GroupPathCard` with the
    `MoveCourseButton` slot for the admin only.
10.5 New `src/features/groups/components/group-path-card/` (Server Component, presentational): `types.ts`,
`utils.ts` (`pathCardView({ path, step, packNames })` → `{ title: "{name} path", rows: { slug, name, isCurrent }[],
positionLine: "Course {n} of {N}" | "This group's course isn't in the path any more", nextCourseName: string | null,
moveDisabledReason: null | "Last course of the path" | "This group's course isn't in the path any more" }`, names from
`packNames` with the slug as fallback), `group-path-card.tsx` (`Card`, `<ol>` of courses, `Badge` "Current course" on
the current row: a word, not colour), `index.ts`, `__tests__/utils.test.ts` (positions 1 and 5 of 5, not-in-path,
missing pack name → slug).
10.6 New `src/features/groups/components/move-course-button/` (client): `hooks/use-move-course-button.ts`
(`useMutation` → `advanceGroupCourse({ groupId, fromPack })`, success → `router.refresh()`, `errorMessage`,
`isPending`, dialog `open` state); `move-course-button.tsx`: `Button` "Move to next course" (disabled with the reason
text visible beside it when `disabledReason`), shadcn `AlertDialog` "Move to {nextCourseName}?" whose description
includes **"This ends the running expedition"** when `hasRunningExpedition`; confirm calls the hook. `types.ts`,
`index.ts`, `__tests__/move-course-button.test.tsx` (confirm text with/without a running expedition; confirm calls
`advanceGroupCourse({ groupId, fromPack: "ai-capabilities" })` and refreshes; server error shown; disabled with "Last
course of the path"; pending disabled).
10.7 Expeditions UI: `expedition-card/types.ts` "shown" variant gains `endButton?: ReactNode` and `movedOn: boolean`;
`expedition-card.tsx` shows `movedOnLine()` in place of the time label when `movedOn`, renders `endButton` when
given, and its top comment loses "7-day". New `src/features/expeditions/components/end-expedition-button/` (client,
same shape as 10.6: `AlertDialog` "End the expedition?" / "Progress stops counting now. You can start a new one
afterwards." / action "End expedition"; `endExpedition({ groupId })`, `router.refresh()`), with
`__tests__/end-expedition-button.test.tsx` (confirm calls the action and refreshes; error shown; pending disabled).
`start-expedition-form.tsx`: hint → "Correct recalls the group makes together." (the frozen MF-0017 form test is
unaffected).

### T13 — words (orchestrator: `CONTEXT.md` and `docs/` are in no agent's scope)

13.1 `CONTEXT.md`: **Expedition** → "a group's shared goal, started by the group admin … It runs until the admin
ends it, the group moves to its next course, or the target is reached and the admin starts the next one." (drops
"7-day"); new **Group path** ("the path a group follows, set when it is created; never changed afterwards") and
**Current course** ("the course pack of its path a path group is on; the pack its heatmap, expedition and review
follow; only the group admin moves it, one course forward"); **Group admin** gains "moves a path group to its next
course, and ends an expedition".
13.2 `docs/MINDFORGE.md:168,361`: "Weekly co-op goal" → "Co-op goal at the group's own pace".
13.3 `docs/runbook/deploy.md:78,82`: B3 also needed after `paths/**` changes; the remote refusal covers `paths/`.

### T14 — verify (orchestrator)

Gates, evidence, browser. See "Verify".

## Riskiest step

**The expedition transitions (1.7, 1.8, 1.11) and their lock order.** Three writers touch "the group's open
expedition": start (may close a reached one, then insert), end, and advance (closes it and swaps the pack). The
failure modes are: a start validating its domain against a pack that is being replaced (C-1's race); a reached
expedition closed twice or an unreached one closed by a start; a stale tab advancing two courses; a deadlock.

*Lock order (one rule for all writers):* the `public.groups` row first, then the expedition row. start, end and advance
all take the group row `for no key update` before reading or writing expeditions. `for no key update` does not
conflict with the `for key share` that a `group_members` or `expeditions` FK check takes, so joins are never blocked;
it conflicts with itself, so the three writers on one group run one at a time.

*Why not `for share` in start, as the GOAL wrote it (Approval item 2).* `for share` blocks advance, which is what
C-1 needed, but lets two starts run side by side; their inserts then meet inside the gist exclusion check, where
Postgres can report 40P01 instead of 23P01 — the flake already seen once at freeze on MF-0017 SC-1's concurrent case
(LOOP-VERIFY / Iteration Log). Serialising starts on the group row makes the second start see the first's open row and
get 23P01 every time.

*Interleavings, each a case in `mf-0059-expedition-locks.db.test.ts` with an ordering witness:*
- (a) advance holds the lock (pack FIRST → SECOND, uncommitted); the admin's start is sent. Witness:
  `settledBeforeCommit === false`. After commit the start succeeds and the new row's `pack_slug` is SECOND. Opposite
  variant (start's lock line removed): the start reads FIRST from its snapshot, blocks only at the FK, and stores
  FIRST — the case goes red.
- (b) a reached open expedition; two starts sent together. Exactly one `ok`, the other `23P01` (never 40P01, run 5
  times in the case); the reached one's `ends_at` = the new one's `starts_at`; exactly one open row.
- (c) advance holds the lock with an open expedition; `end_expedition` is sent. Witness pending until commit; then
  P0002 (nothing runs any more), and the expedition's `ends_at` is the advance's `now()`.
- (d) stale tab / double click: two `advance_group_course(G, 'FIRST')` calls in sequence → the first `ok` (SECOND),
  the second 40001 and the pack is still SECOND (one step, not two). The UI's disabled button is not the guard; this is.
- (e) end with nothing running → P0002, no row changed.

*UI predicates that gate a write, and the server refusal behind each:* Move hidden for members → 42501 (frozen SC-4);
Move disabled at the last course / off-path → P0001 (frozen SC-4); Move double-clicked or from a stale tab → 40001
(case d); End hidden for members → 42501 (frozen SC-10); End from a stale tab → P0002 (case e); Start form shown only
when `canStartExpedition` → 23P01 for an unreached open one (frozen SC-10, MF-0017 SC-1); Join pressed twice →
idempotent, one membership, one enrollment (frozen SC-3); a path picked from a stale list → 22023 (frozen SC-2).

*Version binding (MF-0013 retro):* advance sends the pack the page **rendered** (`fromPack`), never the stored one
echoed back; the server refuses when it differs. Nothing else here records a judgement about versioned content.

*The sync (MF-0034 failure order).* Every check that can fail on the path files (parse, file name = slug, duplicate
slug, duplicate course) runs for **all** files before the script connects; the existing refusals (packs dir + DB URL,
remote branch/dirty, invalid packs) run before that, so every "Not syncing" test keeps its stderr. The delete + insert
of the registry runs in one transaction with the pack registry. The committed regression is
`mf-0059-sync-paths.db.test.ts` case (ii): a valid first file, a broken second one → exit 1 and the previous 5 rows
still there. State the sync does NOT own, across re-runs and `pnpm db:reset`: `groups.path_slug` / `pack_slug` (admin
decisions) and `path_enrollments` (learner decisions) — the script never touches either table; a group whose course
left the path keeps working as a pack group (C-3). No id or manifest is kept on disk.

## Rejected options

- **Widen `createGroup` to a pack | path union.** Rejected: engineering-principles §2 (open/closed: "new behaviour
  is a new read or action, not a flag on an old one"), and it would change `createGroup`'s tested contract for no
  gain. `createPathGroup` is the action the GOAL's Constraints name; one form chooses between the two in its hook.
- **Duplicate the cap (lock + count + 10) inside `create_path_group`.** Rejected: one owner per fact; calling
  `private.create_group` shares the cap by construction and keeps `create_group` byte-for-byte.
- **Fork the countable-recall SQL into `start_expedition`.** Rejected: two copies of MF-0007's rule would drift; the
  `private.expedition_count` helper is the only copy, and `expedition_progress` delegates to it.
- **Close a reached expedition when the target is reached (trigger on attempts).** Rejected by the GOAL: progress is
  computed on read; reaching does not end it.
- **Add the pack to `latest_expedition`'s columns.** Rejected: frozen MF-0017 SC-3 lists them; `expedition_pack` is
  the separate read (C-1).
- **A reason column ("moved") on expeditions.** Rejected by C-1: derived from `expedition_pack` vs the group's pack.
- **An FK from `groups.path_slug` to the registry.** Rejected: the sync deletes registry rows; C-3 keeps the group
  working.
- **Cross-check path courses against `packs/` in the sync.** Rejected: check:packs owns it, and the fixture-packs-dir
  sync tests would fail.
- **Migrating `joinGroup` in a service-builder task.** Rejected: its only consumer (`JoinCard` via the join page)
  breaks typecheck until it is migrated too, and the page is outside service-builder's scope; one ui-builder task
  owns the action file and its consumer.
- **Putting `"open"` in the engine task and its label in the UI task.** Rejected: `timeLeftLabel` is exhaustive, so
  typecheck would be red between the two; T3 is one orchestrator task.
- **`db:reset` to apply the migration.** Rejected by C-4: `migration up --local` only.

## Approval items (bring to the plan checkpoint as one batch)

1. **Re-freeze** MF-0017 SC-1 and MF-0052 SC-5 with the exact edits listed above, plus a `history` entry in each
   ticket's FROZEN.json (task TR).
2. **Lock mode:** `for no key update` on the group row in start, end and advance, instead of the GOAL's `for share` in
   start (reason under Riskiest step). Behaviourally a superset of what C-1 asked.
3. **Stale-tab guard on Move:** `advance_group_course` gains an optional `p_from_pack` (default null, so the frozen
   calls are unchanged); the action always sends the rendered pack; a mismatch is refused with 40001.
4. **Two actions, one form:** `createPathGroup` beside the unchanged `createGroup` (not a widened `createGroup`).
5. **Copy not fixed by the GOAL:** open label "No end date"; admin's no-expedition line "Set a goal: every member's
   correct recalls in one domain count until you end it."; create-form notice "This group follows the {path} path.
   Creating it starts the path for you, and joining starts it for each member."; End dialog "End the expedition?" /
   "Progress stops counting now. You can start a new one afterwards."; Move dialog "Move to {course}?" (+ "This ends
   the running expedition" when one runs, GOAL literal).
6. **Join enrolls only when the group's path is in the registry** (a removed path file: the join page shows no notice,
   and nobody is enrolled in a path that no longer exists). Derived from C-3 ("treated as pack-only").
7. **Sync safety:** the remote refusal also covers local changes under `paths/`; a new `MINDFORGE_PATHS_DIR` (refused
   with `SUPABASE_DB_URL`) exists only for the MF-0034 regression test.
8. **`end_expedition` with nothing running** is refused (P0002, "No expedition is running.") rather than a silent ok.
9. **Seed:** `planExpedition` drops its 7-day upper bound (no planned value changes; `plan-units.test.ts` updated).
10. **Docs:** `docs/MINDFORGE.md` "Weekly co-op goal" → "Co-op goal at the group's own pace"; runbook B3 mentions
    `paths/`.

## Verify

- Gates (SC-8), all exit 0 on the final tree: `pnpm typecheck && pnpm lint && pnpm test`, `pnpm test:db`,
  `pnpm check:packs`, `pnpm gate:planning`, `pnpm build`, `node scripts/frozen-collisions.mjs MF-0059`.
- Untouched frozen suites (SC-8): `git diff --exit-code main -- src/server/db/__tests__/mf-0002-rls.db.acceptance.test.ts
  src/server/db/__tests__/mf-0004-create-group.db.acceptance.test.ts src/server/db/__tests__/mf-0005-grants.db.acceptance.test.ts
  src/server/db/__tests__/mf-0011-group-heatmap.db.acceptance.test.ts src/server/db/__tests__/mf-0054-group-pins.db.acceptance.test.ts`;
  for MF-0017 and MF-0052, the diff is exactly the TR lines.
- Local data steps, recorded in the Iteration Log: `supabase migration up --local`, `pnpm db:types`,
  `pnpm db:sync-keys` ×2 (second identical), the 1.4 read-back. No `db:reset`.
- Browser (port 3001, light + dark + 375 px, screenshots in `.planning/evidence/MF-0059/`; memory
  `feedback-browser-verification`: own pageId, wait for streamed DOM; data made through the UI/RPCs as local test
  users, cleaned up after; never commit keys from `supabase status`):
  - `/groups`: Pack/Path choice; Path shows the create notice; submit lands on the new group (admin enrolled: `/paths`
    shows it started).
  - `/join/<code>` of a path group: group name + the notice before "Join the group"; of a pack-only group: no notice;
    a bad code: the invalid alert; Join lands on the group page.
  - Group page of a path group: Path card (5 courses in order, "Current course" badge, "Course 1 of 5"); as admin
    "Move to next course" with the confirm text when an expedition runs; after the move the expedition card says
    "Ended: the group moved to the next course" with the old domain's name, and the start form offers the new
    course's domains; at course 5 the button is disabled with "Last course of the path"; as a member no button; a
    pack-only group: no Path card.
  - Expedition card: open state "No end date", "On the way" / "Goal reached"; admin sees End expedition; after End:
    "Ended".
- Evidence `.planning/evidence/MF-0059.md` with "See it yourself"; fresh-context review of the diff; `VERIFY MF-0059`
  and `EVAL MF-0059` when those scripts exist (they are not in `package.json` today: run the defaults by hand).

## Tasks — the graph the orchestrator dispatches; exactly one block

Tasks titled "(orchestrator)" touch paths no role agent may write (`scripts/**`, `src/dev-seed/**`, `CONTEXT.md`,
`docs/**`, FROZEN.json) or cross two agent scopes; their `agent` is nominal, as in MF-0058. T0 and TF are done and
listed so that every changed file sits in exactly one task's `owns`.

```json tasks
[
  {
    "id": "T0",
    "title": "GOAL split + key-length.mjs comment, separate hunk and commit (orchestrator, DONE at pickup)",
    "agent": "service-builder",
    "owns": ["scripts/lib/key-length.mjs"],
    "depends_on": [],
    "closes": ["SC-8"],
    "done_when": ["pnpm gate:planning"],
    "context": ["file:.planning/tasks/MF-0059/GOAL.md#Facts F7"]
  },
  {
    "id": "TF",
    "title": "RED freeze: 3 frozen files (DONE; stubs are replaced by T3/T4)",
    "agent": "acceptance-writer",
    "owns": [
      "src/server/db/__tests__/mf-0059-path-groups.db.acceptance.test.ts",
      "src/engine/path/__tests__/mf-0059-group-course-step.acceptance.test.ts",
      "src/engine/expedition/__tests__/mf-0059-open-expedition.acceptance.test.ts"
    ],
    "depends_on": [],
    "closes": [],
    "done_when": ["node -e \"const f=require('./.planning/tasks/MF-0059/FROZEN.json');if(f.files.length!==3)process.exit(1)\""],
    "context": ["file:.planning/tasks/MF-0059/LOOP-VERIFY.md"]
  },
  {
    "id": "T1",
    "title": "migration: path registry, path groups, join enroll, advance, invite preview, open expeditions + lock tests; migration up (no reset); db types",
    "agent": "schema-builder",
    "owns": [
      "supabase/migrations/20261106140000_mf0059_path_groups.sql",
      "src/server/db/database.types.ts",
      "src/server/db/__tests__/mf-0059-expedition-locks.db.test.ts"
    ],
    "depends_on": [],
    "closes": ["SC-2", "SC-3", "SC-4", "SC-5", "SC-9", "SC-10"],
    "done_when": [
      "pnpm test:db src/server/db/__tests__/mf-0059-expedition-locks.db.test.ts",
      "pnpm test:db src/server/db/__tests__/mf-0002-rls.db.acceptance.test.ts src/server/db/__tests__/mf-0004-create-group.db.acceptance.test.ts src/server/db/__tests__/mf-0005-grants.db.acceptance.test.ts src/server/db/__tests__/mf-0011-group-heatmap.db.acceptance.test.ts src/server/db/__tests__/mf-0054-group-pins.db.acceptance.test.ts src/server/db/__tests__/mf-0058-paths-rls.db.acceptance.test.ts",
      "pnpm test:db src/server/db/__tests__/mf-0017-expedition.db.acceptance.test.ts (whole file; exactly one red allowed until TR: 'SC-1: the admin starts one', the 7-day assertion. Amended in BUILD: the -t filter skipped the case that creates the fixture)",
      "pnpm typecheck"
    ],
    "context": [
      "skill:supabase",
      "skill:supabase-postgres-best-practices",
      "memory:project-supabase-migration-rules",
      "memory:feedback-local-first",
      "file:supabase/migrations/20261105100000_mf0017_expeditions.sql",
      "file:supabase/migrations/20261103150000_mf0004_create_group_guards.sql",
      "file:supabase/migrations/20261103064106_mf0002_groups.sql",
      "file:supabase/migrations/20261106120000_mf0058_paths.sql",
      "file:src/server/db/__tests__/mf-0005-grants.db.acceptance.test.ts",
      "file:.planning/tasks/MF-0059/LOOP-PLAN.md#Riskiest step"
    ]
  },
  {
    "id": "T2",
    "title": "db:sync-keys writes private.path_courses from paths/*.yaml, MF-0034 failure order + regression test (orchestrator)",
    "agent": "service-builder",
    "owns": [
      "scripts/sync-question-keys.mjs",
      "src/server/db/__tests__/mf-0059-sync-paths.db.test.ts"
    ],
    "depends_on": ["T1"],
    "closes": ["SC-1"],
    "done_when": [
      "pnpm db:sync-keys",
      "pnpm test:db src/server/db/__tests__/mf-0059-path-groups.db.acceptance.test.ts src/server/db/__tests__/mf-0059-sync-paths.db.test.ts",
      "pnpm test:db src/server/db/__tests__/mf-0003-attempts.db.acceptance.test.ts src/server/db/__tests__/mf-0007-review.db.acceptance.test.ts src/server/db/__tests__/mf-0012-sync-keys.db.acceptance.test.ts src/server/db/__tests__/mf-0016-cuckoo-keys.db.acceptance.test.ts src/server/db/__tests__/mf-0024-id-prefix.db.acceptance.test.ts src/server/db/__tests__/mf-0025-orphan-keys.db.acceptance.test.ts"
    ],
    "context": [
      "skill:gsd-goal-loop",
      "file:scripts/lib/validate-packs.mjs",
      "file:scripts/lib/ts-resolve.mjs",
      "file:src/engine/path/parse-path.ts",
      "file:src/server/db/__tests__/mf-0012-sync-keys.db.acceptance.test.ts",
      "file:.planning/tasks/MF-0059/LOOP-PLAN.md#Riskiest step"
    ]
  },
  {
    "id": "T3",
    "title": "open expedition: engine (open kind, isExpeditionActive, canStartExpedition, isEndedByCourseMove) + card copy in one task (orchestrator: crosses engine and feature scopes)",
    "agent": "service-builder",
    "owns": [
      "src/engine/expedition/summarize-expedition.ts",
      "src/engine/expedition/index.ts",
      "src/engine/expedition/can-start-expedition.ts",
      "src/engine/expedition/is-ended-by-course-move.ts",
      "src/engine/expedition/__tests__/can-start-expedition.test.ts",
      "src/engine/expedition/__tests__/is-ended-by-course-move.test.ts",
      "src/engine/expedition/__tests__/is-expedition-active.test.ts",
      "src/features/expeditions/components/expedition-card/utils.ts",
      "src/features/expeditions/components/expedition-card/__tests__/utils.test.ts"
    ],
    "depends_on": [],
    "closes": ["SC-10"],
    "done_when": [
      "pnpm test src/engine/expedition src/features/expeditions/components/expedition-card",
      "pnpm typecheck"
    ],
    "context": ["skill:typescript-strict", "skill:tdd", "skill:react-client-patterns", "file:src/engine/expedition/__tests__/mf-0017-expedition.acceptance.test.ts"]
  },
  {
    "id": "T4",
    "title": "engine: groupCourseStep",
    "agent": "service-builder",
    "owns": ["src/engine/path/group-course-step.ts", "src/engine/path/index.ts"],
    "depends_on": [],
    "closes": ["SC-6"],
    "done_when": [
      "pnpm test src/engine/path/__tests__/mf-0059-group-course-step.acceptance.test.ts",
      "pnpm typecheck"
    ],
    "context": ["skill:typescript-strict", "file:src/engine/path/path-progress.ts"]
  },
  {
    "id": "T5",
    "title": "seed: open expeditions, no 7-day planned window (orchestrator: src/dev-seed)",
    "agent": "service-builder",
    "owns": [
      "src/dev-seed/seed-demo-world.ts",
      "src/dev-seed/plan-demo-world.ts",
      "src/dev-seed/types.ts",
      "src/dev-seed/__tests__/plan-units.test.ts"
    ],
    "depends_on": ["T1"],
    "closes": ["SC-10"],
    "done_when": ["pnpm test src/dev-seed", "pnpm typecheck"],
    "context": ["file:src/dev-seed/__tests__/mf-0052-plan.acceptance.test.ts", "file:.planning/tasks/MF-0052/GOAL.md"]
  },
  {
    "id": "TR",
    "title": "re-freeze MF-0017 SC-1 and MF-0052 SC-5 after user approval; FROZEN.json history (orchestrator writes FROZEN.json)",
    "agent": "acceptance-writer",
    "owns": [
      "src/server/db/__tests__/mf-0017-expedition.db.acceptance.test.ts",
      "src/dev-seed/__tests__/mf-0052-seed.db.acceptance.test.ts",
      ".planning/tasks/MF-0017/FROZEN.json",
      ".planning/tasks/MF-0052/FROZEN.json"
    ],
    "depends_on": ["T1", "T5"],
    "closes": ["SC-8", "SC-10"],
    "done_when": [
      "pnpm test:db src/server/db/__tests__/mf-0017-expedition.db.acceptance.test.ts",
      "pnpm test:db src/dev-seed/__tests__/mf-0052-seed.db.acceptance.test.ts",
      "pnpm typecheck"
    ],
    "context": [
      "file:.planning/tasks/MF-0059/LOOP-PLAN.md#Frozen files this will re-freeze",
      "file:.planning/tasks/MF-0017/FROZEN.json",
      "file:.planning/tasks/MF-0005/FROZEN.json"
    ]
  },
  {
    "id": "T6",
    "title": "server reads: GroupDetail.pathSlug, getInvitePreview, nullable expedition end, toExpedition, getExpeditionPack",
    "agent": "service-builder",
    "owns": [
      "src/server/groups/types.ts",
      "src/server/groups/get-group.ts",
      "src/server/groups/get-invite-preview.ts",
      "src/server/expeditions/types.ts",
      "src/server/expeditions/get-latest-expedition.ts",
      "src/server/expeditions/to-expedition.ts",
      "src/server/expeditions/get-expedition-pack.ts",
      "src/server/expeditions/__tests__/to-expedition.test.ts"
    ],
    "depends_on": ["T1", "TR"],
    "closes": ["SC-5", "SC-9"],
    "done_when": ["pnpm test src/server/expeditions src/server/groups", "pnpm typecheck"],
    "context": ["skill:nextjs-data", "skill:react-feature-architecture", "skill:typescript-strict", "file:src/server/paths/get-path-enrollment.ts", "file:.claude/rules/server-side.md"]
  },
  {
    "id": "T7",
    "title": "feature contracts, additive: group form/path/join/advance schemas, result types, rpc-error maps, path notices; end-expedition schema + errors",
    "agent": "ui-builder",
    "owns": [
      "src/features/groups/schemas.ts",
      "src/features/groups/types.ts",
      "src/features/groups/utils/rpc-errors.ts",
      "src/features/groups/utils/path-notice.ts",
      "src/features/groups/utils/__tests__/rpc-errors.test.ts",
      "src/features/groups/utils/__tests__/path-notice.test.ts",
      "src/features/groups/__tests__/group-form-input.test.ts",
      "src/features/expeditions/schemas.ts",
      "src/features/expeditions/types.ts",
      "src/features/expeditions/utils/rpc-errors.ts",
      "src/features/expeditions/utils/__tests__/rpc-errors.test.ts"
    ],
    "depends_on": ["T6"],
    "closes": ["SC-7"],
    "done_when": [
      "pnpm test src/features/groups/utils src/features/groups/__tests__/group-form-input.test.ts src/features/expeditions/utils",
      "pnpm typecheck"
    ],
    "context": ["skill:forms-rhf-zod", "skill:typescript-strict", "skill:react-client-patterns", "file:src/lib/action-result.ts", "file:src/features/groups/components/create-group-form/hooks/use-create-group-form.ts"]
  },
  {
    "id": "T8",
    "title": "groups actions (createPathGroup, joinGroup -> ActionResult, advanceGroupCourse) + join card via useMutation + join page + error.tsx",
    "agent": "ui-builder",
    "owns": [
      "src/features/groups/actions.ts",
      "src/features/groups/components/join-card/**",
      "src/app/(public)/join/**"
    ],
    "depends_on": ["T1", "T6", "T7"],
    "closes": ["SC-2", "SC-3", "SC-4", "SC-7"],
    "done_when": [
      "pnpm test src/features/groups",
      "pnpm typecheck",
      "pnpm lint"
    ],
    "context": [
      "skill:server-client-components",
      "skill:client-data-tanstack-query",
      "skill:nextjs-data",
      "skill:react-client-patterns",
      "skill:react-component-split",
      "skill:ui-shadcn",
      "skill:accessibility",
      "file:.claude/rules/state-and-data.md",
      "file:src/features/paths/components/path-menu/hooks/use-path-menu.ts",
      "file:src/app/(app)/groups/[groupId]/error.tsx"
    ]
  },
  {
    "id": "T9",
    "title": "expeditions action: endExpedition; startExpedition comment loses 7-day",
    "agent": "service-builder",
    "owns": ["src/features/expeditions/actions.ts"],
    "depends_on": ["T1", "T7"],
    "closes": ["SC-10"],
    "done_when": ["pnpm typecheck", "pnpm lint"],
    "context": ["skill:nextjs-data", "skill:typescript-strict", "file:src/features/groups/actions.ts"]
  },
  {
    "id": "T10",
    "title": "screens: create form Pack/Path + notice, groups page + error.tsx, group page Path card + Move button, expedition card open/moved-on + End button, start-form hint",
    "agent": "ui-builder",
    "owns": [
      "src/features/groups/components/create-group-form/**",
      "src/features/groups/components/group-path-card/**",
      "src/features/groups/components/move-course-button/**",
      "src/features/expeditions/components/expedition-card/expedition-card.tsx",
      "src/features/expeditions/components/expedition-card/types.ts",
      "src/features/expeditions/components/end-expedition-button/**",
      "src/features/expeditions/components/start-expedition-form/start-expedition-form.tsx",
      "src/app/(app)/groups/page.tsx",
      "src/app/(app)/groups/error.tsx",
      "src/app/(app)/groups/[groupId]/page.tsx"
    ],
    "depends_on": ["T3", "T4", "T6", "T7", "T8", "T9"],
    "closes": ["SC-7", "SC-9", "SC-10"],
    "done_when": [
      "pnpm test src/features/groups src/features/expeditions",
      "pnpm typecheck",
      "pnpm lint",
      "pnpm build"
    ],
    "context": [
      "skill:server-client-components",
      "skill:client-data-tanstack-query",
      "skill:forms-rhf-zod",
      "skill:nextjs-data",
      "skill:react-client-patterns",
      "skill:react-component-split",
      "skill:ui-shadcn",
      "skill:accessibility",
      "file:.claude/rules/ui-design.md",
      "file:src/features/groups/components/create-group-form/create-group-form.tsx",
      "file:src/features/storm/components/storm-session/components/finish-storm-dialog.tsx",
      "file:src/features/paths/components/path-view/path-view.tsx"
    ]
  },
  {
    "id": "T13",
    "title": "CONTEXT.md (Expedition own pace, Group path, Current course, Group admin), MINDFORGE.md wording, runbook B3 (orchestrator)",
    "agent": "service-builder",
    "owns": ["CONTEXT.md", "docs/MINDFORGE.md", "docs/runbook/deploy.md"],
    "depends_on": ["T1", "T2"],
    "closes": ["SC-8"],
    "done_when": [
      "grep -nE '\\*\\*(Group path|Current course)\\*\\*' CONTEXT.md",
      "node -e \"if(/7-day/.test(require('fs').readFileSync('CONTEXT.md','utf8')))process.exit(1)\""
    ],
    "context": ["skill:grill-with-docs", "file:CONTEXT.md"]
  },
  {
    "id": "T14",
    "title": "verify: full gates, untouched-frozen diff, local browser proof (light/dark/375px), evidence, fresh-context review (orchestrator)",
    "agent": "ui-builder",
    "owns": [".planning/evidence/MF-0059.md", ".planning/evidence/MF-0059/**"],
    "depends_on": ["T0", "TF", "T2", "T10", "T13"],
    "closes": ["SC-7", "SC-8"],
    "done_when": [
      "pnpm typecheck && pnpm lint && pnpm test",
      "pnpm test:db",
      "pnpm check:packs",
      "pnpm build",
      "pnpm gate:planning",
      "node scripts/frozen-collisions.mjs MF-0059",
      "git diff --exit-code main -- src/server/db/__tests__/mf-0002-rls.db.acceptance.test.ts src/server/db/__tests__/mf-0004-create-group.db.acceptance.test.ts src/server/db/__tests__/mf-0005-grants.db.acceptance.test.ts src/server/db/__tests__/mf-0011-group-heatmap.db.acceptance.test.ts src/server/db/__tests__/mf-0054-group-pins.db.acceptance.test.ts"
    ],
    "context": ["memory:feedback-browser-verification", "memory:feedback-local-first", "memory:feedback-no-keys-in-logs", "memory:feedback-verify-derived-facts"]
  }
]
```
