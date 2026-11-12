import { isOrderServable } from "./order-servable";
import type { OrderItem, ReviewState } from "./types";

/** MF-0066 SC-4: why an order answer is not sent to the database for grading. */
export const ORDER_GRADE_ERRORS = [
  "not-in-pack",
  "withdrawn",
  "changed",
  "invalid-order",
] as const;
export type OrderGradeError = (typeof ORDER_GRADE_ERRORS)[number];

export interface CheckOrderAnswerInput {
  /** The order with the answered id in the deployed files, or null. */
  order: OrderItem | null;
  reviewState: ReviewState;
  /** The review state of the diagram the order is drawn from. */
  diagramState: ReviewState;
  /** The deployed file's content hash of this order. */
  fileHash: string | undefined;
  /** The hash the learner's page was rendered from. */
  sentHash: string;
  /** The step ids in the learner's order. */
  chosen: readonly string[];
}

export type CheckOrderAnswerResult =
  | { ok: true }
  | { ok: false; error: OrderGradeError };

/** True when `chosen` holds every step of the order exactly once (in any order). */
function isPermutation(order: OrderItem, chosen: readonly string[]): boolean {
  if (chosen.length !== order.steps.length) return false;
  const left = new Set(order.steps.map((s) => s.node));
  for (const id of chosen) {
    if (!left.delete(id)) return false;
  }
  return left.size === 0;
}

/**
 * MF-0066 SC-4: may this answer be graded? Pure; the caller then calls `record_attempt`, which grades the
 * sequence. A wrong permutation is `ok`: it is graded (wrong), not refused.
 */
export function checkOrderAnswer({
  order,
  reviewState,
  diagramState,
  fileHash,
  sentHash,
  chosen,
}: CheckOrderAnswerInput): CheckOrderAnswerResult {
  if (!order) return { ok: false, error: "not-in-pack" };
  // MF-0006 SC-8 + MF-0066: a withdrawn order or diagram is never graded, even from a stale page.
  if (!isOrderServable({ orderState: reviewState, diagramState }))
    return { ok: false, error: "withdrawn" };
  // MF-0032: the learner judged the version their page showed; refuse if the deploy moved on.
  if (fileHash !== sentHash) return { ok: false, error: "changed" };
  if (!isPermutation(order, chosen))
    return { ok: false, error: "invalid-order" };
  return { ok: true };
}
