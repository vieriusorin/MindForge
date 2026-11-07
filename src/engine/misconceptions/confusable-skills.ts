import type { PackMisconceptions } from "./types";

/**
 * MF-0065 (DQ-10): the skills a skill's distractors mix in: the `skill` of every misconception tagged on the
 * skill's questions, never the skill itself. Most tags first, then skill code.
 */
export function confusableSkills({
  skillCode,
  misconceptions,
  questions,
}: {
  skillCode: string;
  misconceptions: PackMisconceptions;
  questions: readonly { id: string; skillCode: string }[];
}): string[] {
  const linked = new Map(
    misconceptions.misconceptions.flatMap((m) =>
      m.skill === undefined ? [] : [[m.id, m.skill] as const],
    ),
  );
  const counts = new Map<string, number>();
  for (const question of questions) {
    if (question.skillCode !== skillCode) continue;
    for (const id of Object.values(misconceptions.tags[question.id] ?? {})) {
      const other = linked.get(id);
      if (other === undefined || other === skillCode) continue;
      counts.set(other, (counts.get(other) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
    .map(([code]) => code);
}
