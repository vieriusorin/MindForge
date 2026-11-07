-- MF-0065: confidence-graded recall (ADR 0007). Before the reveal the learner may tap "Sure" or "Not sure"; the tap is
-- stored with the attempt in the SAME call that grades it, so it can never be chosen after seeing the verdict.
--
--   * public.attempts.confidence: nullable text, 'sure' | 'unsure'. NULL = no tap: rows written before this migration,
--     private.finish_storm (exam conditions), Spot the Cuckoo, SQL callers and a learner who did not tap.
--   * record_attempt gains ONE parameter, appended: p_confidence text default null. The 4-arg signature is dropped
--     (MF-0032 / MF-0067 pattern). The return type is unchanged (boolean) and the grade never depends on the tap: the
--     key alone decides `correct`. The FSRS rating that uses the tap is computed in the engine (D-4), never here.
--   * Any other value -> 22023, nothing written (the CHECK is the backstop).
--   * Idempotency (MF-0067): the tap is part of "the same answer". A seen client attempt id with another confidence
--     (NULL vs a value included) -> 23505, nothing written; compared with `is distinct from` (MF-0067 review note 2) on
--     both the replay path and the lost-race path.
--   * MF-0067 review note 6: a replay stays bound to the stored content hash (a different hash -> 23505), so the key a
--     page reveals on a replay is the key that produced the first grade (MF-0065 SC-3).
--   * public.group_attempts is unchanged: it never returns confidence, so no group figure can read it.
--     No grant changes on public.attempts.

alter table public.attempts
  add column confidence text
    constraint attempts_confidence_check check (confidence in ('sure', 'unsure'));

drop function public.record_attempt(text, text[], text, uuid);
drop function private.record_attempt(text, text[], text, uuid);

create function private.record_attempt(
  p_question_id text,
  p_chosen text[],
  p_content_hash text default null,
  p_client_attempt_id uuid default null,
  p_confidence text default null
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
  -- MF-0065: the tap is one of two words or nothing
  if p_confidence is not null and p_confidence not in ('sure', 'unsure') then
    raise exception 'invalid confidence' using errcode = '22023';
  end if;

  -- MF-0067: a retry of a recorded answer returns the first grade and writes nothing
  if p_client_attempt_id is not null then
    select a.question_id, a.chosen, a.content_hash, a.correct, a.confidence
      into v_prev
    from public.attempts a
    where a.user_id = v_uid and a.client_attempt_id = p_client_attempt_id;
    if found then
      if v_prev.question_id is distinct from p_question_id
         or v_prev.chosen is distinct from p_chosen
         or v_prev.confidence is distinct from p_confidence
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

  -- exact set equality: a superset or a subset of the key is wrong (the tap plays no part)
  v_correct := array(select distinct c from unnest(p_chosen) c order by 1)
             = array(select distinct c from unnest(v_correct_options) c order by 1);

  -- pack, skill and hash come from the key and registry rows, never from the client
  insert into public.attempts
    (user_id, pack_slug, skill_code, question_id, chosen, correct, content_hash, client_attempt_id, confidence)
  values
    (v_uid, v_pack_slug, v_skill_code, v_question_id, p_chosen, v_correct, v_item_hash, p_client_attempt_id,
     p_confidence)
  on conflict (user_id, client_attempt_id) do nothing;

  if found then
    return v_correct;
  end if;

  -- MF-0067: a concurrent call with the same id committed first; this statement sees its row
  select a.question_id, a.chosen, a.content_hash, a.correct, a.confidence
    into v_prev
  from public.attempts a
  where a.user_id = v_uid and a.client_attempt_id = p_client_attempt_id;
  if not found then
    raise exception 'attempt not recorded' using errcode = '40001';
  end if;
  if v_prev.question_id is distinct from p_question_id
     or v_prev.chosen is distinct from p_chosen
     or v_prev.confidence is distinct from p_confidence
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
  p_client_attempt_id uuid default null,
  p_confidence text default null
)
returns boolean
language sql
volatile
security invoker
set search_path = ''
as $$ select private.record_attempt(p_question_id, p_chosen, p_content_hash, p_client_attempt_id, p_confidence); $$;

revoke execute on function private.record_attempt(text, text[], text, uuid, text) from public, anon, authenticated;
revoke execute on function public.record_attempt(text, text[], text, uuid, text) from public, anon;
grant execute on function private.record_attempt(text, text[], text, uuid, text) to authenticated;
grant execute on function public.record_attempt(text, text[], text, uuid, text) to authenticated;
