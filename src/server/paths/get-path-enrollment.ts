import "server-only";
import { createServerSupabase } from "@/server/supabase/server";
import { type PathEnrollment, PathEnrollmentRow } from "./types";

/**
 * MF-0058: the signed-in learner's enrollment in one path, or null when not enrolled (RLS: own rows
 * only, so another user's id reads null). Per-user: never cached. Throws on a database error.
 */
export async function getPathEnrollment(
  userId: string,
  pathSlug: string,
): Promise<PathEnrollment | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("path_enrollments")
    .select("started_at")
    .eq("user_id", userId)
    .eq("path_slug", pathSlug)
    .maybeSingle();
  if (error) throw new Error(`getPathEnrollment: ${error.message}`);
  if (!data) return null;
  return { startedAt: PathEnrollmentRow.parse(data).started_at };
}
