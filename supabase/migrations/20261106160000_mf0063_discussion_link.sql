-- MF-0063: a group's discussion link, set by its admin (an external chat; no posts stored here).
--
-- Access model (.planning/tasks/MF-0063/GOAL.md, LOOP-PLAN.md step 1):
--   * groups.discussion_url: read by members through MF-0002's table-level SELECT and the
--     "groups: members read" policy; non-members see no row. No column grant: the column UPDATE
--     grant stays (name) only, so the frozen MF-0005 allow-lists are unchanged.
--   * Written only by set_group_discussion_url: definer in private, admin only (42501 for anyone
--     else, one message so it is no existence oracle), '' or null clears it.
--   * The CHECK is the same rule as `DiscussionUrl` in src/features/groups/schemas.ts: https only,
--     an ASCII host (no user-info, so the host the card shows is the host the link opens), an
--     optional port, then /, ? or # and no whitespace or control characters; at most 500 characters.

alter table public.groups
  add column discussion_url text
  constraint groups_discussion_url_check check (
    discussion_url is null
    or (
      char_length(discussion_url) <= 500
      and discussion_url ~ '^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?([/?#][^[:space:][:cntrl:]]*)?$'
    )
  );

create function private.set_group_discussion_url(p_group_id uuid, p_url text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not private.is_admin(p_group_id) then
    raise exception 'only the group admin can change the discussion link' using errcode = '42501';
  end if;
  update public.groups
  set discussion_url = nullif(btrim(p_url), '')
  where id = p_group_id;
end;
$$;

create function public.set_group_discussion_url(p_group_id uuid, p_url text)
returns void
language sql
volatile
security invoker
set search_path = ''
as $$ select private.set_group_discussion_url(p_group_id, p_url); $$;

revoke execute on function private.set_group_discussion_url(uuid, text) from public, anon, authenticated;
revoke execute on function public.set_group_discussion_url(uuid, text) from public, anon;
grant execute on function private.set_group_discussion_url(uuid, text) to authenticated;
grant execute on function public.set_group_discussion_url(uuid, text) to authenticated;
