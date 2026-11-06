-- MF-0054: a learner pins up to 3 of their own study groups to the sidebar.
--
-- Access model (.planning/tasks/MF-0054/GOAL.md, C-3):
--   * a pin is private to its owner: the table lives in `private` with no grants at all, so neither
--     co-members nor the owner read it directly; SECURITY DEFINER functions scoped to auth.uid() do;
--   * a pin exists only while its owner is a member (FK to group_members, on delete cascade);
--   * at most 3 pins per learner, for every writer: pinning a 4th deletes the oldest (pinned_at, group_id)
--     in the same transaction, under a per-user advisory lock so two concurrent pins cannot both see 2;
--   * pinned_at defaults to clock_timestamp(): the seed pins several groups inside ONE transaction, where
--     now() would tie.

create table private.group_pins (
  user_id uuid not null,
  group_id uuid not null,
  pinned_at timestamptz not null default clock_timestamp(),
  primary key (user_id, group_id),
  foreign key (group_id, user_id)
    references public.group_members (group_id, user_id) on delete cascade
);

-- the cascade from group_members looks pins up by (group_id, user_id)
create index group_pins_group_user_idx on private.group_pins (group_id, user_id);

alter table private.group_pins enable row level security;
revoke all on private.group_pins from public, anon, authenticated;
-- no policies: only the definer functions below touch the table.

-- ── the one write path (the action through pin_group, and the dev seed as postgres) ──
create function private.pin_group_for(p_user_id uuid, p_group_id uuid)
returns table (evicted_id uuid, evicted_name text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_evicted uuid;
begin
  -- serialise every pin write of one learner: the cap check below must see the other's COMMIT
  perform pg_advisory_xact_lock(hashtextextended('mf0054:pins:' || p_user_id::text, 0));

  if not exists (
    select 1 from public.group_members m
    where m.group_id = p_group_id and m.user_id = p_user_id
  ) then
    raise exception 'not a member of this group' using errcode = '42501';
  end if;

  if exists (
    select 1 from private.group_pins p
    where p.user_id = p_user_id and p.group_id = p_group_id
  ) then
    return; -- already pinned: keep its pinned_at, evict nothing
  end if;

  if (select count(*) from private.group_pins p where p.user_id = p_user_id) >= 3 then
    delete from private.group_pins p
    where p.user_id = p_user_id
      and p.group_id = (
        select o.group_id from private.group_pins o
        where o.user_id = p_user_id
        order by o.pinned_at, o.group_id
        limit 1
      )
    returning p.group_id into v_evicted;
  end if;

  insert into private.group_pins (user_id, group_id) values (p_user_id, p_group_id);

  if v_evicted is not null then
    return query select g.id, g.name from public.groups g where g.id = v_evicted;
  end if;
end;
$$;

create function private.pin_group(p_group_id uuid)
returns table (evicted_id uuid, evicted_name text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  return query select * from private.pin_group_for(v_uid, p_group_id);
end;
$$;

create function private.unpin_group(p_group_id uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  delete from private.group_pins p
  where p.user_id = (select auth.uid()) and p.group_id = p_group_id;
$$;

create function private.list_my_pins()
returns table (group_id uuid, pinned_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.group_id, p.pinned_at from private.group_pins p
  where p.user_id = (select auth.uid())
  order by p.pinned_at desc, p.group_id desc;
$$;

-- ── public RPC surface (SECURITY INVOKER wrappers) ────────────────────────────
create function public.pin_group(p_group_id uuid)
returns table (evicted_id uuid, evicted_name text)
language sql
volatile
security invoker
set search_path = ''
as $$ select * from private.pin_group(p_group_id); $$;

create function public.unpin_group(p_group_id uuid)
returns void
language sql
volatile
security invoker
set search_path = ''
as $$ select private.unpin_group(p_group_id); $$;

create function public.list_my_pins()
returns table (group_id uuid, pinned_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$ select * from private.list_my_pins(); $$;

-- ── function privileges: nothing for PUBLIC/anon; pin_group_for for nobody but its owner ──
revoke execute on function private.pin_group_for(uuid, uuid) from public, anon, authenticated;
revoke execute on function private.pin_group(uuid) from public, anon;
revoke execute on function private.unpin_group(uuid) from public, anon;
revoke execute on function private.list_my_pins() from public, anon;
revoke execute on function public.pin_group(uuid) from public, anon;
revoke execute on function public.unpin_group(uuid) from public, anon;
revoke execute on function public.list_my_pins() from public, anon;

grant execute on function private.pin_group(uuid) to authenticated;
grant execute on function private.unpin_group(uuid) to authenticated;
grant execute on function private.list_my_pins() to authenticated;
grant execute on function public.pin_group(uuid) to authenticated;
grant execute on function public.unpin_group(uuid) to authenticated;
grant execute on function public.list_my_pins() to authenticated;
