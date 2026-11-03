-- MF-0002: profiles, study groups and membership, isolated by RLS.
--
-- Access model (docs/MINDFORGE.md §1.6, .planning/tasks/MF-0002/GOAL.md):
--   * a learner reads/edits their own profile and reads profiles of people sharing a group;
--   * a group and its member list are visible to its members only (incl. the invite code);
--   * only the group admin renames it or rotates the invite code;
--   * creating a group and joining by code go through SECURITY DEFINER functions in the
--     non-exposed `private` schema, called via SECURITY INVOKER wrappers in `public`;
--   * nothing is granted to `anon`; there are no direct INSERT/DELETE grants at all.

-- ── private schema ─────────────────────────────────────────────────────────────
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- ── tables ─────────────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  created_at timestamptz not null default now()
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  pack_slug text not null check (pack_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  invite_code text not null unique,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index group_members_user_id_idx on public.group_members (user_id);
create index groups_created_by_idx on public.groups (created_by);

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;

-- ── membership helpers (SECURITY DEFINER to avoid RLS recursion on group_members) ──
create function private.is_member(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members m
    where m.group_id = p_group_id and m.user_id = (select auth.uid())
  );
$$;

create function private.is_admin(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members m
    where m.group_id = p_group_id and m.user_id = (select auth.uid()) and m.role = 'admin'
  );
$$;

create function private.shares_group(p_other_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members mine
    join public.group_members theirs on theirs.group_id = mine.group_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = p_other_user
  );
$$;

create function private.new_invite_code()
returns text
language sql
volatile
set search_path = ''
as $$
  select replace(gen_random_uuid()::text, '-', '');
$$;

-- ── privileged operations ──────────────────────────────────────────────────────
create function private.create_group(p_name text, p_pack_slug text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_group_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  insert into public.groups (name, pack_slug, invite_code, created_by)
  values (btrim(p_name), p_pack_slug, private.new_invite_code(), v_uid)
  returning id into v_group_id;
  insert into public.group_members (group_id, user_id, role)
  values (v_group_id, v_uid, 'admin');
  return v_group_id;
end;
$$;

create function private.join_group(p_code text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_group_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select g.id into v_group_id from public.groups g where g.invite_code = p_code;
  if v_group_id is null then
    raise exception 'invalid invite code' using errcode = 'P0002';
  end if;
  insert into public.group_members (group_id, user_id, role)
  values (v_group_id, v_uid, 'member')
  on conflict (group_id, user_id) do nothing;
  return v_group_id;
end;
$$;

create function private.rotate_invite_code(p_group_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  if (select auth.uid()) is null or not private.is_admin(p_group_id) then
    raise exception 'only the group admin can rotate the invite link' using errcode = '42501';
  end if;
  update public.groups set invite_code = private.new_invite_code()
  where id = p_group_id
  returning invite_code into v_code;
  return v_code;
end;
$$;

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(nullif(split_part(new.email, '@', 1), ''), 'learner'), 60))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ── public RPC surface (SECURITY INVOKER wrappers) ────────────────────────────
create function public.create_group(p_name text, p_pack_slug text)
returns uuid
language sql
volatile
security invoker
set search_path = ''
as $$ select private.create_group(p_name, p_pack_slug); $$;

create function public.join_group(p_code text)
returns uuid
language sql
volatile
security invoker
set search_path = ''
as $$ select private.join_group(p_code); $$;

create function public.rotate_invite_code(p_group_id uuid)
returns text
language sql
volatile
security invoker
set search_path = ''
as $$ select private.rotate_invite_code(p_group_id); $$;

-- ── function privileges: nothing for PUBLIC/anon; authenticated gets what it needs ──
revoke execute on all functions in schema private from public, anon, authenticated;
revoke execute on function public.create_group(text, text) from public, anon;
revoke execute on function public.join_group(text) from public, anon;
revoke execute on function public.rotate_invite_code(uuid) from public, anon;

grant execute on function public.create_group(text, text) to authenticated;
grant execute on function public.join_group(text) to authenticated;
grant execute on function public.rotate_invite_code(uuid) to authenticated;
grant execute on function private.create_group(text, text) to authenticated;
grant execute on function private.join_group(text) to authenticated;
grant execute on function private.rotate_invite_code(uuid) to authenticated;
grant execute on function private.is_member(uuid) to authenticated;
grant execute on function private.is_admin(uuid) to authenticated;
grant execute on function private.shares_group(uuid) to authenticated;
-- private.new_invite_code and private.handle_new_user run only inside definer functions/triggers.

-- ── table privileges (no anon; column-level UPDATE; no INSERT/DELETE) ──────────
revoke all on public.profiles, public.groups, public.group_members from anon, authenticated;
grant select, update (display_name) on public.profiles to authenticated;
grant select, update (name) on public.groups to authenticated;
grant select on public.group_members to authenticated;

-- ── policies ───────────────────────────────────────────────────────────────────
create policy "profiles: read own or shared-group"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.shares_group(id));

create policy "profiles: update own"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "groups: members read"
  on public.groups for select to authenticated
  using (private.is_member(id));

create policy "groups: admin updates"
  on public.groups for update to authenticated
  using (private.is_admin(id))
  with check (private.is_admin(id));

create policy "group_members: members read"
  on public.group_members for select to authenticated
  using (private.is_member(group_id));
