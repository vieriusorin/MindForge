import "server-only";
import {
  checkOrderAnswer,
  type OrderFeedback,
  type OrderGradeError,
  reviewStateOf,
} from "@/engine/content";
import type { ActionResult } from "@/lib/action-result";
import { getItemHashes } from "@/server/content/get-item-hashes";
import { getPackContent } from "@/server/content/get-pack-content";
import { getPackOrders } from "@/server/content/get-pack-orders";
import { getReviewContext } from "@/server/content/get-review-context";
import { recordCourseCompletion } from "@/server/paths/record-course-completion";
import { createServerSupabase } from "@/server/supabase/server";
import { isStaleVersionError } from "./is-stale-version-error";

export type GradeOrderError = OrderGradeError | "not-gradable";

export interface GradeOrderInput {
  userId: string;
  packSlug: string;
  orderId: string;
  order: string[];
  contentHash: string;
  /** MF-0067: the submission id; a retry with the same id returns the first grade. */
  clientAttemptId: string;
}

/**
 * MF-0066 SC-4: grade one order answer in the DATABASE (`record_attempt`, the step ids in the learner's
 * order; the key is `ordered`, so the sequence is compared), then (and only then) reveal the key order.
 * Callers have already authenticated and parsed the input. `not-gradable` = no key synced, or the RPC failed.
 */
export async function gradeOrder({
  userId,
  packSlug,
  orderId,
  order: chosen,
  contentHash,
  clientAttemptId,
}: GradeOrderInput): Promise<
  ActionResult<{ feedback: OrderFeedback }, GradeOrderError>
> {
  const [content, orders, hashes, review] = await Promise.all([
    getPackContent(packSlug),
    getPackOrders(packSlug),
    getItemHashes(packSlug),
    getReviewContext(userId, packSlug),
  ]);
  const order = orders.find((o) => o.id === orderId) ?? null;
  const diagram = order
    ? content.diagrams.find((d) => d.id === order.diagram)
    : undefined;
  const check = checkOrderAnswer({
    order,
    reviewState: order ? reviewStateOf(review, order) : "unreviewed",
    // A missing diagram (files out of step) can never be approved.
    diagramState: diagram ? reviewStateOf(review, diagram) : "unreviewed",
    fileHash: hashes[orderId],
    sentHash: contentHash,
    chosen,
  });
  if (!check.ok) return check;
  if (!order) return { ok: false, error: "not-in-pack" };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("record_attempt", {
    p_question_id: order.id,
    p_chosen: chosen,
    p_content_hash: contentHash,
    p_client_attempt_id: clientAttemptId,
  });
  // MF-0032: the registry holds another version (sync ran ahead of this deploy).
  if (isStaleVersionError(error)) return { ok: false, error: "changed" };
  if (error || typeof data !== "boolean")
    return { ok: false, error: "not-gradable" };

  // MF-0058 SC-6: only a correct answer can raise stability, so only it can complete a course.
  if (data) {
    try {
      await recordCourseCompletion({ userId, packSlug, now: new Date() });
    } catch (error) {
      // MF-0058 SC-6: completion is a side effect of a committed attempt; it never fails the answer.
      console.error(
        "recordCourseCompletion:",
        error instanceof Error ? error.message : "unknown error",
      );
    }
  }

  return {
    ok: true,
    feedback: {
      correct: data,
      steps: order.steps.map((s) => ({ node: s.node, label: s.label })),
      explanation: order.explanation,
    },
  };
}
