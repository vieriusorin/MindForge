import "server-only";
import type { ForestView } from "@/engine/forest";
import { courseForest } from "@/engine/path";
import { getReviewContext } from "@/server/content/get-review-context";
import { listMyAttempts } from "@/server/memory/list-my-attempts";
import { getPack } from "@/server/packs/get-pack";
import { listMyStormResults } from "@/server/storm/list-my-storm-results";

/**
 * MF-0058: the signed-in learner's forest for one pack, replayed from their own graded attempts
 * (every read is RLS-bound, so `userId` must be the session user). Per-user: never cached.
 */
export async function getMyCourseForest(input: {
  userId: string;
  packSlug: string;
  now: Date;
}): Promise<ForestView> {
  const { userId, packSlug, now } = input;
  const [pack, attempts, review, stormResults] = await Promise.all([
    getPack(packSlug),
    listMyAttempts(userId, packSlug),
    getReviewContext(userId, packSlug),
    listMyStormResults(userId, packSlug),
  ]);
  return courseForest({ pack, attempts, review, stormResults, now });
}
