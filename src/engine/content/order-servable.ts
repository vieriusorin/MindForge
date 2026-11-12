import { isPlayable } from "./review";
import type { ReviewState } from "./types";

/**
 * MF-0066: an order is served (and graded) only while it is playable and the diagram it is drawn from
 * is approved (the ticket: "derived from an APPROVED diagram's nodes").
 */
export function isOrderServable({
  orderState,
  diagramState,
}: {
  orderState: ReviewState;
  diagramState: ReviewState;
}): boolean {
  return isPlayable(orderState, "practice") && diagramState === "approved";
}
