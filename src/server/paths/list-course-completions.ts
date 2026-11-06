import "server-only";
import type { CourseCompletion } from "@/engine/path";
import { createServerSupabase } from "@/server/supabase/server";
import { toCourseCompletion } from "./to-course-completion";
import { COURSE_COMPLETION_COLUMNS } from "./types";

/**
 * MF-0058: the signed-in learner's recorded Course completes, by pack slug (RLS: own rows only).
 * Per-user: never cached. Throws on a database error.
 */
export async function listCourseCompletions(
  userId: string,
): Promise<CourseCompletion[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("course_completions")
    .select(COURSE_COMPLETION_COLUMNS)
    .eq("user_id", userId)
    .order("pack_slug");
  if (error) throw new Error(`listCourseCompletions: ${error.message}`);
  return (data ?? []).map(toCourseCompletion);
}
