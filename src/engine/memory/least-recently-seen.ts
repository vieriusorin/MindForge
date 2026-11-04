import type { Attempt } from "./types";

/** When each item was last answered, by item id. Items never answered are absent. */
export function lastSeenByQuestion(
  attempts: readonly Attempt[],
): Map<string, number> {
  const lastSeen = new Map<string, number>();
  for (const a of attempts) {
    const t = a.answeredAt.getTime();
    if (t > (lastSeen.get(a.questionId) ?? Number.NEGATIVE_INFINITY))
      lastSeen.set(a.questionId, t);
  }
  return lastSeen;
}

/** The candidate this learner saw least recently, never-seen first; ties keep file order. */
export function leastRecentlySeen<T extends { id: string }>(
  candidates: readonly [T, ...T[]],
  lastSeen: ReadonlyMap<string, number>,
): T {
  const seenAt = (item: T): number =>
    lastSeen.get(item.id) ?? Number.NEGATIVE_INFINITY;
  return candidates.reduce((best, item) =>
    seenAt(item) < seenAt(best) ? item : best,
  );
}
