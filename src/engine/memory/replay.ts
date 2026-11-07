import { type Card, createEmptyCard, fsrs, generatorParameters } from "ts-fsrs";
import type { MemorySnapshot } from "../forest/tree-stage";
import { ratingFor } from "./grade";
import type { Attempt } from "./types";

/** Deterministic scheduler: no fuzz, so the same attempts always give the same forest. */
export const scheduler = fsrs(generatorParameters({ enable_fuzz: false }));

/**
 * The FSRS card after ONE skill's graded attempts (any order). Shared by `replayMemory` and
 * `nextReviewAt` (MF-0064) so both read the same card. Null when never attempted.
 */
export function replayCard(
  attempts: readonly Attempt[],
): { card: Card; successfulRecalls: number } | null {
  if (attempts.length === 0) return null;
  const ordered = [...attempts].sort(
    (a, b) => a.answeredAt.getTime() - b.answeredAt.getTime(),
  );
  let card = createEmptyCard(ordered[0]?.answeredAt);
  let successfulRecalls = 0;
  for (const attempt of ordered) {
    card = scheduler.next(
      card,
      attempt.answeredAt,
      // MF-0065 (ADR 0007): the learner's tap grades the rating; no tap = Good / Again.
      ratingFor(attempt),
    ).card;
    if (attempt.correct) successfulRecalls++;
  }
  return { card, successfulRecalls };
}

/** FSRS replay of ONE skill's graded attempts (any order) as of `now`. Null when never attempted. */
export function replayMemory(
  attempts: readonly Attempt[],
  now: Date,
): MemorySnapshot | null {
  const replayed = replayCard(attempts);
  if (!replayed) return null;
  const { card, successfulRecalls } = replayed;
  // Never ask for retrievability before the last review (clock skew between DB and server).
  const last = card.last_review ?? now;
  const at = now.getTime() < last.getTime() ? last : now;
  return {
    successfulRecalls,
    stabilityDays: card.stability,
    retrievability: scheduler.get_retrievability(card, at, false),
    feynmanPassed: false,
    stormProven: false,
    fullStormProven: false,
  };
}
