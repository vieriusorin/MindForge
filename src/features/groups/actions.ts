"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/current-user";
import { listPacks } from "@/server/packs/list-packs";
import { createServerSupabase } from "@/server/supabase/server";
import type { CreateGroupState } from "./types";

const CreateGroupInput = z.strictObject({
  name: z
    .string()
    .trim()
    .min(1, "Give the group a name.")
    .max(80, "Keep the name under 80 characters."),
  packSlug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
});

export async function createGroup(
  _prev: CreateGroupState,
  formData: FormData,
): Promise<CreateGroupState> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/groups");

  const parsed = CreateGroupInput.safeParse({
    name: formData.get("name"),
    packSlug: formData.get("packSlug"),
  });
  if (!parsed.success)
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  const packs = await listPacks();
  if (!packs.some((p) => p.slug === parsed.data.packSlug))
    return { status: "error", message: "Pick a learning pack." };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("create_group", {
    p_name: parsed.data.name,
    p_pack_slug: parsed.data.packSlug,
  });
  if (error || !data)
    return {
      status: "error",
      message: "Could not create the group. Try again.",
    };
  redirect(`/groups/${data}`);
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

export async function rotateInviteCode(groupId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/groups");
  const supabase = await createServerSupabase();
  // The DB refuses non-admins (private.rotate_invite_code); the button is only a convenience.
  await supabase.rpc("rotate_invite_code", { p_group_id: groupId });
  refresh();
}
