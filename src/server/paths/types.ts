import { z } from "zod";

/** MF-0058: the columns every completion read selects from `public.course_completions`. */
export const COURSE_COMPLETION_COLUMNS =
  "pack_slug, completed_at, pack_version";

/** One `course_completions` row as selected, parsed at the edge. */
export const CourseCompletionRow = z.object({
  pack_slug: z.string().min(1),
  completed_at: z.string().min(1),
  pack_version: z.number().int().positive(),
});

/** A learner's enrollment in one path (`public.path_enrollments`). */
export interface PathEnrollment {
  /** ISO timestamp, set by the database. */
  readonly startedAt: string;
}

export const PathEnrollmentRow = z.object({ started_at: z.string().min(1) });
