"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current-user";
import { getPath } from "@/server/paths/get-path";
import { createServerSupabase } from "@/server/supabase/server";
import { PathSlugInput } from "./schemas";
import type { LeavePathResult, StartPathResult } from "./types";

const UNIQUE_VIOLATION = "23505";
const NO_SUCH_PATH = "This path doesn't exist.";

/**
 * MF-0058: enroll the signed-in learner in a path. Repeat Start is ok and keeps one row (the PK
 * refuses the second insert). Called through `useMutation`; the hook refreshes.
 */
export async function startPath(input: unknown): Promise<StartPathResult> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/paths");

  const parsed = PathSlugInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: NO_SUCH_PATH };
  const path = await getPath(parsed.data.pathSlug);
  if (!path) return { ok: false, error: NO_SUCH_PATH };

  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("path_enrollments")
    .insert({ user_id: user.id, path_slug: path.slug });
  if (error && error.code !== UNIQUE_VIOLATION)
    return { ok: false, error: "Could not start the path. Try again." };
  return { ok: true };
}

/**
 * MF-0058: delete the learner's enrollment; course completions stay (another table). Leaving a path
 * you're not in deletes nothing and is ok. Called through `useMutation`; the hook refreshes.
 */
export async function leavePath(input: unknown): Promise<LeavePathResult> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/paths");

  const parsed = PathSlugInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: NO_SUCH_PATH };

  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("path_enrollments")
    .delete()
    .eq("user_id", user.id)
    .eq("path_slug", parsed.data.pathSlug);
  if (error)
    return { ok: false, error: "Could not leave the path. Try again." };
  return { ok: true };
}
