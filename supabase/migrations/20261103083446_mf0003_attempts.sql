-- MF-0003: graded attempts. The DATABASE decides whether an answer is correct.
--
--   * private.question_keys: answer keys copied from packs/<slug>/questions/*.yaml by
--     scripts/sync-question-keys.mjs. Unreadable by clients (no grants, RLS on, no policies).
--   * public.attempts: append-only, written only by private.record_attempt; a learner reads only
--     their own rows. No INSERT/UPDATE/DELETE grants, so `correct` cannot be forged or edited.
--   * the forest is replayed from these rows (FSRS), so nothing a client sends can grow a tree.

-- ── answer keys (private) ──────────────────────────────────────────────────────
create table private.question_keys (
  question_id text primary key,
  pack_slug text not null check (pack_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  skill_code text not null check (char_length(skill_code) between 1 and 32),
  correct_options text[] not null check (cardinality(correct_options) >= 1),
  updated_at timestamptz not null default now()
);

create index question_keys_pack_slug_idx on private.question_keys (pack_slug);
alter table private.question_keys enable row level security;
revoke all on private.question_keys from public, anon, authenticated;

-- ── attempts ───────────────────────────────────────────────────────────────────
create table public.attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  pack_slug text not null,
  skill_code text not null,
  question_id text not null,
  chosen text[] not null check (cardinality(chosen) between 1 and 10),
  correct boolean not null,
  answered_at timestamptz not null default now()
);

create index attempts_user_pack_answered_idx on public.attempts (user_id, pack_slug, answered_at);
alter table public.attempts enable row level security;

revoke all on public.attempts from public, anon, authenticated;
grant select on public.attempts to authenticated;

create policy "attempts: read own"
  on public.attempts for select to authenticated
  using (user_id = (select auth.uid()));

-- ── grading ────────────────────────────────────────────────────────────────────
create function private.record_attempt(p_question_id text, p_chosen text[])
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_key private.question_keys%rowtype;
  v_correct boolean;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_chosen is null or cardinality(p_chosen) not between 1 and 10 then
    raise exception 'choose between 1 and 10 options' using errcode = '22023';
  end if;
  -- option ids are single letters; bound them so a direct RPC call can't store huge rows (MF-0003 review)
  if exists (select 1 from unnest(p_chosen) c where c is null or char_length(c) not between 1 and 8) then
    raise exception 'invalid option id' using errcode = '22023';
  end if;

  select * into v_key from private.question_keys k where k.question_id = p_question_id;
  if not found then
    raise exception 'unknown question' using errcode = 'P0002';
  end if;

  -- exact set equality: a superset or a subset of the key is wrong
  v_correct := array(select distinct c from unnest(p_chosen) c order by 1)
             = array(select distinct c from unnest(v_key.correct_options) c order by 1);

  -- pack and skill come from the key row, never from the client
  insert into public.attempts (user_id, pack_slug, skill_code, question_id, chosen, correct)
  values (v_uid, v_key.pack_slug, v_key.skill_code, v_key.question_id, p_chosen, v_correct);

  return v_correct;
end;
$$;

create function public.record_attempt(p_question_id text, p_chosen text[])
returns boolean
language sql
volatile
security invoker
set search_path = ''
as $$ select private.record_attempt(p_question_id, p_chosen); $$;

revoke execute on function private.record_attempt(text, text[]) from public, anon, authenticated;
revoke execute on function public.record_attempt(text, text[]) from public, anon;
grant execute on function private.record_attempt(text, text[]) to authenticated;
grant execute on function public.record_attempt(text, text[]) to authenticated;
