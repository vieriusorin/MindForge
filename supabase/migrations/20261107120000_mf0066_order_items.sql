-- MF-0066: order items (CONTEXT.md Order item). The learner puts the steps of one process in order.
--
--   * private.items.item_type gains 'order' (registry row, reviewed and hashed like every item).
--   * private.question_keys.ordered: true for an order key, whose correct_options is the step ids IN ORDER.
--     Default false, so every existing key (questions, cuckoos) keeps exact set equality.
--   * private.record_attempt: `create or replace` of MF-0065's 5-arg signature
--     (text, text[], text, uuid, text). The body is MF-0065's verbatim (confidence validation, replay first with
--     both `is distinct from` comparisons including confidence, key + hash in one snapshot) plus only the
--     `v_ordered` declare, the `k.ordered` column in the key select, and the sequence branch of the grade.
--     No new overload, no grant changes: `create or replace` keeps MF-0065's grants; the public wrapper is
--     unchanged. A later change to this function must carry this branch over.
--   * Which order is served (playable, diagram approved) is an engine decision (D-4); the database grades.

alter table private.items
  drop constraint items_item_type_check,
  add constraint items_item_type_check
    check (item_type in ('question', 'card', 'diagram', 'cuckoo', 'order'));

alter table private.question_keys
  add column ordered boolean not null default false;

create or replace function private.record_attempt(
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
  v_ordered boolean;
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
  select k.pack_slug, k.skill_code, k.question_id, k.correct_options, k.ordered, i.content_hash, i.item_id is not null
    into v_pack_slug, v_skill_code, v_question_id, v_correct_options, v_ordered, v_item_hash, v_has_item
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
  -- MF-0066: an order key is graded by SEQUENCE (same ids, same positions, same length); every other key
  -- keeps exact set equality
  if v_ordered then
    v_correct := p_chosen = v_correct_options;
  else
    v_correct := array(select distinct c from unnest(p_chosen) c order by 1)
               = array(select distinct c from unnest(v_correct_options) c order by 1);
  end if;

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
