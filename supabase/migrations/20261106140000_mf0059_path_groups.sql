-- MF-0059: groups follow a learning path, and expeditions run at the group's own pace.
--
-- Access model (.planning/tasks/MF-0059/GOAL.md, LOOP-PLAN.md T1):
--   * private.path_courses: the path registry (path_slug, position, pack_slug), written only by
--     scripts/sync-question-keys.mjs from paths/*.yaml. RLS on, no policy, nothing granted to any API
--     role (service_role included). Only definer functions read it.
--   * groups.path_slug: set once by create_path_group, never changed afterwards. No new grant: the
--     table-level SELECT of MF-0002 covers it, and the column UPDATE grant stays (name) only. No FK to
--     the registry: the sync deletes registry rows and a group whose path left keeps working (C-3).
--   * groups.pack_slug of a path group (its current course) moves only through advance_group_course,
--     admin only, one course forward, refused from a stale page (p_from_pack, 40001).
--   * expeditions.pack_slug: the pack an expedition counts in, stored at start (C-1). A move to the
--     next course ends the running expedition in the same transaction; its progress stays in its pack.
--   * Own pace (user, 2026-11-06): a start is open (ends_at null) until the admin ends it, the group
--     moves on, or a start replaces it once it reached its target. An unreached open one still refuses
--     a start through the exclusion constraint (23P01).
--   * Lock order (LOOP-PLAN "Riskiest step"): start, end and advance take the public.groups row
--     FOR NO KEY UPDATE before they read or write expeditions. That does not conflict with the FOR KEY
--     SHARE of an FK check (joins are never blocked) but conflicts with itself, so the three writers
--     on one group run one at a time.
--   * join_group enrolls a NEW member of a path group in its path, only while the path is in the
--     registry (approval item 6); a re-join never re-enrolls someone who left the path.
--   * group_invite_preview: name + path_slug for a code, signed-in callers only (the code already
--     grants joining).
--   * Every new function: definer in private, invoker shim in public, nothing for PUBLIC/anon.

-- ── 1.1 groups.path_slug ───────────────────────────────────────────────────────
alter table public.groups
  add column path_slug text check (path_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

-- ── 1.2 path registry (private) ────────────────────────────────────────────────
create table private.path_courses (
  path_slug text not null check (path_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  position integer not null check (position > 0),
  pack_slug text not null check (pack_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  primary key (path_slug, position),
  unique (path_slug, pack_slug)
);

alter table private.path_courses enable row level security;
revoke all on private.path_courses from public, anon, authenticated, service_role;

comment on table private.path_courses is
  'MF-0059: written only by db:sync-keys (scripts/sync-question-keys.mjs) from paths/*.yaml.';

-- ── 1.3 expeditions.pack_slug ──────────────────────────────────────────────────
alter table public.expeditions add column pack_slug text;

-- No group's pack has changed before this migration (F2), so the group's pack is each row's pack.
update public.expeditions e set pack_slug = g.pack_slug
from public.groups g
where g.id = e.group_id;

alter table public.expeditions alter column pack_slug set not null;
alter table public.expeditions
  add constraint expeditions_pack_slug_check check (pack_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

-- Direct-SQL inserts (MF-0017 fixtures, the dev seed) omit the column: take the group's pack.
create function private.expedition_fill_pack()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.pack_slug is null then
    select g.pack_slug into new.pack_slug from public.groups g where g.id = new.group_id;
  end if;
  return new;
end;
$$;

create trigger expeditions_fill_pack
  before insert on public.expeditions
  for each row execute function private.expedition_fill_pack();

-- ── 1.4 own pace: open expeditions ─────────────────────────────────────────────
alter table public.expeditions drop constraint expeditions_seven_days;
alter table public.expeditions alter column ends_at drop not null;
alter table public.expeditions
  add constraint expeditions_ends_after_start check (ends_at is null or ends_at > starts_at);

-- Rows still running become open; ended rows keep their dates. The guard keeps a row with a later
-- one in the same group bounded, so the exclusion constraint cannot fail mid-migration.
update public.expeditions e set ends_at = null
where e.ends_at > now()
  and not exists (
    select 1 from public.expeditions l
    where l.group_id = e.group_id and l.starts_at > e.starts_at
  );

-- ── 1.5 the one countable-recall query ─────────────────────────────────────────
-- Moved verbatim from MF-0017's expedition_progress; changes: the pack is the expedition's own
-- (C-1), and an open expedition counts up to now (own pace). No auth check: only the definer
-- functions below call it.
create function private.expedition_count(p_expedition_id uuid)
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*)::integer
  from public.expeditions e
  join public.attempts a
    on a.pack_slug = e.pack_slug
   and a.correct
   and a.answered_at >= e.starts_at
   and a.answered_at < coalesce(e.ends_at, 'infinity'::timestamptz)
  -- Review B1 (user 2026-11-05): only recalls made since joining.
  join public.group_members m
    on m.user_id = a.user_id and m.group_id = e.group_id and a.answered_at >= m.joined_at
  join private.pack_skills ps on ps.pack_slug = a.pack_slug and ps.skill_code = a.skill_code
  where e.id = p_expedition_id
    and ps.domain_code = e.domain_code
    -- MF-0007 (countableAttempts): a rejected item never counts …
    and private.item_state(a.question_id) is distinct from 'rejected'
    -- … nor an attempt at or after THIS member first reviewed the item (reviewing shows the key).
    and not exists (
      select 1 from private.item_reviews v
      where v.item_id = a.question_id
        and v.reviewer_id = a.user_id
        and v.created_at <= a.answered_at
    );
$$;

-- ── 1.6 progress: same contract, counted in the expedition's own pack ──────────
create or replace function private.expedition_progress(p_expedition_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_group uuid;
begin
  select e.group_id into v_group from public.expeditions e where e.id = p_expedition_id;

  -- An unknown id and a group the caller isn't in look the same: no existence oracle.
  if v_group is null or (select auth.uid()) is null or not private.is_member(v_group) then
    raise exception 'not a member of this group' using errcode = '42501';
  end if;

  if (select count(*) from public.group_members m where m.group_id = v_group) < 4 then
    raise exception 'expeditions need at least 4 members' using errcode = 'P0001';
  end if;

  return private.expedition_count(p_expedition_id);
end;
$$;

-- ── 1.7 start: open, in the group's current pack, replaces a reached one ───────
create or replace function private.start_expedition(p_group_id uuid, p_domain_code text, p_target integer)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_pack text;
  v_open uuid;
  v_open_target integer;
  v_id uuid;
  v_now timestamptz;
begin
  if v_uid is null or not private.is_admin(p_group_id) then
    raise exception 'only the group admin can start an expedition' using errcode = '42501';
  end if;

  if (select count(*) from public.group_members m where m.group_id = p_group_id) < 4 then
    raise exception 'expeditions need at least 4 members' using errcode = 'P0001';
  end if;

  -- Lock order: the group row first. A move to the next course cannot swap the pack under this
  -- start (C-1), and two starts on one group run one after the other.
  select g.pack_slug into v_pack from public.groups g where g.id = p_group_id for no key update;
  -- Review fix 1: the time is read after the lock, not now() (transaction start), so a close never
  -- precedes a start committed by a writer that held the lock before us (23514).
  v_now := clock_timestamp();

  if p_target is null or p_target not between 10 and 1000 then
    raise exception 'target must be a whole number from 10 to 1000' using errcode = '22023';
  end if;

  if p_domain_code is null or not exists (
    select 1 from private.pack_skills ps
    where ps.pack_slug = v_pack and ps.domain_code = p_domain_code
  ) then
    raise exception 'domain is not part of this group''s pack' using errcode = '22023';
  end if;

  select e.id, e.target into v_open, v_open_target
  from public.expeditions e
  where e.group_id = p_group_id and e.ends_at is null
  for update;

  -- A reached open one closes at the new start time (the same v_now).
  if v_open is not null and private.expedition_count(v_open) >= v_open_target then
    update public.expeditions set ends_at = v_now where id = v_open;
  end if;

  -- An unreached open one is still there: the exclusion constraint raises 23P01.
  insert into public.expeditions (group_id, domain_code, target, pack_slug, starts_at, ends_at, created_by)
  values (p_group_id, p_domain_code, p_target, v_pack, v_now, null, v_uid)
  returning id into v_id;

  return v_id;
end;
$$;

-- ── 1.8 end, and the expedition's pack for members ─────────────────────────────
create function private.end_expedition(p_group_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_now timestamptz;
begin
  if (select auth.uid()) is null or not private.is_admin(p_group_id) then
    raise exception 'only the group admin can end an expedition' using errcode = '42501';
  end if;

  perform 1 from public.groups g where g.id = p_group_id for no key update;
  -- Review fix 1: after the lock, so a start committed while we waited never ends before it began.
  v_now := clock_timestamp();

  update public.expeditions set ends_at = v_now
  where group_id = p_group_id and ends_at is null;

  if not found then
    raise exception 'no expedition is running' using errcode = 'P0002';
  end if;
end;
$$;

create function private.expedition_pack(p_expedition_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_group uuid;
  v_pack text;
begin
  select e.group_id, e.pack_slug into v_group, v_pack
  from public.expeditions e where e.id = p_expedition_id;

  if v_group is null or (select auth.uid()) is null or not private.is_member(v_group) then
    raise exception 'not a member of this group' using errcode = '42501';
  end if;

  return v_pack;
end;
$$;

-- ── 1.9 create a path group ────────────────────────────────────────────────────
create function private.create_path_group(p_name text, p_path_slug text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_first text;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select pc.pack_slug into v_first
  from private.path_courses pc
  where pc.path_slug = p_path_slug and pc.position = 1;

  if v_first is null then
    raise exception 'unknown learning path' using errcode = '22023';
  end if;

  -- create_group owns the pack check, the per-creator lock and the cap of 10 (54000): one cap for
  -- both kinds of group by construction.
  v_id := private.create_group(p_name, v_first);

  update public.groups set path_slug = p_path_slug where id = v_id;

  insert into public.path_enrollments (user_id, path_slug)
  values (v_uid, p_path_slug)
  on conflict (user_id, path_slug) do nothing;

  return v_id;
end;
$$;

-- ── 1.10 join: a new member of a path group starts its path ────────────────────
create or replace function private.join_group(p_code text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_group_id uuid;
  v_path text;
  v_new integer;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select g.id, g.path_slug into v_group_id, v_path from public.groups g where g.invite_code = p_code;
  if v_group_id is null then
    raise exception 'invalid invite code' using errcode = 'P0002';
  end if;
  insert into public.group_members (group_id, user_id, role)
  values (v_group_id, v_uid, 'member')
  on conflict (group_id, user_id) do nothing;
  get diagnostics v_new = row_count;

  -- Only a new membership enrolls (a re-join never undoes leaving the path), and only while the
  -- path is in the registry. An existing enrollment keeps its started_at.
  if v_new = 1 and v_path is not null
     and exists (select 1 from private.path_courses pc where pc.path_slug = v_path) then
    insert into public.path_enrollments (user_id, path_slug)
    values (v_uid, v_path)
    on conflict (user_id, path_slug) do nothing;
  end if;

  return v_group_id;
end;
$$;

-- ── 1.11 advance: one course forward, ends the running expedition (C-1) ────────
create function private.advance_group_course(p_group_id uuid, p_from_pack text default null)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_pack text;
  v_path text;
  v_position integer;
  v_next text;
  v_now timestamptz;
begin
  if (select auth.uid()) is null or not private.is_admin(p_group_id) then
    raise exception 'only the group admin can move the group to the next course' using errcode = '42501';
  end if;

  select g.pack_slug, g.path_slug into v_pack, v_path
  from public.groups g where g.id = p_group_id
  for no key update;
  -- Review fix 1: after the lock, so a start committed while we waited never ends before it began.
  v_now := clock_timestamp();

  if v_path is null then
    raise exception 'this group follows no path' using errcode = 'P0001';
  end if;

  -- Version binding: the page sends the course it rendered; a stale tab or a double click moves
  -- nothing (one step, never two).
  if p_from_pack is not null and p_from_pack <> v_pack then
    raise exception 'the group has already moved' using errcode = '40001';
  end if;

  select pc.position into v_position
  from private.path_courses pc
  where pc.path_slug = v_path and pc.pack_slug = v_pack;

  if v_position is null then
    raise exception 'the group''s course is not in its path' using errcode = 'P0001';
  end if;

  -- Review fix 2: groups.pack_slug has no FK and the sync does not cross-check paths with packs, so
  -- a next course whose pack is not registered is refused like a missing one (MF-0004: a group's
  -- pack is registered).
  select pc.pack_slug into v_next
  from private.path_courses pc
  where pc.path_slug = v_path and pc.position = v_position + 1
    and exists (select 1 from private.packs p where p.slug = pc.pack_slug);

  if v_next is null then
    raise exception 'already on the last course' using errcode = 'P0001';
  end if;

  update public.expeditions set ends_at = v_now
  where group_id = p_group_id and ends_at is null;

  update public.groups set pack_slug = v_next where id = p_group_id;

  return v_next;
end;
$$;

-- ── 1.12 invite preview: name + path only, signed-in callers ───────────────────
create function private.group_invite_preview(p_code text)
returns table (name text, path_slug text)
language sql
stable
security definer
set search_path = ''
as $$
  select g.name, g.path_slug
  from public.groups g
  where g.invite_code = p_code
    and (select auth.uid()) is not null;
$$;

-- ── public RPC surface (SECURITY INVOKER shims) ───────────────────────────────
create function public.end_expedition(p_group_id uuid)
returns void
language sql
volatile
security invoker
set search_path = ''
as $$ select private.end_expedition(p_group_id); $$;

create function public.expedition_pack(p_expedition_id uuid)
returns text
language sql
stable
security invoker
set search_path = ''
as $$ select private.expedition_pack(p_expedition_id); $$;

create function public.create_path_group(p_name text, p_path_slug text)
returns uuid
language sql
volatile
security invoker
set search_path = ''
as $$ select private.create_path_group(p_name, p_path_slug); $$;

create function public.advance_group_course(p_group_id uuid, p_from_pack text default null)
returns text
language sql
volatile
security invoker
set search_path = ''
as $$ select private.advance_group_course(p_group_id, p_from_pack); $$;

create function public.group_invite_preview(p_code text)
returns table (name text, path_slug text)
language sql
stable
security invoker
set search_path = ''
as $$ select * from private.group_invite_preview(p_code); $$;

-- ── 1.13 privileges: authenticated only (Supabase grants new functions to anon by default) ──
-- create or replace kept the grants of join_group, start_expedition and expedition_progress.
revoke execute on function private.expedition_fill_pack() from public, anon, authenticated;
revoke execute on function private.expedition_count(uuid) from public, anon, authenticated;
revoke execute on function private.end_expedition(uuid) from public, anon, authenticated;
revoke execute on function private.expedition_pack(uuid) from public, anon, authenticated;
revoke execute on function private.create_path_group(text, text) from public, anon, authenticated;
revoke execute on function private.advance_group_course(uuid, text) from public, anon, authenticated;
revoke execute on function private.group_invite_preview(text) from public, anon, authenticated;
revoke execute on function public.end_expedition(uuid) from public, anon;
revoke execute on function public.expedition_pack(uuid) from public, anon;
revoke execute on function public.create_path_group(text, text) from public, anon;
revoke execute on function public.advance_group_course(uuid, text) from public, anon;
revoke execute on function public.group_invite_preview(text) from public, anon;

grant execute on function private.end_expedition(uuid) to authenticated;
grant execute on function private.expedition_pack(uuid) to authenticated;
grant execute on function private.create_path_group(text, text) to authenticated;
grant execute on function private.advance_group_course(uuid, text) to authenticated;
grant execute on function private.group_invite_preview(text) to authenticated;
grant execute on function public.end_expedition(uuid) to authenticated;
grant execute on function public.expedition_pack(uuid) to authenticated;
grant execute on function public.create_path_group(text, text) to authenticated;
grant execute on function public.advance_group_course(uuid, text) to authenticated;
grant execute on function public.group_invite_preview(text) to authenticated;
