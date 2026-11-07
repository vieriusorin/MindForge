import type { Attempt } from "../memory/types";
import type { MisconceptionCount, MixUp, PackMisconceptions } from "./types";

/**
 * MF-0065 (DQ-9): how often each misconception was picked: every wrong attempt adds 1 to each tagged
 * misconception among its chosen options. Correct attempts and untagged options add nothing. Most picked first,
 * then the most recent pick, then id. Pass the learner's own attempts only.
 */
export function misconceptionTally({
  attempts,
  misconceptions,
}: {
  attempts: readonly Attempt[];
  misconceptions: PackMisconceptions;
}): MisconceptionCount[] {
  const labels = new Map(
    misconceptions.misconceptions.map((m) => [m.id, m.label]),
  );
  const counts = new Map<string, MisconceptionCount>();
  for (const attempt of attempts) {
    if (attempt.correct) continue;
    const tags = misconceptions.tags[attempt.questionId];
    if (!tags) continue;
    for (const optionId of new Set(attempt.chosen ?? [])) {
      const id = tags[optionId];
      const label = id === undefined ? undefined : labels.get(id);
      if (id === undefined || label === undefined) continue;
      const seen = counts.get(id);
      counts.set(id, {
        misconceptionId: id,
        label,
        count: (seen?.count ?? 0) + 1,
        lastPickedAt:
          seen && seen.lastPickedAt > attempt.answeredAt
            ? seen.lastPickedAt
            : attempt.answeredAt,
      });
    }
  }
  return [...counts.values()].sort(
    (a, b) =>
      b.count - a.count ||
      b.lastPickedAt.getTime() - a.lastPickedAt.getTime() ||
      a.misconceptionId.localeCompare(b.misconceptionId),
  );
}

/** MF-0065 (DQ-12): the top misconception picked at or after `since`, or null. */
export function lessonMixUp({
  attempts,
  misconceptions,
  since,
}: {
  attempts: readonly Attempt[];
  misconceptions: PackMisconceptions;
  since: Date;
}): MixUp | null {
  const [top] = misconceptionTally({
    attempts: attempts.filter((a) => a.answeredAt.getTime() >= since.getTime()),
    misconceptions,
  });
  return top ? { label: top.label, count: top.count } : null;
}
