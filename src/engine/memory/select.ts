import type { Pack } from "../pack/types";
import type { Question } from "../questions/types";
import { lastSeenByQuestion, leastRecentlySeen } from "./least-recently-seen";
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

/** MF-0016: any item a session can be picked from (questions, cuckoos). */
export interface SessionItem {
  id: string;
  skillCode: string;
}

export interface SessionItemsInput<T extends SessionItem> {
  pack: Pack;
  items: readonly T[];
  attempts: readonly Attempt[];
  now: Date;
  size?: number;
}

/**
 * Pick a session: skills ranked by weight × (1 − R) (R = 0 when unseen), highest first, ties in
 * pack order; one item per skill, the one this learner saw least recently (never seen first).
 * MF-0016: shared by every mode that serves one item per skill (Duel, Spot the Cuckoo).
 */
export function pickSessionItems<T extends SessionItem>({
  pack,
  items,
  attempts,
  now,
  size = DEFAULT_SESSION_SIZE,
}: SessionItemsInput<T>): T[] {
  const memory = memoryBySkill(attempts, now);
  const lastSeen = lastSeenByQuestion(attempts);

  return pack.domains
    .flatMap((d) => d.skills)
    .map((skill, order) => ({
      order,
      score: skill.weight * (1 - (memory.get(skill.code)?.retrievability ?? 0)),
      candidates: items.filter((item) => item.skillCode === skill.code),
    }))
    .filter(
      (s): s is typeof s & { candidates: [T, ...T[]] } =>
        s.candidates.length > 0,
    )
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, size)
    .map(({ candidates }) => leastRecentlySeen(candidates, lastSeen));
}

/** The Duel's session: `pickSessionItems` over questions. */
export function pickSessionQuestions({
  questions,
  ...rest
}: SessionInput): Question[] {
  return pickSessionItems({ ...rest, items: questions });
}
