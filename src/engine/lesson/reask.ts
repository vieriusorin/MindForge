import { LESSON_MAX_INTERACTIONS } from "./plan-lesson";

/**
 * MF-0064 SC-2 (D-L8): which missed items are asked again at the end: once each, in the order missed,
 * only as many as LESSON_MAX_INTERACTIONS leaves after the planned steps.
 */
export function reaskQuestionIds({
  plannedCount,
  missedIds,
}: {
  plannedCount: number;
  missedIds: readonly string[];
}): string[] {
  const room = Math.max(0, LESSON_MAX_INTERACTIONS - plannedCount);
  return [...new Set(missedIds)].slice(0, room);
}
