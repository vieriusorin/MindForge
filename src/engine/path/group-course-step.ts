import type { PathContent } from "./types";

export interface GroupCourseStepInput {
  path: PathContent;
  /** The group's current course (`groups.pack_slug`). */
  currentPack: string;
}

export interface GroupCourseStep {
  /** 1-based position of the current course in the path ("Course n of N"). */
  position: number;
  total: number;
  /** The course "Move to next course" goes to; null at the last course. */
  next: string | null;
}

/**
 * MF-0059 SC-6: where a path group stands in its path. Returns null when the current course is not
 * in the path (C-3: the path file changed), so the screen never shows "Course ? of N".
 */
export function groupCourseStep(
  input: GroupCourseStepInput,
): GroupCourseStep | null {
  const { path, currentPack } = input;
  const index = path.courses.indexOf(currentPack);
  if (index === -1) return null;
  return {
    position: index + 1,
    total: path.courses.length,
    next: path.courses[index + 1] ?? null,
  };
}
