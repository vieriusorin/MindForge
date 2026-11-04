import type { Question } from "../questions/types";
import type { Attempt } from "./types";

/** When each question was last answered, by question id. Questions never answered are absent. */
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
export function leastRecentlySeen(
  candidates: readonly [Question, ...Question[]],
  lastSeen: ReadonlyMap<string, number>,
): Question {
  const seenAt = (q: Question): number =>
    lastSeen.get(q.id) ?? Number.NEGATIVE_INFINITY;
  return candidates.reduce((best, q) => (seenAt(q) < seenAt(best) ? q : best));
}
