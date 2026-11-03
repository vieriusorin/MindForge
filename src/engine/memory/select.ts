import type { Pack } from "../pack/types";
import type { Question } from "../questions/types";
import { memoryBySkill } from "./memory-by-skill";
import type { Attempt } from "./types";

export interface SessionInput {
  pack: Pack;
  questions: readonly Question[];
  attempts: readonly Attempt[];
  now: Date;
  size?: number;
}

export const DEFAULT_SESSION_SIZE = 5;

/**
 * Pick a session: skills ranked by weight × (1 − R) (R = 0 when unseen), highest first, ties in
 * pack order; one question per skill, the one this learner saw least recently (never seen first).
 */
export function pickSessionQuestions({
  pack,
  questions,
  attempts,
  now,
  size = DEFAULT_SESSION_SIZE,
}: SessionInput): Question[] {
  const memory = memoryBySkill(attempts, now);
  const lastSeen = new Map<string, number>();
  for (const a of attempts) {
    const t = a.answeredAt.getTime();
    if (t > (lastSeen.get(a.questionId) ?? Number.NEGATIVE_INFINITY))
      lastSeen.set(a.questionId, t);
  }

  const ranked = pack.domains
    .flatMap((d) => d.skills)
    .map((skill, order) => ({
      skill,
      order,
      score: skill.weight * (1 - (memory.get(skill.code)?.retrievability ?? 0)),
      candidates: questions.filter((q) => q.skillCode === skill.code),
    }))
    .filter((s) => s.candidates.length > 0)
    .sort((a, b) => b.score - a.score || a.order - b.order);

  return ranked
    .slice(0, size)
    .map(({ candidates }) =>
      candidates.reduce((best, q) =>
        (lastSeen.get(q.id) ?? Number.NEGATIVE_INFINITY) <
        (lastSeen.get(best.id) ?? Number.NEGATIVE_INFINITY)
          ? q
          : best,
      ),
    );
}
