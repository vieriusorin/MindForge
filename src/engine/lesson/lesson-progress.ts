import type { LessonProgress, LessonSegment } from "./types";

/** MF-0064 D-L13: the segmented progress bar's figures, for the step at 0-based `index` of `total`. */
export function lessonProgress({
  index,
  total,
}: {
  index: number;
  total: number;
}): LessonProgress {
  const current = Math.min(Math.max(index, 0), Math.max(total - 1, 0));
  const segments = Array.from({ length: total }, (_, i): LessonSegment => {
    if (i < current) return "done";
    return i === current ? "current" : "todo";
  });
  return { position: total === 0 ? 0 : current + 1, total, segments };
}
