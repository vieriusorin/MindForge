import { orderSeed, toPlayableOrder } from "@/engine/content";
import type { PlannedStep } from "@/engine/lesson";
import { toPlayableQuestion } from "@/engine/questions";
import type { PlayerStep } from "../types";

/**
 * MF-0066 delta review D-1: how each order's shown permutation is seeded. The app passes `orderSeedOf`, a
 * server-only HMAC of (user, order) under ORDER_SHUFFLE_SECRET (`src/server/content/order-shuffle-seed.ts`),
 * because a seed from public inputs lets the learner recompute the key from the shown order. `userId` (the
 * public `orderSeed`) is for tests and fixtures only.
 */
export type OrderSeeding =
  | { orderSeedOf: (orderId: string) => number; userId?: never }
  | { userId: string; orderSeedOf?: never };

/**
 * MF-0064: the plan as the browser may see it. Questions become playable copies bound to their
 * deployed hash (MF-0032); a question with no hash is dropped, as `toPlayableQuestions` does, because
 * it could never be graded. A guess whose item was dropped goes with it. MF-0066: an order becomes its
 * playable copy (no key order) under the same rule.
 */
export function toPlayerSteps({
  steps,
  hashes,
  skillNames,
  ...seeding
}: {
  steps: readonly PlannedStep[];
  hashes: Readonly<Record<string, string>>;
  skillNames: ReadonlyMap<string, string>;
} & OrderSeeding): PlayerStep[] {
  const seedOf = (orderId: string): number =>
    "orderSeedOf" in seeding && seeding.orderSeedOf
      ? seeding.orderSeedOf(orderId)
      : orderSeed(seeding.userId ?? "", orderId);
  return steps.flatMap((step): PlayerStep[] => {
    switch (step.kind) {
      case "card":
      case "diagram":
        return [{ kind: step.kind }];
      case "guess":
      case "recall": {
        const hash = hashes[step.question.id];
        return hash
          ? [
              {
                kind: step.kind,
                question: toPlayableQuestion(step.question, hash),
              },
            ]
          : [];
      }
      case "confusable": {
        const hash = hashes[step.question.id];
        return hash
          ? [
              {
                kind: "confusable",
                question: toPlayableQuestion(step.question, hash),
                skillName: skillNames.get(step.skillCode) ?? step.skillCode,
              },
            ]
          : [];
      }
      case "order": {
        // MF-0066: the key never leaves the server; the step carries the version it shows.
        const hash = hashes[step.order.id];
        return hash
          ? [
              {
                kind: "order",
                order: toPlayableOrder(step.order, hash, seedOf(step.order.id)),
              },
            ]
          : [];
      }
      default: {
        const unknownStep: never = step;
        return unknownStep;
      }
    }
  });
}
