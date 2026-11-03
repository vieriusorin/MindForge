import "server-only";
import { emptyReviewContext, type ReviewContext } from "@/engine/content";

/**
 * MF-0006 SC-8, the review seam: what this learner may be served from a pack. Per-user (MF-0007
 * adds "spoiled by"), so never cached. Until MF-0007 replaces this body from `item_reviews`,
 * nothing is reviewed, rejected or spoiled.
 */
export async function getReviewContext(
  _userId: string,
  _packSlug: string,
): Promise<ReviewContext> {
  return emptyReviewContext();
}
