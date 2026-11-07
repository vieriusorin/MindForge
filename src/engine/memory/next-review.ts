import { FOREST_THRESHOLDS } from "../forest/tree-stage";
import { CONFIDENT_MISS_REVIEW_HOURS, confidentMissAt } from "./confident-miss";
import { replayCard, scheduler } from "./replay";
import type { Attempt } from "./types";

const DAY_MS = 86_400_000;
/** ts-fsrs' own interval ceiling (`default_maximum_interval`): no tree is asked about later than this. */
const MAX_DAYS = 36_500;

/**
 * MF-0064 SC-3 (D-L11): when one skill's tree starts to fade, from its countable attempts: the first
 * whole day after the last review at which the replayed card's retrievability drops below the wilt
 * threshold. It reads the same `get_retrievability` as `replayMemory`, so `treeStage` turns wilting at
 * exactly this instant. Null when the skill has no successful recall (a Seed never fades).
 * MF-0065 (DQ-5): a confident miss brings it forward to at most CONFIDENT_MISS_REVIEW_HOURS after the miss.
 */
export function nextReviewAt(attempts: readonly Attempt[]): Date | null {
  const fadeAt = fadeDate(attempts);
  const missAt = confidentMissAt(attempts);
  if (!fadeAt || !missAt) return fadeAt;
  const reviewBy = missAt.getTime() + CONFIDENT_MISS_REVIEW_HOURS * 3_600_000;
  return reviewBy < fadeAt.getTime() ? new Date(reviewBy) : fadeAt;
}

/** MF-0064 SC-3: the first whole day after the last review at which the tree fades. */
function fadeDate(attempts: readonly Attempt[]): Date | null {
  const replayed = replayCard(attempts);
  if (!replayed || replayed.successfulRecalls < 1) return null;
  const { card } = replayed;
  const last = card.last_review;
  if (!last) return null;
  const isFaded = (days: number): boolean =>
    scheduler.get_retrievability(
      card,
      new Date(last.getTime() + days * DAY_MS),
      false,
    ) < FOREST_THRESHOLDS.wiltBelowRetrievability;

  // Retrievability only falls with time: gallop to a faded day, then bisect to the first one.
  let high = 1;
  while (high < MAX_DAYS && !isFaded(high)) high *= 2;
  high = Math.min(high, MAX_DAYS);
  if (!isFaded(high)) return new Date(last.getTime() + MAX_DAYS * DAY_MS);
  let low = 0;
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    if (isFaded(mid)) high = mid;
    else low = mid;
  }
  return new Date(last.getTime() + high * DAY_MS);
}
