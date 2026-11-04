-- MF-0011: the read behind the group heatmap (CONTEXT.md Group heatmap, ROADMAP D-4).
--
--   * Memory is replayed by the TS engine (FSRS), so the server needs every member's attempts on
--     the group's pack. Those rows must never reach a member: an RPC callable by `authenticated`
--     would hand anyone the others' raw attempts through the Data API (GOAL C-2).
--   * So the read is EXECUTE for `service_role` ONLY. The app calls it from one server-only file
--     (src/server/groups/get-group-heatmap.ts) with SUPABASE_SECRET_KEY (ADR 0004) and turns the
--     rows into per-region aggregates before anything leaves the server.
--   * auth.uid() is null for service_role, so the viewer is passed in by the server (from the
--     verified session) and must be a member of the group, else 42501.
--   * One row per member (opaque member_key, never a user id) with a jsonb array of attempts: at
--     most group-size rows, under the Data API's max_rows without paging. `is_viewer` marks the
--     viewer's own row: the heatmap shows only when 3 members OTHER than the viewer have played,
--     so the viewer's trees never make up a third of a figure (GOAL C-3).
--   * Each attempt carries the MF-0007 filters the engine applies (countableAttempts): whether the
--     question is rejected, and when THIS member first reviewed it (spoiled), any content hash,
--     same rule as private.review_states.

grant usage on schema private to service_role;

create function private.group_attempts(p_group_id uuid, p_viewer_id uuid)
returns table (member_key integer, is_viewer boolean, attempts jsonb)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_pack text;
begin
  if p_viewer_id is null or not exists (
    select 1 from public.group_members m
    where m.group_id = p_group_id and m.user_id = p_viewer_id
  ) then
    raise exception 'not a member of this group' using errcode = '42501';
  end if;

  select g.pack_slug into v_pack from public.groups g where g.id = p_group_id;

  return query
    with members as (
      select m.user_id,
             m.user_id = p_viewer_id as is_viewer,
             (row_number() over (order by md5(m.user_id::text || p_group_id::text)))::integer as member_key
      from public.group_members m
      where m.group_id = p_group_id
    ),
    questions as (
      select distinct a.question_id
      from public.attempts a
      join members mb on mb.user_id = a.user_id
      where a.pack_slug = v_pack
    ),
    rejected as (
      select q.question_id from questions q
      where private.item_state(q.question_id) = 'rejected'
    )
    select mb.member_key,
           mb.is_viewer,
           jsonb_agg(
             jsonb_build_object(
               'question_id', a.question_id,
               'skill_code', a.skill_code,
               'correct', a.correct,
               'answered_at', a.answered_at,
               'rejected', exists (select 1 from rejected r where r.question_id = a.question_id),
               'spoiled_at', (
                 select min(v.created_at) from private.item_reviews v
                 where v.item_id = a.question_id and v.reviewer_id = mb.user_id
               )
             )
             order by a.answered_at, a.id
           )
    from members mb
    join public.attempts a on a.user_id = mb.user_id and a.pack_slug = v_pack
    group by mb.member_key, mb.is_viewer
    order by mb.member_key;
end;
$$;

create function public.group_attempts(p_group_id uuid, p_viewer_id uuid)
returns table (member_key integer, is_viewer boolean, attempts jsonb)
language sql
stable
security invoker
set search_path = ''
as $$ select * from private.group_attempts(p_group_id, p_viewer_id); $$;

-- ── privileges: service_role only (Supabase grants new functions to anon/authenticated by default) ──
revoke execute on function private.group_attempts(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.group_attempts(uuid, uuid) from public, anon, authenticated;
grant execute on function private.group_attempts(uuid, uuid) to service_role;
grant execute on function public.group_attempts(uuid, uuid) to service_role;
