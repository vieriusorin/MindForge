import { createEmptyCard, fsrs, generatorParameters, Rating } from "ts-fsrs";
import type { MemorySnapshot } from "../forest/tree-stage";
import type { Attempt } from "./types";

/** Deterministic scheduler: no fuzz, so the same attempts always give the same forest. */
const scheduler = fsrs(generatorParameters({ enable_fuzz: false }));

/** FSRS replay of ONE skill's graded attempts (any order) as of `now`. Null when never attempted. */
export function replayMemory(
  attempts: readonly Attempt[],
  now: Date,
): MemorySnapshot | null {
  if (attempts.length === 0) return null;
  const ordered = [...attempts].sort(
    (a, b) => a.answeredAt.getTime() - b.answeredAt.getTime(),
  );
  let card = createEmptyCard(ordered[0]?.answeredAt ?? now);
  let successfulRecalls = 0;
  for (const attempt of ordered) {
    card = scheduler.next(
      card,
      attempt.answeredAt,
      attempt.correct ? Rating.Good : Rating.Again,
    ).card;
    if (attempt.correct) successfulRecalls++;
  }
  // Never ask for retrievability before the last review (clock skew between DB and server).
  const last = card.last_review ?? now;
  const at = now.getTime() < last.getTime() ? last : now;
  return {
    successfulRecalls,
    stabilityDays: card.stability,
    retrievability: scheduler.get_retrievability(card, at, false),
    feynmanPassed: false,
    stormSurvived: false,
  };
}
