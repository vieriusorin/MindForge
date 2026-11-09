import { z } from "zod";
import { ORDER_MAX_STEPS, ORDER_STEP_ID_MAX } from "@/engine/content";

/** MF-0066: one order answer: the step ids in the learner's order, bound to the version read. */
export const OrderAnswerInput = z.strictObject({
  packSlug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  orderId: z.string().min(1).max(128),
  order: z
    .array(z.string().min(1).max(ORDER_STEP_ID_MAX))
    .min(1)
    .max(ORDER_MAX_STEPS),
  contentHash: z.string().min(1).max(128),
  /** MF-0067: names this submission; a retry with the same id is recorded once. */
  clientAttemptId: z.uuid(),
});

export type OrderAnswerValues = z.infer<typeof OrderAnswerInput>;
