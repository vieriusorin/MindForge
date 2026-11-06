import type { z } from "zod";
import type { PathFileSchema } from "./schema";

/** MF-0058: a Path is an ordered list of course packs, declared in `paths/<slug>.yaml`. */
export type PathContent = z.infer<typeof PathFileSchema>;

/** One recorded "Course complete" (`public.course_completions`), kept once written. */
export interface CourseCompletion {
  packSlug: string;
  /** ISO timestamp, passed through to the screen as recorded. */
  completedAt: string;
  packVersion: number;
}

export type CourseProgress =
  | { packSlug: string; status: "complete"; completedAt: string }
  | { packSlug: string; status: "in-progress" }
  | { packSlug: string; status: "not-started" };

export interface PathProgress {
  /** One entry per course, in path order. */
  courses: readonly CourseProgress[];
  completedCount: number;
  total: number;
  /** The first course in path order that isn't complete; null when the path is complete. */
  next: string | null;
  /** 1-based position of `next` in path order (the "Course n of N" figure); null when complete. */
  nextPosition: number | null;
  /** Whole-number share of courses complete, 0–100 (for the progress bar). */
  completedPercent: number;
  isPathComplete: boolean;
  /** The latest course `completedAt` once every course is complete; else null. */
  completedAt: string | null;
}
