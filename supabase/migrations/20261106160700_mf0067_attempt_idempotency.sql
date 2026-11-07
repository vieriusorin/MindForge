-- MF-0067: retry-safe answers. Each app answer carries a client attempt id (a uuid minted when the learner
-- submits and kept for a retry of that same submission).
--
--   * public.attempts.client_attempt_id: nullable. NULL for rows written before this migration, by
--     private.finish_storm (idempotent by storm_id) and by SQL callers that omit the id. Unique per learner:
--     (user_id, client_attempt_id). NULLs never conflict, so the legacy path still writes a row per call.
--   * record_attempt gains ONE parameter, appended: p_client_attempt_id uuid default null. The 3-arg
--     signature is dropped (MF-0032 pattern), so no overload without replay stays callable. The return type is
--     unchanged (boolean). The app always sends the id; the zod input schemas require it (MF-0067 DQ-2).
--     MF-0065 (confidence grading) changes this function next: keep this header as the record of the change.
--   * Replay is checked first, before the key lookup and the hash check: a retry of an accepted answer returns
--     its stored grade even when a sync moved the key or the registry hash since (DQ-3).
--   * Same id with another question, another chosen array or another content hash -> 23505, nothing written
--     (DQ-4). Only a buggy or hostile client reaches it. Compared with `is distinct from`, so a NULL question sent with a
--     seen id is refused too (MF-0067 review note 2).
--   * Race: insert ... on conflict do nothing waits for a concurrent insert of the same key to commit; when it
--     lost, a NEW statement (fresh READ COMMITTED snapshot) reads the winner and applies the same rule (DQ-6).
--     No row lock and no timestamp on replay. No grant changes on public.attempts.

alter table public.attempts
  add column client_attempt_id uuid;

alter table public.attempts
  add constraint attempts_user_client_attempt_key unique (user_id, client_attempt_id);

drop function public.record_attempt(text, text[], text);
drop function private.record_attempt(text, text[], text);

create function private.record_attempt(
  p_question_id text,
  p_chosen text[],
  p_content_hash text default null,
  p_client_attempt_id uuid default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_pack_slug text;
  v_skill_code text;
  v_question_id text;
  v_correct_options text[];
  v_item_hash text;
  v_has_item boolean;
  v_correct boolean;
  v_prev record;
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

  -- MF-0067: a retry of a recorded answer returns the first grade and writes nothing
  if p_client_attempt_id is not null then
    select a.question_id, a.chosen, a.content_hash, a.correct
      into v_prev
    from public.attempts a
    where a.user_id = v_uid and a.client_attempt_id = p_client_attempt_id;
    if found then
      if v_prev.question_id is distinct from p_question_id
         or v_prev.chosen is distinct from p_chosen
         or (p_content_hash is not null and v_prev.content_hash is distinct from p_content_hash) then
        raise exception 'client attempt id already used for another answer' using errcode = '23505';
      end if;
      return v_prev.correct;
    end if;
  end if;

  -- one statement = one snapshot: the key and the hash come from the same committed sync
  select k.pack_slug, k.skill_code, k.question_id, k.correct_options, i.content_hash, i.item_id is not null
    into v_pack_slug, v_skill_code, v_question_id, v_correct_options, v_item_hash, v_has_item
  from private.question_keys k
  left join private.items i on i.item_id = k.question_id
  where k.question_id = p_question_id;
  if not found then
    raise exception 'unknown question' using errcode = 'P0002';
  end if;

  if p_content_hash is not null then
    if not v_has_item then
      raise exception 'unknown item' using errcode = 'P0002';
    end if;
    if p_content_hash <> v_item_hash then
      raise exception 'item changed since it was read' using errcode = '55000';
    end if;
  end if;

  -- exact set equality: a superset or a subset of the key is wrong
  v_correct := array(select distinct c from unnest(p_chosen) c order by 1)
             = array(select distinct c from unnest(v_correct_options) c order by 1);

  -- pack, skill and hash come from the key and registry rows, never from the client
  insert into public.attempts
    (user_id, pack_slug, skill_code, question_id, chosen, correct, content_hash, client_attempt_id)
  values
    (v_uid, v_pack_slug, v_skill_code, v_question_id, p_chosen, v_correct, v_item_hash, p_client_attempt_id)
  on conflict (user_id, client_attempt_id) do nothing;

  if found then
    return v_correct;
  end if;

  -- MF-0067: a concurrent call with the same id committed first; this statement sees its row
  select a.question_id, a.chosen, a.content_hash, a.correct
    into v_prev
  from public.attempts a
  where a.user_id = v_uid and a.client_attempt_id = p_client_attempt_id;
  if not found then
    raise exception 'attempt not recorded' using errcode = '40001';
  end if;
  if v_prev.question_id is distinct from p_question_id
     or v_prev.chosen is distinct from p_chosen
     or (p_content_hash is not null and v_prev.content_hash is distinct from p_content_hash) then
    raise exception 'client attempt id already used for another answer' using errcode = '23505';
  end if;
  return v_prev.correct;
end;
$$;

create function public.record_attempt(
  p_question_id text,
  p_chosen text[],
  p_content_hash text default null,
  p_client_attempt_id uuid default null
)
returns boolean
language sql
volatile
security invoker
set search_path = ''
as $$ select private.record_attempt(p_question_id, p_chosen, p_content_hash, p_client_attempt_id); $$;

revoke execute on function private.record_attempt(text, text[], text, uuid) from public, anon, authenticated;
revoke execute on function public.record_attempt(text, text[], text, uuid) from public, anon;
grant execute on function private.record_attempt(text, text[], text, uuid) to authenticated;
grant execute on function public.record_attempt(text, text[], text, uuid) to authenticated;
