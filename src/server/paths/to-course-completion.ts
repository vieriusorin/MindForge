import type { CourseCompletion } from "@/engine/path";
import { CourseCompletionRow } from "./types";

/** MF-0058: one `course_completions` row → the engine's CourseCompletion. Throws on a malformed row. */
export function toCourseCompletion(row: unknown): CourseCompletion {
  const parsed = CourseCompletionRow.parse(row);
  return {
    packSlug: parsed.pack_slug,
    completedAt: parsed.completed_at,
    packVersion: parsed.pack_version,
  };
}
