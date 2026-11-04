-- MF-0007: Pollination. Learners review pack items; review state is DERIVED, never stored (ADR 0001).
--
--   * private.items: the item registry (id, pack, skill, type, content hash, origin, author email),
--     written by scripts/sync-question-keys.mjs. Reviews bind to (item_id, content_hash): a new
--     hash makes the item unreviewed again, and old reviews stop counting.
--   * private.content_maintainers: per pack, keyed by email so a maintainer can be listed before
--     first sign-in. Edited by SQL only; seeded empty (the Owner adds people).
--   * private.item_reviews / flag_resolutions / analogy_approvals: what people did, per version.
--   * Every table: RLS on, revoke all, NO grants, NO policies. Clients reach them only through
--     private.* SECURITY DEFINER functions (search_path = '', auth.uid() required) called via
--     public.* SECURITY INVOKER shims, EXECUTE for `authenticated` only (MF-0003 pattern), so the
--     MF-0005 grants allow-list is unchanged.
--   * Review finding (blocking): every verdict names the version its actor READ (p_content_hash,
--     the hash of the deployed file). A mismatch with the registry's current hash is refused
--     (55000), so a sync that runs ahead of a deploy can't bind a verdict to unread content.
--     NULL skips the check for SQL callers and the frozen tests; the app always sends it.
--   * review_item / resolve_flags lock the item row and stamp clock_timestamp(), so a flag and a
--     dismiss are ordered by when they were written, not by when their transaction began.
--   * Emails never leave the database: author and maintainer checks compare them inside definer
--     functions. A flagger's identity (display name) is returned to maintainers only.
--
-- State of an item for its CURRENT hash, first match wins:
--   1 a 'reject' resolution                              -> rejected
--   2 a flag newer than the latest 'dismiss'             -> flagged
--   3 origin = 'official'                                -> approved
--   4 >= 2 distinct approvers (+ analogy approval, cards) -> approved
--   5 otherwise                                           -> unreviewed

-- ── tables ─────────────────────────────────────────────────────────────────────
create table private.items (
  item_id text primary key check (char_length(item_id) between 1 and 200),
  pack_slug text not null check (pack_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  skill_code text not null check (char_length(skill_code) between 1 and 32),
  item_type text not null check (item_type in ('question', 'card', 'diagram')),
  content_hash text not null check (char_length(content_hash) between 1 and 128),
  origin text not null check (origin in ('official', 'human', 'ai')),
  author_email text check (author_email is null or char_length(author_email) between 3 and 320),
  -- C-3: when the CURRENT hash first appeared; the 48 h analogy fallback counts from here.
  hash_synced_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index items_pack_slug_idx on private.items (pack_slug);

create table private.content_maintainers (
  pack_slug text not null check (pack_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  email text not null check (char_length(email) between 3 and 320),
  is_analogy_owner boolean not null default false,
  primary key (pack_slug, email)
);

create table private.item_reviews (
  id bigint generated always as identity primary key,
  item_id text not null references private.items (item_id) on delete cascade,
  content_hash text not null,
  reviewer_id uuid not null references auth.users (id) on delete cascade,
  verdict text not null check (verdict in ('approve', 'flag')),
  comment text check (comment is null or char_length(comment) between 1 and 2000),
  created_at timestamptz not null default now(),
  constraint item_reviews_flag_has_comment check (verdict <> 'flag' or comment is not null)
);

-- SC-3: approving the same version twice counts once. Flags may repeat (a re-flag after a dismiss).
create unique index item_reviews_one_approval_idx
  on private.item_reviews (item_id, content_hash, reviewer_id) where verdict = 'approve';
create index item_reviews_item_hash_idx on private.item_reviews (item_id, content_hash);
create index item_reviews_reviewer_idx on private.item_reviews (reviewer_id, item_id);

create table private.flag_resolutions (
  id bigint generated always as identity primary key,
  item_id text not null references private.items (item_id) on delete cascade,
  content_hash text not null,
  action text not null check (action in ('dismiss', 'reject')),
  comment text not null check (char_length(comment) between 1 and 2000),
  -- set null, not cascade: deleting a maintainer's account must not un-reject an item
  resolved_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index flag_resolutions_item_hash_idx on private.flag_resolutions (item_id, content_hash);
create index flag_resolutions_resolved_by_idx on private.flag_resolutions (resolved_by);

create table private.analogy_approvals (
  item_id text not null references private.items (item_id) on delete cascade,
  content_hash text not null,
  approved_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (item_id, content_hash)
);

create index analogy_approvals_approved_by_idx on private.analogy_approvals (approved_by);

alter table private.items enable row level security;
alter table private.content_maintainers enable row level security;
alter table private.item_reviews enable row level security;
alter table private.flag_resolutions enable row level security;
alter table private.analogy_approvals enable row level security;
revoke all on private.items from public, anon, authenticated;
revoke all on private.content_maintainers from public, anon, authenticated;
revoke all on private.item_reviews from public, anon, authenticated;
revoke all on private.flag_resolutions from public, anon, authenticated;
revoke all on private.analogy_approvals from public, anon, authenticated;

-- ── helpers (definer-internal; nobody but the owner executes them) ─────────────
create function private.caller_email()
returns text
language sql
stable
security definer
set search_path = ''
as $$ select lower(u.email) from auth.users u where u.id = (select auth.uid()); $$;

create function private.is_pack_member(p_pack_slug text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members m
    join public.groups g on g.id = m.group_id
    where g.pack_slug = p_pack_slug and m.user_id = (select auth.uid())
  );
$$;

create function private.is_content_maintainer(p_pack_slug text, p_analogy_owner_only boolean)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.content_maintainers c
    where c.pack_slug = p_pack_slug
      and lower(c.email) = private.caller_email()
      and (c.is_analogy_owner or not p_analogy_owner_only)
  );
$$;

create function private.item_state(p_item_id text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  with i as (
    select * from private.items where item_id = p_item_id
  ),
  last_dismiss as (
    select max(r.created_at) as at from private.flag_resolutions r, i
    where r.item_id = i.item_id and r.content_hash = i.content_hash and r.action = 'dismiss'
  )
  select case
    when exists (
      select 1 from private.flag_resolutions r
      where r.item_id = i.item_id and r.content_hash = i.content_hash and r.action = 'reject'
    ) then 'rejected'
    when exists (
      select 1 from private.item_reviews v, last_dismiss d
      where v.item_id = i.item_id and v.content_hash = i.content_hash and v.verdict = 'flag'
        and (d.at is null or v.created_at > d.at)
    ) then 'flagged'
    when i.origin = 'official' then 'approved'
    when (
      select count(distinct v.reviewer_id) from private.item_reviews v
      where v.item_id = i.item_id and v.content_hash = i.content_hash and v.verdict = 'approve'
    ) >= 2
      and (
        i.item_type <> 'card'
        or exists (
          select 1 from private.analogy_approvals a
          where a.item_id = i.item_id and a.content_hash = i.content_hash
        )
      ) then 'approved'
    else 'unreviewed'
  end
  from i;
$$;

-- ── review_item: approve or flag the current version ───────────────────────────
create function private.review_item(p_item_id text, p_verdict text, p_comment text, p_content_hash text default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_item private.items%rowtype;
  v_comment text := nullif(btrim(p_comment), '');
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_verdict is null or p_verdict not in ('approve', 'flag') then
    raise exception 'verdict must be approve or flag' using errcode = '22023';
  end if;

  select * into v_item from private.items i where i.item_id = p_item_id for update;
  if not found then
    raise exception 'unknown item' using errcode = 'P0002';
  end if;
  if not private.is_pack_member(v_item.pack_slug) then
    raise exception 'join a group for this pack to review it' using errcode = '42501';
  end if;
  if p_verdict = 'approve' and lower(v_item.author_email) = private.caller_email() then
    raise exception 'authors cannot approve their own items' using errcode = '42501';
  end if;
  if p_verdict = 'flag' and (v_comment is null or char_length(v_comment) > 2000) then
    raise exception 'a flag needs a comment (1-2000 characters)' using errcode = '22023';
  end if;
  if p_content_hash is not null and p_content_hash <> v_item.content_hash then
    raise exception 'item changed since it was read' using errcode = '55000';
  end if;
  if private.item_state(v_item.item_id) = 'rejected' then
    raise exception 'item is rejected' using errcode = '55000';
  end if;

  if p_verdict = 'approve' then
    insert into private.item_reviews (item_id, content_hash, reviewer_id, verdict, created_at)
    values (v_item.item_id, v_item.content_hash, v_uid, 'approve', clock_timestamp())
    on conflict (item_id, content_hash, reviewer_id) where verdict = 'approve' do nothing;
  else
    insert into private.item_reviews (item_id, content_hash, reviewer_id, verdict, comment, created_at)
    values (v_item.item_id, v_item.content_hash, v_uid, 'flag', v_comment, clock_timestamp());
  end if;
end;
$$;

-- ── resolve_flags: a maintainer dismisses open flags or rejects the version ────
create function private.resolve_flags(p_item_id text, p_action text, p_comment text, p_content_hash text default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_item private.items%rowtype;
  v_comment text := nullif(btrim(p_comment), '');
  v_state text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_action is null or p_action not in ('dismiss', 'reject') then
    raise exception 'action must be dismiss or reject' using errcode = '22023';
  end if;

  select * into v_item from private.items i where i.item_id = p_item_id for update;
  if not found then
    raise exception 'unknown item' using errcode = 'P0002';
  end if;
  if not private.is_content_maintainer(v_item.pack_slug, false) then
    raise exception 'only content maintainers resolve flags' using errcode = '42501';
  end if;
  if p_content_hash is not null and p_content_hash <> v_item.content_hash then
    raise exception 'item changed since it was read' using errcode = '55000';
  end if;
  if v_comment is null or char_length(v_comment) > 2000 then
    raise exception 'a resolution needs a comment (1-2000 characters)' using errcode = '22023';
  end if;

  v_state := private.item_state(v_item.item_id);
  if v_state = 'rejected' then
    raise exception 'item is already rejected' using errcode = '55000';
  end if;
  if p_action = 'dismiss' and v_state <> 'flagged' then
    raise exception 'no open flag to dismiss' using errcode = '55000';
  end if;

  insert into private.flag_resolutions (item_id, content_hash, action, comment, resolved_by, created_at)
  values (v_item.item_id, v_item.content_hash, p_action, v_comment, v_uid, clock_timestamp());
end;
$$;

-- ── approve_analogy: the analogy owner, or any maintainer after 48 h (C-3) ─────
create function private.approve_analogy(p_item_id text, p_content_hash text default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_item private.items%rowtype;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select * into v_item from private.items i where i.item_id = p_item_id;
  if not found then
    raise exception 'unknown item' using errcode = 'P0002';
  end if;
  if v_item.item_type <> 'card' then
    raise exception 'only nature cards need an analogy approval' using errcode = '22023';
  end if;
  if p_content_hash is not null and p_content_hash <> v_item.content_hash then
    raise exception 'item changed since it was read' using errcode = '55000';
  end if;
  if not (
    private.is_content_maintainer(v_item.pack_slug, true)
    or (
      private.is_content_maintainer(v_item.pack_slug, false)
      and now() >= v_item.hash_synced_at + interval '48 hours'
    )
  ) then
    raise exception 'only the analogy owner, or a maintainer after 48 hours' using errcode = '42501';
  end if;

  insert into private.analogy_approvals (item_id, content_hash, approved_by)
  values (v_item.item_id, v_item.content_hash, v_uid)
  on conflict (item_id, content_hash) do nothing;
end;
$$;

-- ── review_states: every item's state + when the caller first reviewed it ──────
-- States aren't secret and the duel serves any signed-in learner, so no membership check.
create function private.review_states(p_pack_slug text)
returns table (item_id text, state text, reviewed_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  return query
    select i.item_id,
           private.item_state(i.item_id),
           (select min(v.created_at) from private.item_reviews v
            where v.item_id = i.item_id and v.reviewer_id = v_uid)
    from private.items i
    where i.pack_slug = p_pack_slug
    order by i.item_id;
end;
$$;

-- ── list_reviewable: the caller's queue (unreviewed, not mine, not reviewed by me) ──
create function private.list_reviewable(p_pack_slug text)
returns table (item_id text, skill_code text, item_type text, content_hash text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_email text := private.caller_email();
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if not private.is_pack_member(p_pack_slug) then
    raise exception 'join a group for this pack to review it' using errcode = '42501';
  end if;
  return query
    select i.item_id, i.skill_code, i.item_type, i.content_hash
    from private.items i
    where i.pack_slug = p_pack_slug
      and (i.author_email is null or lower(i.author_email) <> v_email)
      and not exists (
        select 1 from private.item_reviews v
        where v.item_id = i.item_id and v.content_hash = i.content_hash and v.reviewer_id = v_uid
      )
      and private.item_state(i.item_id) = 'unreviewed'
    order by i.item_id;
end;
$$;

-- ── list_open_flags: maintainers only; the one place a flagger is named ────────
create function private.list_open_flags(p_pack_slug text)
returns table (item_id text, flag_id bigint, comment text, reviewer_name text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not private.is_content_maintainer(p_pack_slug, false) then
    raise exception 'only content maintainers see flags' using errcode = '42501';
  end if;
  return query
    select v.item_id, v.id, v.comment, p.display_name, v.created_at
    from private.items i
    join private.item_reviews v
      on v.item_id = i.item_id and v.content_hash = i.content_hash and v.verdict = 'flag'
    left join public.profiles p on p.id = v.reviewer_id
    where i.pack_slug = p_pack_slug
      and private.item_state(i.item_id) = 'flagged'
      and v.created_at > coalesce(
        (select max(r.created_at) from private.flag_resolutions r
         where r.item_id = i.item_id and r.content_hash = i.content_hash and r.action = 'dismiss'),
        '-infinity'::timestamptz)
    order by v.created_at, v.id;
end;
$$;

-- ── list_pending_analogies: maintainers only; cards whose version lacks the analogy approval ──
create function private.list_pending_analogies(p_pack_slug text)
returns table (item_id text, approvals bigint, hash_synced_at timestamptz, can_approve boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_is_owner boolean;
begin
  if (select auth.uid()) is null or not private.is_content_maintainer(p_pack_slug, false) then
    raise exception 'only content maintainers see pending analogies' using errcode = '42501';
  end if;
  v_is_owner := private.is_content_maintainer(p_pack_slug, true);
  return query
    select i.item_id,
           (select count(distinct v.reviewer_id) from private.item_reviews v
            where v.item_id = i.item_id and v.content_hash = i.content_hash and v.verdict = 'approve'),
           i.hash_synced_at,
           v_is_owner or now() >= i.hash_synced_at + interval '48 hours'
    from private.items i
    where i.pack_slug = p_pack_slug
      and i.item_type = 'card'
      and i.origin <> 'official'
      and not exists (
        select 1 from private.analogy_approvals a
        where a.item_id = i.item_id and a.content_hash = i.content_hash
      )
      and private.item_state(i.item_id) not in ('flagged', 'rejected')
    order by i.item_id;
end;
$$;

-- ── public shims (SECURITY INVOKER) ────────────────────────────────────────────
create function public.review_item(p_item_id text, p_verdict text, p_comment text, p_content_hash text default null)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.review_item(p_item_id, p_verdict, p_comment, p_content_hash); $$;

create function public.resolve_flags(p_item_id text, p_action text, p_comment text, p_content_hash text default null)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.resolve_flags(p_item_id, p_action, p_comment, p_content_hash); $$;

create function public.approve_analogy(p_item_id text, p_content_hash text default null)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.approve_analogy(p_item_id, p_content_hash); $$;

create function public.review_states(p_pack_slug text)
returns table (item_id text, state text, reviewed_at timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.review_states(p_pack_slug); $$;

create function public.list_reviewable(p_pack_slug text)
returns table (item_id text, skill_code text, item_type text, content_hash text)
language sql stable security invoker set search_path = ''
as $$ select * from private.list_reviewable(p_pack_slug); $$;

create function public.list_open_flags(p_pack_slug text)
returns table (item_id text, flag_id bigint, comment text, reviewer_name text, created_at timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.list_open_flags(p_pack_slug); $$;

create function public.list_pending_analogies(p_pack_slug text)
returns table (item_id text, approvals bigint, hash_synced_at timestamptz, can_approve boolean)
language sql stable security invoker set search_path = ''
as $$ select * from private.list_pending_analogies(p_pack_slug); $$;

-- ── privileges ─────────────────────────────────────────────────────────────────
-- internal helpers: owner only
revoke execute on function private.caller_email() from public, anon, authenticated;
revoke execute on function private.is_pack_member(text) from public, anon, authenticated;
revoke execute on function private.is_content_maintainer(text, boolean) from public, anon, authenticated;
revoke execute on function private.item_state(text) from public, anon, authenticated;

-- entry points: authenticated only (private target + public shim)
revoke execute on function private.review_item(text, text, text, text) from public, anon, authenticated;
revoke execute on function private.resolve_flags(text, text, text, text) from public, anon, authenticated;
revoke execute on function private.approve_analogy(text, text) from public, anon, authenticated;
revoke execute on function private.review_states(text) from public, anon, authenticated;
revoke execute on function private.list_reviewable(text) from public, anon, authenticated;
revoke execute on function private.list_open_flags(text) from public, anon, authenticated;
revoke execute on function private.list_pending_analogies(text) from public, anon, authenticated;
grant execute on function private.review_item(text, text, text, text) to authenticated;
grant execute on function private.resolve_flags(text, text, text, text) to authenticated;
grant execute on function private.approve_analogy(text, text) to authenticated;
grant execute on function private.review_states(text) to authenticated;
grant execute on function private.list_reviewable(text) to authenticated;
grant execute on function private.list_open_flags(text) to authenticated;
grant execute on function private.list_pending_analogies(text) to authenticated;

revoke execute on function public.review_item(text, text, text, text) from public, anon;
revoke execute on function public.resolve_flags(text, text, text, text) from public, anon;
revoke execute on function public.approve_analogy(text, text) from public, anon;
revoke execute on function public.review_states(text) from public, anon;
revoke execute on function public.list_reviewable(text) from public, anon;
revoke execute on function public.list_open_flags(text) from public, anon;
revoke execute on function public.list_pending_analogies(text) from public, anon;
grant execute on function public.review_item(text, text, text, text) to authenticated;
grant execute on function public.resolve_flags(text, text, text, text) to authenticated;
grant execute on function public.approve_analogy(text, text) to authenticated;
grant execute on function public.review_states(text) to authenticated;
grant execute on function public.list_reviewable(text) to authenticated;
grant execute on function public.list_open_flags(text) to authenticated;
grant execute on function public.list_pending_analogies(text) to authenticated;
