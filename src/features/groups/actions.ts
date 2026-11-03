"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { formErrorFromZod } from "@/lib/action-result";
import { getCurrentUser } from "@/server/auth/current-user";
import { listPacks } from "@/server/packs/list-packs";
import { createServerSupabase } from "@/server/supabase/server";
import { CreateGroupInput } from "./schemas";
import type { CreateGroupResult } from "./types";

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
    return {
      ok: false,
      error: { message: "Could not create the group. Try again." },
    };
  return { ok: true, groupId: data };
}

const Code = z.string().regex(/^[0-9a-f]{16,64}$/);

export async function joinGroup(code: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(`/join/${code}`)}`);
  if (!Code.safeParse(code).success)
    redirect(`/join/${encodeURIComponent(code)}?error=invalid`);

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("join_group", { p_code: code });
  if (error || !data) redirect(`/join/${code}?error=invalid`);
  redirect(`/groups/${data}`);
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
