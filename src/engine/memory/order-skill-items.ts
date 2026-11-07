import type { Attempt } from "./types";

interface LastAnswer {
  at: number;
  correct: boolean;
}

function lastAnswers(attempts: readonly Attempt[]): Map<string, LastAnswer> {
  const last = new Map<string, LastAnswer>();
  for (const a of attempts) {
    const at = a.answeredAt.getTime();
    const seen = last.get(a.questionId);
    if (!seen || at >= seen.at)
      last.set(a.questionId, { at, correct: a.correct });
  }
  return last;
}

/** 0 = last answered wrong, 1 = never answered, 2 = last answered right. */
function bucketOf(last: LastAnswer | undefined): number {
  if (!last) return 1;
  return last.correct ? 2 : 0;
}

/**
 * MF-0065 (DQ-11, was MF-0064 D-L6): a skill's items in serving order: last answered wrong (least recently
 * wrong first), then never answered (file order), then least recently answered. Returns a new array.
 */
export function orderSkillItems<T extends { id: string }>(
  items: readonly T[],
  attempts: readonly Attempt[],
): T[] {
  const last = lastAnswers(attempts);
  return items
    .map((item, order) => ({ item, order, last: last.get(item.id) }))
    .sort(
      (a, b) =>
        bucketOf(a.last) - bucketOf(b.last) ||
        (a.last?.at ?? 0) - (b.last?.at ?? 0) ||
        a.order - b.order,
    )
    .map((x) => x.item);
}
