-- MF-0013: Storms (timed exam simulations). The DATABASE owns the clock, the grade and the key.
--
--   * private.packs gains the exam timing (exam_questions, exam_minutes) and private.pack_skills maps
--     each skill to its domain. Both are written by scripts/sync-question-keys.mjs; start_storm needs
--     them to check a Boss Storm's domain and to set the deadline itself. RLS on, no grants.
--   * public.storms / public.storm_questions: a learner READS their own rows (RLS) and writes them
--     only through the private.* SECURITY DEFINER functions below (no INSERT/UPDATE/DELETE grants),
--     so the deadline, the stored answers and the grade cannot be forged.
--   * The deadline is DB now(): start_storm sets ends_at from the pack's exam timing and the count
--     (ceil(n * minutes * 60 / questions)); answer_storm_question refuses at now() >= ends_at (MF013).
--   * No key before the end (SC-4): answers are stored ungraded and the answer RPC returns void.
--     storm_questions.correct is written only by private.finalize_storm, in the same transaction
--     that sets finished_at; no storms column name contains "correct". Attempts (which grow the
--     visible forest) are written there too, so nothing during a storm signals correctness (C-4).
--   * Content binding: start and every answer name the hash the learner READ; it must equal the
--     stored hash and the registry's current one (55000). Finalising voids any question whose
--     registry hash moved (or whose item/key is gone): it is not scored and makes no attempt.
--   * Unanswered questions stay correct = null and make no attempt (C-3).
--   * Expired storms are finalised lazily (decided 2026-11-04): by finalize_expired_storms (called
--     on the learner's next storm read) and by start_storm.
--   * Start trust (decided 2026-11-04): the server composes the storm; the DB checks it is a valid
--     one (pack, kind, domain, count cap, no repeats, synced, playable, unspoiled, current hash).

-- ── pack exam timing + skill map (private) ─────────────────────────────────────
-- nullable: a pack without an exam has no storms, and start_storm refuses it
alter table private.packs
  add column exam_questions integer check (exam_questions > 0),
  add column exam_minutes integer check (exam_minutes > 0);

create table private.pack_skills (
  pack_slug text not null references private.packs (slug) on delete cascade,
  skill_code text not null check (char_length(skill_code) between 1 and 32),
  domain_code text not null check (char_length(domain_code) between 1 and 32),
  primary key (pack_slug, skill_code)
);

alter table private.pack_skills enable row level security;
revoke all on private.pack_skills from public, anon, authenticated;

-- ── storms ─────────────────────────────────────────────────────────────────────
-- SC-4: no column name may contain "correct" or "rationale"
create table public.storms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  pack_slug text not null check (pack_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  kind text not null check (kind in ('full', 'boss')),
  domain_code text check (domain_code is null or char_length(domain_code) between 1 and 32),
  started_at timestamptz not null,
  ends_at timestamptz not null,
  finished_at timestamptz,
  constraint storms_boss_has_domain check ((kind = 'boss') = (domain_code is not null)),
  constraint storms_ends_after_start check (ends_at > started_at),
  constraint storms_finished_after_start check (finished_at is null or finished_at >= started_at)
);

-- one running storm per learner (second guard behind start_storm's advisory lock)
create unique index storms_one_running_idx on public.storms (user_id) where finished_at is null;
create index storms_user_pack_started_idx on public.storms (user_id, pack_slug, started_at desc);

-- ── storm questions ────────────────────────────────────────────────────────────
create table public.storm_questions (
  storm_id uuid not null references public.storms (id) on delete cascade,
  -- denormalised: a one-predicate RLS policy and the "seen in an earlier storm" read
  user_id uuid not null references auth.users (id) on delete cascade,
  position smallint not null check (position >= 1),
  question_id text not null,
  skill_code text not null,
  domain_code text not null,
  content_hash text not null,
  unreviewed boolean not null,
  chosen text[] check (chosen is null or cardinality(chosen) between 1 and 10),
  chosen_at timestamptz,
  -- null until finish (SC-4); stays null for unanswered and voided questions
  correct boolean,
  voided boolean not null default false,
  primary key (storm_id, question_id),
  constraint storm_questions_position_key unique (storm_id, position),
  constraint storm_questions_chosen_at check ((chosen is null) = (chosen_at is null))
);

create index storm_questions_user_question_idx on public.storm_questions (user_id, question_id);

-- ── attempts.storm_id ──────────────────────────────────────────────────────────
alter table public.attempts
  add column storm_id uuid references public.storms (id) on delete set null;

-- covers the FK, and backstops a double finish writing the same attempt twice
create unique index attempts_storm_question_idx
  on public.attempts (storm_id, question_id) where storm_id is not null;

-- ── RLS + grants ───────────────────────────────────────────────────────────────
alter table public.storms enable row level security;
alter table public.storm_questions enable row level security;

revoke all on public.storms from public, anon, authenticated;
revoke all on public.storm_questions from public, anon, authenticated;
grant select on public.storms to authenticated;
grant select on public.storm_questions to authenticated;

create policy "storms: read own"
  on public.storms for select to authenticated
  using (user_id = (select auth.uid()));

create policy "storm_questions: read own"
  on public.storm_questions for select to authenticated
  using (user_id = (select auth.uid()));

-- ── internal helpers (owner only) ──────────────────────────────────────────────
-- exact set equality, same rule as private.record_attempt (MF-0003)
create function private.options_match(p_chosen text[], p_key text[])
returns boolean
language sql
immutable
security definer
set search_path = ''
as $$
  select array(select distinct c from unnest(p_chosen) c order by 1)
       = array(select distinct c from unnest(p_key) c order by 1);
$$;

-- Grades a storm and writes its attempts, once. Idempotent: a finished storm is a no-op.
-- Locks the storm row, so it is serialised with answer_storm_question and a second finish.
create function private.finalize_storm(p_storm_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_storm public.storms%rowtype;
begin
  select * into v_storm from public.storms s where s.id = p_storm_id for update;
  if not found or v_storm.finished_at is not null then
    return;
  end if;

  -- a. void questions whose content moved since start, or whose item or key is gone
  update public.storm_questions sq
  set voided = true, correct = null
  where sq.storm_id = p_storm_id
    and not exists (
      select 1 from private.items i
      join private.question_keys k on k.question_id = i.item_id
      where i.item_id = sq.question_id and i.content_hash = sq.content_hash
    );

  -- b. grade answered, unvoided questions by the DB key; unanswered keep correct = null (C-3)
  update public.storm_questions sq
  set correct = private.options_match(sq.chosen, k.correct_options)
  from private.question_keys k
  where sq.storm_id = p_storm_id
    and not sq.voided
    and sq.chosen is not null
    and k.question_id = sq.question_id;

  -- c. one attempt per graded question; pack and skill from the key row (C-4)
  insert into public.attempts (user_id, pack_slug, skill_code, question_id, chosen, correct, answered_at, storm_id)
  select v_storm.user_id, k.pack_slug, k.skill_code, k.question_id, sq.chosen, sq.correct, sq.chosen_at, sq.storm_id
  from public.storm_questions sq
  join private.question_keys k on k.question_id = sq.question_id
  where sq.storm_id = p_storm_id
    and not sq.voided
    and sq.chosen is not null
  order by sq.position;

  -- d. a storm finalised after its deadline ends at the deadline
  update public.storms s
  set finished_at = least(now(), v_storm.ends_at)
  where s.id = p_storm_id;
end;
$$;

-- ── start_storm ────────────────────────────────────────────────────────────────
-- trailing defaults (review): a full storm omits the domain; a missing p_questions is still refused below
create function private.start_storm(
  p_pack_slug text, p_kind text, p_domain_code text default null, p_questions jsonb default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_pack private.packs%rowtype;
  v_boss_size constant integer := 12; -- BOSS_STORM_SIZE in src/engine/storm
  v_cap integer;
  v_n integer;
  v_expired uuid;
  v_now timestamptz;
  v_seconds integer;
  v_storm_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select * into v_pack from private.packs p where p.slug = p_pack_slug;
  if not found or v_pack.exam_questions is null or v_pack.exam_minutes is null then
    raise exception 'this pack has no exam timing' using errcode = '22023';
  end if;

  if p_kind is null or p_kind not in ('full', 'boss') then
    raise exception 'kind must be full or boss' using errcode = '22023';
  end if;
  if p_kind = 'full' and p_domain_code is not null then
    raise exception 'a full storm has no domain' using errcode = '22023';
  end if;
  if p_kind = 'boss' and not exists (
    select 1 from private.pack_skills s
    where s.pack_slug = p_pack_slug and s.domain_code = p_domain_code
  ) then
    raise exception 'unknown domain for this pack' using errcode = '22023';
  end if;

  if p_questions is null or jsonb_typeof(p_questions) <> 'array' then
    raise exception 'questions must be an array' using errcode = '22023';
  end if;
  v_n := jsonb_array_length(p_questions);
  v_cap := case when p_kind = 'full' then v_pack.exam_questions else v_boss_size end;
  if v_n not between 1 and v_cap then
    raise exception 'a % storm holds 1 to % questions', p_kind, v_cap using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_questions) q(e)
    where jsonb_typeof(q.e) <> 'object'
       or jsonb_typeof(q.e -> 'question_id') is distinct from 'string'
       or jsonb_typeof(q.e -> 'content_hash') is distinct from 'string'
  ) then
    raise exception 'each question needs a question_id and a content_hash' using errcode = '22023';
  end if;
  if (select count(distinct q.e ->> 'question_id') from jsonb_array_elements(p_questions) q(e)) <> v_n then
    raise exception 'a question appears twice' using errcode = '22023';
  end if;

  -- synced, of this pack (and domain), playable, not spoiled by the caller (any hash)
  if exists (
    select 1
    from jsonb_array_elements(p_questions) q(e)
    left join private.items i on i.item_id = q.e ->> 'question_id'
    left join private.question_keys k on k.question_id = i.item_id
    left join private.pack_skills s on s.pack_slug = p_pack_slug and s.skill_code = k.skill_code
    where i.item_id is null
       or i.item_type <> 'question'
       or i.pack_slug <> p_pack_slug
       or k.question_id is null
       or k.pack_slug <> p_pack_slug
       or s.skill_code is null
       or (p_kind = 'boss' and s.domain_code <> p_domain_code)
       or private.item_state(i.item_id) in ('flagged', 'rejected')
       or exists (
         select 1 from private.item_reviews r
         where r.item_id = i.item_id and r.reviewer_id = v_uid
       )
  ) then
    raise exception 'not a playable question for this storm' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_questions) q(e)
    join private.items i on i.item_id = q.e ->> 'question_id'
    where i.content_hash <> q.e ->> 'content_hash'
  ) then
    raise exception 'item changed since it was read' using errcode = '55000';
  end if;

  -- one learner at a time: two parallel starts cannot both find no running storm
  perform pg_advisory_xact_lock(hashtextextended('storm:' || v_uid::text, 0));

  for v_expired in
    select s.id from public.storms s
    where s.user_id = v_uid and s.finished_at is null and s.ends_at <= now()
  loop
    perform private.finalize_storm(v_expired);
  end loop;

  if exists (select 1 from public.storms s where s.user_id = v_uid and s.finished_at is null) then
    raise exception 'a storm is already running' using errcode = '23505';
  end if;

  v_now := now();
  v_seconds := ceil(v_n * v_pack.exam_minutes * 60::numeric / v_pack.exam_questions)::integer;

  insert into public.storms (user_id, pack_slug, kind, domain_code, started_at, ends_at)
  values (v_uid, p_pack_slug, p_kind, p_domain_code, v_now, v_now + make_interval(secs => v_seconds))
  returning id into v_storm_id;

  insert into public.storm_questions
    (storm_id, user_id, position, question_id, skill_code, domain_code, content_hash, unreviewed)
  select v_storm_id, v_uid, q.pos::smallint, k.question_id, k.skill_code, s.domain_code,
         q.e ->> 'content_hash', private.item_state(k.question_id) = 'unreviewed'
  from jsonb_array_elements(p_questions) with ordinality q(e, pos)
  join private.question_keys k on k.question_id = q.e ->> 'question_id'
  join private.pack_skills s on s.pack_slug = p_pack_slug and s.skill_code = k.skill_code;

  return v_storm_id;
end;
$$;

-- ── answer_storm_question: store, change or clear (empty p_chosen) an answer, ungraded ──
create function private.answer_storm_question(p_storm_id uuid, p_question_id text, p_chosen text[], p_content_hash text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_storm public.storms%rowtype;
  v_stored_hash text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  -- one message for "missing" and "not yours"; the lock serialises with finalize_storm
  select * into v_storm from public.storms s
  where s.id = p_storm_id and s.user_id = v_uid
  for update;
  if not found then
    raise exception 'not your storm' using errcode = '42501';
  end if;
  if v_storm.finished_at is not null or now() >= v_storm.ends_at then
    raise exception 'the storm is over' using errcode = 'MF013';
  end if;

  -- empty = clear the answer (review: an unticked multi-select must reach the DB); null is refused
  if p_chosen is null or cardinality(p_chosen) > 10 then
    raise exception 'choose between 0 and 10 options' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(p_chosen) c where c is null or char_length(c) not between 1 and 8) then
    raise exception 'invalid option id' using errcode = '22023';
  end if;

  select sq.content_hash into v_stored_hash from public.storm_questions sq
  where sq.storm_id = p_storm_id and sq.question_id = p_question_id;
  if not found then
    raise exception 'not a question of this storm' using errcode = 'P0002';
  end if;

  -- the hash the learner READ must be the one the storm started with AND the registry's current one
  if p_content_hash is null
     or p_content_hash <> v_stored_hash
     or not exists (
       select 1 from private.items i
       where i.item_id = p_question_id and i.content_hash = p_content_hash
     ) then
    raise exception 'item changed since it was read' using errcode = '55000';
  end if;

  update public.storm_questions sq
  set chosen = case when cardinality(p_chosen) = 0 then null else p_chosen end,
      chosen_at = case when cardinality(p_chosen) = 0 then null else now() end
  where sq.storm_id = p_storm_id and sq.question_id = p_question_id;
end;
$$;

-- ── finish_storm: the learner ends early, or after the deadline; repeat = no-op ─
create function private.finish_storm(p_storm_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.storms s where s.id = p_storm_id and s.user_id = (select auth.uid())
  ) then
    raise exception 'not your storm' using errcode = '42501';
  end if;
  perform private.finalize_storm(p_storm_id);
end;
$$;

-- ── finalize_expired_storms: lazy finalisation of the caller's past-deadline storms ──
create function private.finalize_expired_storms()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_storm_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  for v_storm_id in
    select s.id from public.storms s
    where s.user_id = v_uid and s.finished_at is null and s.ends_at <= now()
  loop
    perform private.finalize_storm(v_storm_id);
  end loop;
end;
$$;

-- ── public shims (SECURITY INVOKER) ────────────────────────────────────────────
create function public.start_storm(
  p_pack_slug text, p_kind text, p_domain_code text default null, p_questions jsonb default null
)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.start_storm(p_pack_slug, p_kind, p_domain_code, p_questions); $$;

create function public.answer_storm_question(p_storm_id uuid, p_question_id text, p_chosen text[], p_content_hash text)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.answer_storm_question(p_storm_id, p_question_id, p_chosen, p_content_hash); $$;

create function public.finish_storm(p_storm_id uuid)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.finish_storm(p_storm_id); $$;

create function public.finalize_expired_storms()
returns void language sql volatile security invoker set search_path = ''
as $$ select private.finalize_expired_storms(); $$;

-- ── privileges ─────────────────────────────────────────────────────────────────
-- internal helpers: owner only
revoke execute on function private.options_match(text[], text[]) from public, anon, authenticated;
revoke execute on function private.finalize_storm(uuid) from public, anon, authenticated;

-- entry points: authenticated only (private target + public shim)
revoke execute on function private.start_storm(text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function private.answer_storm_question(uuid, text, text[], text) from public, anon, authenticated;
revoke execute on function private.finish_storm(uuid) from public, anon, authenticated;
revoke execute on function private.finalize_expired_storms() from public, anon, authenticated;
grant execute on function private.start_storm(text, text, text, jsonb) to authenticated;
grant execute on function private.answer_storm_question(uuid, text, text[], text) to authenticated;
grant execute on function private.finish_storm(uuid) to authenticated;
grant execute on function private.finalize_expired_storms() to authenticated;

revoke execute on function public.start_storm(text, text, text, jsonb) from public, anon;
revoke execute on function public.answer_storm_question(uuid, text, text[], text) from public, anon;
revoke execute on function public.finish_storm(uuid) from public, anon;
revoke execute on function public.finalize_expired_storms() from public, anon;
grant execute on function public.start_storm(text, text, text, jsonb) to authenticated;
grant execute on function public.answer_storm_question(uuid, text, text[], text) to authenticated;
grant execute on function public.finish_storm(uuid) to authenticated;
grant execute on function public.finalize_expired_storms() to authenticated;
