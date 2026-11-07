"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { type ActionResult, formErrorFromZod } from "@/lib/action-result";
import { getCurrentUser } from "@/server/auth/current-user";
import { listPacks } from "@/server/packs/list-packs";
import { getPath } from "@/server/paths/get-path";
import { createServerSupabase } from "@/server/supabase/server";
import {
  AdvanceGroupCourseInput,
  CreateGroupInput,
  CreatePathGroupInput,
  JoinGroupInput,
  SetDiscussionLinkInput,
} from "./schemas";
import type {
  AdvanceGroupCourseResult,
  CreateGroupResult,
  CreatePathGroupResult,
  JoinGroupResult,
  PinGroupResult,
  RotateInviteResult,
  SetDiscussionLinkResult,
  UnpinGroupResult,
} from "./types";
import {
  advanceGroupCourseRpcError,
  createGroupRpcError,
  createPathGroupRpcError,
  discussionLinkRpcError,
  joinGroupRpcError,
  pinRpcError,
  rotateInviteRpcError,
} from "./utils/rpc-errors";

/**
 * Called from `useCreateGroupForm` through `useMutation`. Takes `unknown`: the client's types
 * are not a boundary, the schema is. Returns a result instead of redirecting on success, so
 * the hook owns navigation (`redirect()` stays only for the auth guard).
 */
export async function createGroup(input: unknown): Promise<CreateGroupResult> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/groups");

  const parsed = CreateGroupInput.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: formErrorFromZod(parsed.error) };

  const packs = await listPacks();
  if (!packs.some((p) => p.slug === parsed.data.packSlug))
    return {
      ok: false,
      error: {
        message: "Pick a learning pack.",
        fieldErrors: { packSlug: "Pick a learning pack." },
      },
    };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("create_group", {
    p_name: parsed.data.name,
    p_pack_slug: parsed.data.packSlug,
  });
  // MF-0004: the DB refuses unknown packs and the 11th group; say which.
  if (error || !data)
    return { ok: false, error: createGroupRpcError(error ?? {}) };
  return { ok: true, groupId: data };
}

/**
 * MF-0059: a group that follows a Group path. Called from the create form's hook through
 * `useMutation`; the DB (`private.create_path_group`) enrolls the creator in the path and checks
 * the slug against the path registry too, so a file removed since the check still fails cleanly.
 */
export async function createPathGroup(
  input: unknown,
): Promise<CreatePathGroupResult> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/groups");

  const parsed = CreatePathGroupInput.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: formErrorFromZod(parsed.error) };

  const path = await getPath(parsed.data.pathSlug);
  if (!path)
    return {
      ok: false,
      error: {
        message: "Pick a path.",
        fieldErrors: { pathSlug: "Pick a path." },
      },
    };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("create_path_group", {
    p_name: parsed.data.name,
    p_path_slug: parsed.data.pathSlug,
  });
  if (error || !data)
    return { ok: false, error: createPathGroupRpcError(error ?? {}) };
  return { ok: true, groupId: data };
}

const INVALID_INVITE =
  "This invite link is invalid or has been reset. Ask a group member for a new one.";

/**
 * MF-0059 (F6): called from `useJoinCard` through `useMutation`, never on GET (a link prefetch
 * must not join anyone). Returns the group id instead of redirecting; the hook navigates.
 * `join_group` also enrolls the new member in the group's path, when it has one.
 */
export async function joinGroup(input: unknown): Promise<JoinGroupResult> {
  // Parsed before the auth guard: the sign-in redirect returns to this invite when it is valid.
  const parsed = JoinGroupInput.safeParse(input);
  const user = await getCurrentUser();
  if (!user)
    redirect(
      parsed.success
        ? `/sign-in?next=${encodeURIComponent(`/join/${parsed.data.code}`)}`
        : "/sign-in?next=/groups",
    );
  if (!parsed.success) return { ok: false, error: INVALID_INVITE };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("join_group", {
    p_code: parsed.data.code,
  });
  if (error || !data)
    return { ok: false, error: joinGroupRpcError(error ?? {}) };
  // The sidebar lists the new group.
  refresh();
  return { ok: true, groupId: data };
}

/**
 * MF-0059: moves a path group to the next course of its path (and ends a running expedition).
 * The definer function is the authorization (admin only; no column grant lets anyone else change
 * `pack_slug`); the hidden button is not. `fromPack` makes a stale tab fail with 40001.
 */
export async function advanceGroupCourse(
  input: unknown,
): Promise<AdvanceGroupCourseResult> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/groups");
  const parsed = AdvanceGroupCourseInput.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: "This group link is not valid." };

  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("advance_group_course", {
    p_group_id: parsed.data.groupId,
    p_from_pack: parsed.data.fromPack,
  });
  if (error) return { ok: false, error: advanceGroupCourseRpcError(error) };
  refresh();
  return { ok: true };
}

const GroupId = z.uuid();

/**
 * MF-0004: reports failure instead of refreshing as if it worked. The DB refuses non-admins
 * (private.rotate_invite_code); the button is only a convenience.
 */
export async function rotateInviteCode(
  groupId: unknown,
): Promise<RotateInviteResult> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/groups");
  const parsed = GroupId.safeParse(groupId);
  if (!parsed.success)
    return { ok: false, error: "This group link is not valid." };

  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("rotate_invite_code", {
    p_group_id: parsed.data,
  });
  if (error) return { ok: false, error: rotateInviteRpcError(error) };
  refresh();
  return { ok: true } satisfies ActionResult;
}

/** MF-0054: `pin_group` returns the replaced pin, if the cap of 3 made it evict one. */
const PinGroupRows = z
  .array(z.object({ evicted_id: z.uuid(), evicted_name: z.string() }))
  .max(1);

/**
 * MF-0054 SC-5: pins a group to the sidebar. The DB refuses a group you are not in (42501) and
 * replaces the oldest pin beyond 3 in the same write. The hook refreshes the screen on success.
 */
export async function pinGroup(groupId: unknown): Promise<PinGroupResult> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/groups");
  const parsed = GroupId.safeParse(groupId);
  if (!parsed.success)
    return { ok: false, error: "This group link is not valid." };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("pin_group", {
    p_group_id: parsed.data,
  });
  if (error) return { ok: false, error: pinRpcError(error) };
  const rows = PinGroupRows.safeParse(data);
  if (!rows.success) return { ok: false, error: pinRpcError({}) };
  const [evicted] = rows.data;
  return {
    ok: true,
    evicted: evicted
      ? { id: evicted.evicted_id, name: evicted.evicted_name }
      : null,
  };
}

/** MF-0054 SC-5: removes your pin; unpinning a group that is not pinned succeeds. */
export async function unpinGroup(groupId: unknown): Promise<UnpinGroupResult> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/groups");
  const parsed = GroupId.safeParse(groupId);
  if (!parsed.success)
    return { ok: false, error: "This group link is not valid." };

  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("unpin_group", {
    p_group_id: parsed.data,
  });
  if (error) return { ok: false, error: pinRpcError(error) };
  return { ok: true };
}

/**
 * MF-0063: the admin sets or clears (`""`) the group's discussion link. Called from
 * `useDiscussionLinkForm` through `useMutation`. The definer function is the authorization (admin
 * only, 42501) and its CHECK the last word on the link's shape; the hidden form is neither.
 */
export async function setGroupDiscussionLink(
  input: unknown,
): Promise<SetDiscussionLinkResult> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/groups");
  const parsed = SetDiscussionLinkInput.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: formErrorFromZod(parsed.error) };

  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("set_group_discussion_url", {
    p_group_id: parsed.data.groupId,
    // @ts-expect-error -- generated RPC args are never nullable (supabase gen types); null clears the link.
    p_url: parsed.data.url,
  });
  if (error) return { ok: false, error: discussionLinkRpcError(error) };
  refresh();
  return { ok: true };
}
