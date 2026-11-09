import type { DemoWorld, PlannedReview, SeedItem } from "./types";

const DAY_MS = 86_400_000;
const APPROVALS_NEEDED = 2;

/** MF-0066: one pack's input: its registry items and the diagrams its order items are drawn from. */
export interface OrderApprovalPack {
  packSlug: string;
  items: readonly SeedItem[];
  orderDiagramIds: readonly string[];
}

export interface OrderApproval {
  packSlug: string;
  review: PlannedReview;
}

export interface OrderApprovalPlan {
  approvals: OrderApproval[];
  /** Order diagrams left as they are, with why (the seed reports them). */
  skipped: { itemId: string; reason: string }[];
}

/**
 * MF-0066 (user decision U-b): an order item is served only on an approved diagram, so the demo world
 * approves the diagrams the shipped orders are drawn from: two approvals from two demo reviewers of that
 * pack's world, following `review_item`'s rules (never the item's author, never `you`, the item's current
 * hash). It never touches what it does not own (MF-0068 re-run rules): an item in `excludeItemIds` (your own
 * reviews, a maintainer's resolution, a real user's flag) is skipped, and so is a diagram the world's own
 * plan flags, or one already official. Approvals the world plan already gives count toward the two.
 * Pure; the worlds are read, never changed.
 */
export function planOrderDiagramApprovals({
  now,
  worlds,
  packs,
  excludeItemIds = [],
}: {
  now: Date;
  worlds: readonly DemoWorld[];
  packs: readonly OrderApprovalPack[];
  excludeItemIds?: readonly string[];
}): OrderApprovalPlan {
  const excluded = new Set(excludeItemIds);
  const createdAt = new Date(now.getTime() - DAY_MS);
  const approvals: OrderApproval[] = [];
  const skipped: OrderApprovalPlan["skipped"] = [];

  for (const pack of packs) {
    const world = worlds.find((w) => w.group.packSlug === pack.packSlug);
    for (const itemId of [...new Set(pack.orderDiagramIds)].sort()) {
      const item = pack.items.find((i) => i.itemId === itemId);
      if (!item || item.itemType !== "diagram") {
        skipped.push({ itemId, reason: "not a diagram of this pack" });
        continue;
      }
      if (item.origin === "official") {
        skipped.push({ itemId, reason: "official: already approved" });
        continue;
      }
      if (excluded.has(itemId)) {
        skipped.push({
          itemId,
          reason: "you reviewed it, or a maintainer or real user acted on it",
        });
        continue;
      }
      if (!world) {
        skipped.push({ itemId, reason: "no demo world for this pack" });
        continue;
      }
      const planned = world.reviews.filter((r) => r.itemId === itemId);
      if (planned.some((r) => r.verdict === "flag")) {
        skipped.push({ itemId, reason: "the demo world flags it" });
        continue;
      }
      const reviewed = new Set(planned.map((r) => r.reviewerEmail));
      const author = item.authorEmail?.toLowerCase() ?? null;
      const reviewers = world.learners.filter(
        (l) =>
          l.persona !== "you" && l.email !== author && !reviewed.has(l.email),
      );
      const missing = APPROVALS_NEEDED - planned.length;
      if (reviewers.length < missing) {
        skipped.push({ itemId, reason: "not enough demo reviewers" });
        continue;
      }
      for (const reviewer of reviewers.slice(0, Math.max(0, missing))) {
        approvals.push({
          packSlug: pack.packSlug,
          review: {
            reviewerEmail: reviewer.email,
            itemId,
            contentHash: item.contentHash,
            verdict: "approve",
            comment: null,
            createdAt,
          },
        });
      }
    }
  }
  return { approvals, skipped };
}

/** MF-0066: the worlds to seed, each with its pack's order-diagram approvals appended (new objects). */
export function withOrderApprovals(
  worlds: readonly DemoWorld[],
  approvals: readonly OrderApproval[],
): DemoWorld[] {
  return worlds.map((world) => {
    const extra = approvals
      .filter((a) => a.packSlug === world.group.packSlug)
      .map((a) => a.review);
    return extra.length
      ? { ...world, reviews: [...world.reviews, ...extra] }
      : world;
  });
}
