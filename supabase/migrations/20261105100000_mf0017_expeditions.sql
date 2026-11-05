-- MF-0017: Group Expedition (CONTEXT.md Expedition). A group admin starts a 7-day goal: N correct
-- recalls in one domain of the group's pack, counted over every current member since they joined.
--
--   * Group totals only (Q5): members never read the table. `public.expeditions` has NO grant for
--     anon/authenticated (a SELECT grant would need a line in the frozen MF-0005 allow-list); they read
--     through definer functions that check membership on auth.uid() and return one row / one integer.
--   * C-2 (user, 2026-11-05): total − own = the others' sum, so expeditions exist only in groups of at
--     least 4 members (3 besides any viewer). Start and progress both refuse smaller groups (P0001).
--   * One active expedition per group: an exclusion constraint over the [starts_at, ends_at) range, so
--     two concurrent starts cannot both commit (23P01). The database sets both times.
--   * C-1 (user, 2026-11-05): the progress count re-states the MF-0007 rule of
--     src/engine/memory/countable.ts in SQL (not on a rejected item; strictly before THIS member's first
--     review of it). The engine stays the owner; the SC-2 parity test pins the two together.
--   * Review B1 (user, 2026-11-05): a member's recalls count only from when they joined the group.
--   * Accepted residual (user, 2026-11-05): alt accounts can fill a group to 4 (as for MF-0011).

create extension if not exists btree_gist with schema extensions;

create table public.expeditions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  domain_code text not null check (char_length(domain_code) between 1 and 32),
  target integer not null check (target between 10 and 1000),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_by uuid not null references auth.users (id) on delete cascade,
  constraint expeditions_seven_days check (ends_at = starts_at + interval '7 days'),
  constraint expeditions_one_active exclude using gist (
    group_id with =,
    tstzrange(starts_at, ends_at) with &&
  )
);

-- RLS on with no policy: nothing reaches the table except the definer functions below.
alter table public.expeditions enable row level security;
revoke all on public.expeditions from public, anon, authenticated;

create index expeditions_group_latest_idx on public.expeditions (group_id, starts_at desc);
create index expeditions_created_by_idx on public.expeditions (created_by);

-- ── start ─────────────────────────────────────────────────────────────────────
create function private.start_expedition(p_group_id uuid, p_domain_code text, p_target integer)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_pack text;
  v_id uuid;
begin
  if v_uid is null or not private.is_admin(p_group_id) then
    raise exception 'only the group admin can start an expedition' using errcode = '42501';
  end if;

  if (select count(*) from public.group_members m where m.group_id = p_group_id) < 4 then
    raise exception 'expeditions need at least 4 members' using errcode = 'P0001';
  end if;

  select g.pack_slug into v_pack from public.groups g where g.id = p_group_id;

  if p_target is null or p_target not between 10 and 1000 then
    raise exception 'target must be a whole number from 10 to 1000' using errcode = '22023';
  end if;

  if p_domain_code is null or not exists (
    select 1 from private.pack_skills ps
    where ps.pack_slug = v_pack and ps.domain_code = p_domain_code
  ) then
    raise exception 'domain is not part of this group''s pack' using errcode = '22023';
  end if;

  -- No pre-check for an active one: the exclusion constraint raises 23P01, also under a race.
  insert into public.expeditions (group_id, domain_code, target, starts_at, ends_at, created_by)
  values (p_group_id, p_domain_code, p_target, now(), now() + interval '7 days', v_uid)
  returning id into v_id;

  return v_id;
end;
$$;

-- ── latest (the card's row) ───────────────────────────────────────────────────
create function private.latest_expedition(p_group_id uuid)
returns table (id uuid, domain_code text, target integer, starts_at timestamptz, ends_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not private.is_member(p_group_id) then
    raise exception 'not a member of this group' using errcode = '42501';
  end if;

  return query
    select e.id, e.domain_code, e.target, e.starts_at, e.ends_at
    from public.expeditions e
    where e.group_id = p_group_id
    order by e.starts_at desc
    limit 1;
end;
$$;

-- ── progress (one integer, never per member) ──────────────────────────────────
create function private.expedition_progress(p_expedition_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_group uuid;
  v_pack text;
  v_domain text;
  v_starts timestamptz;
  v_ends timestamptz;
  v_count integer;
begin
  select e.group_id, g.pack_slug, e.domain_code, e.starts_at, e.ends_at
    into v_group, v_pack, v_domain, v_starts, v_ends
  from public.expeditions e
  join public.groups g on g.id = e.group_id
  where e.id = p_expedition_id;

  -- An unknown id and a group the caller isn't in look the same: no existence oracle.
  if v_group is null or (select auth.uid()) is null or not private.is_member(v_group) then
    raise exception 'not a member of this group' using errcode = '42501';
  end if;

  if (select count(*) from public.group_members m where m.group_id = v_group) < 4 then
    raise exception 'expeditions need at least 4 members' using errcode = 'P0001';
  end if;

  select count(*)::integer into v_count
  from public.attempts a
  -- Review B1 (user 2026-11-05): only recalls made since joining. Otherwise a join makes the total
  -- jump by exactly the joiner's own count, a per-member figure the member list makes attributable.
  join public.group_members m
    on m.user_id = a.user_id and m.group_id = v_group and a.answered_at >= m.joined_at
  join private.pack_skills ps on ps.pack_slug = a.pack_slug and ps.skill_code = a.skill_code
  where a.pack_slug = v_pack
    and ps.domain_code = v_domain
    and a.correct
    and a.answered_at >= v_starts
    and a.answered_at < v_ends
    -- MF-0007 (countableAttempts): a rejected item never counts …
    and private.item_state(a.question_id) is distinct from 'rejected'
    -- … nor an attempt at or after THIS member first reviewed the item (reviewing shows the key).
    and not exists (
      select 1 from private.item_reviews v
      where v.item_id = a.question_id
        and v.reviewer_id = a.user_id
        and v.created_at <= a.answered_at
    );

  return v_count;
end;
$$;

-- ── public RPC surface (SECURITY INVOKER shims) ───────────────────────────────
create function public.start_expedition(p_group_id uuid, p_domain_code text, p_target integer)
returns uuid
language sql
volatile
security invoker
set search_path = ''
as $$ select private.start_expedition(p_group_id, p_domain_code, p_target); $$;

create function public.latest_expedition(p_group_id uuid)
returns table (id uuid, domain_code text, target integer, starts_at timestamptz, ends_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$ select * from private.latest_expedition(p_group_id); $$;

create function public.expedition_progress(p_expedition_id uuid)
returns integer
language sql
stable
security invoker
set search_path = ''
as $$ select private.expedition_progress(p_expedition_id); $$;

-- ── privileges: authenticated only (Supabase grants new functions to anon by default) ──
revoke execute on function private.start_expedition(uuid, text, integer) from public, anon, authenticated;
revoke execute on function private.latest_expedition(uuid) from public, anon, authenticated;
revoke execute on function private.expedition_progress(uuid) from public, anon, authenticated;
revoke execute on function public.start_expedition(uuid, text, integer) from public, anon;
revoke execute on function public.latest_expedition(uuid) from public, anon;
revoke execute on function public.expedition_progress(uuid) from public, anon;

grant execute on function private.start_expedition(uuid, text, integer) to authenticated;
grant execute on function private.latest_expedition(uuid) to authenticated;
grant execute on function private.expedition_progress(uuid) to authenticated;
grant execute on function public.start_expedition(uuid, text, integer) to authenticated;
grant execute on function public.latest_expedition(uuid) to authenticated;
grant execute on function public.expedition_progress(uuid) to authenticated;
