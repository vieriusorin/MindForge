import type {
  Origin,
  PlayMode,
  ReviewContext,
  ReviewRow,
  ReviewState,
} from "./types";

/** Nothing reviewed, nothing rejected or spoiled: the context until MF-0007. */
export function emptyReviewContext(): ReviewContext {
  return {
    states: new Map(),
    rejected: new Set(),
    spoiledBy: new Set(),
    spoiledAt: new Map(),
  };
}

/**
 * MF-0007: build the seam from the database's per-learner review rows. Every row's state is kept;
 * a row with `reviewedAt` is spoiled for this learner from that instant on.
 */
export function reviewContextFromRows(
  rows: readonly ReviewRow[],
): ReviewContext {
  const context = emptyReviewContext();
  for (const row of rows) {
    context.states.set(row.itemId, row.state);
    if (row.state === "rejected") context.rejected.add(row.itemId);
    if (row.reviewedAt !== null) {
      context.spoiledBy.add(row.itemId);
      context.spoiledAt.set(row.itemId, new Date(row.reviewedAt));
    }
  }
  return context;
}

/** An item's state in a context. Unknown items are unreviewed, except official ones, which start approved. */
export function reviewStateOf(
  context: ReviewContext,
  item: { id: string; origin: Origin },
): ReviewState {
  if (context.rejected.has(item.id)) return "rejected";
  return (
    context.states.get(item.id) ??
    (item.origin === "official" ? "approved" : "unreviewed")
  );
}

/**
 * CONTEXT.md Playable: flagged and rejected are never served. Both modes may serve unreviewed;
 * storms only *prefer* approved, which is a selection concern, not playability.
 */
export function isPlayable(state: ReviewState, _mode: PlayMode): boolean {
  return state === "approved" || state === "unreviewed";
}
