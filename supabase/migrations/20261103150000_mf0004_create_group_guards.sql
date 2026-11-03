-- MF-0004: create_group refuses unknown learning packs and caps groups per creator.
--
--   * private.packs: the registered pack slugs, one row per packs/<slug>/ folder, written by
--     scripts/sync-question-keys.mjs (run after every deploy, see docs/runbook/deploy.md).
--     Unreadable by clients: RLS on, no policies, no grants. Only definer functions read it.
--   * private.create_group: same contract as MF-0002, plus
--       - unknown slug           -> errcode 22023 (invalid_parameter_value)
--       - 10 groups already made -> errcode 54000 (program_limit_exceeded)
--     A per-creator advisory lock serialises concurrent calls, so the cap can't be raced.
--     `create or replace` keeps the function's owner and EXECUTE grants from MF-0002.

-- ── pack registry (private) ────────────────────────────────────────────────────
create table private.packs (
  slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  updated_at timestamptz not null default now()
);

alter table private.packs enable row level security;
revoke all on private.packs from public, anon, authenticated;

-- ── create_group with pack + cap guards ────────────────────────────────────────
create or replace function private.create_group(p_name text, p_pack_slug text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_group_id uuid;
  v_max_groups constant integer := 10; -- shown to users as MAX_GROUPS_PER_USER (src/features/groups/utils/rpc-errors.ts)
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if not exists (select 1 from private.packs p where p.slug = p_pack_slug) then
    raise exception 'unknown learning pack' using errcode = '22023';
  end if;

  -- One creator at a time, so two parallel calls cannot both see 9 and make 11.
  perform pg_advisory_xact_lock(hashtextextended('mf.create_group:' || v_uid::text, 0));

  if (select count(*) from public.groups g where g.created_by = v_uid) >= v_max_groups then
    raise exception 'group limit reached (% per user)', v_max_groups using errcode = '54000';
  end if;

  insert into public.groups (name, pack_slug, invite_code, created_by)
  values (btrim(p_name), p_pack_slug, private.new_invite_code(), v_uid)
  returning id into v_group_id;
  insert into public.group_members (group_id, user_id, role)
  values (v_group_id, v_uid, 'admin');
  return v_group_id;
end;
$$;
