-- MF-0032: an attempt names the content hash the learner read, and the database refuses it when the
-- registry (private.items) holds another version: the same rule as review_item (MF-0007).
--
--   * record_attempt gains p_content_hash (default NULL: SQL callers, the dev seed and the frozen
--     MF-0003/MF-0016/MF-0029 tests call the 2-arg form; the app always sends it). Given and different
--     from private.items.content_hash -> 55000; given with no registry row -> P0002 (fail closed).
--   * The key and the registry hash are read in ONE statement. plpgsql takes a fresh snapshot per
--     statement, so two selects could check one sync's hash and grade with the next sync's key.
--     scripts/sync-question-keys.mjs writes keys + items in one transaction per pack (MF-0032).
--   * public.attempts.content_hash: the registry hash the answer was graded against, never the client's.
--     Covered by the existing SELECT grant and "read own" policy; no grant changes.
--   * The (text, text[]) signature is dropped, so no unchecked overload stays callable.

alter table public.attempts
  add column content_hash text
    check (content_hash is null or char_length(content_hash) between 1 and 128);

drop function public.record_attempt(text, text[]);
drop function private.record_attempt(text, text[]);

create function private.record_attempt(p_question_id text, p_chosen text[], p_content_hash text default null)
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
  insert into public.attempts (user_id, pack_slug, skill_code, question_id, chosen, correct, content_hash)
  values (v_uid, v_pack_slug, v_skill_code, v_question_id, p_chosen, v_correct, v_item_hash);

  return v_correct;
end;
$$;

create function public.record_attempt(p_question_id text, p_chosen text[], p_content_hash text default null)
returns boolean
language sql
volatile
security invoker
set search_path = ''
as $$ select private.record_attempt(p_question_id, p_chosen, p_content_hash); $$;

revoke execute on function private.record_attempt(text, text[], text) from public, anon, authenticated;
revoke execute on function public.record_attempt(text, text[], text) from public, anon;
grant execute on function private.record_attempt(text, text[], text) to authenticated;
grant execute on function public.record_attempt(text, text[], text) to authenticated;
