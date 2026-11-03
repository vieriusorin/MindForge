import type { Origin, PlayMode, ReviewContext, ReviewState } from "./types";

/** Nothing reviewed, nothing rejected or spoiled: the context until MF-0007. */
export function emptyReviewContext(): ReviewContext {
  return { states: new Map(), rejected: new Set(), spoiledBy: new Set() };
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
