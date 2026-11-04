import type { ReviewContext } from "../content/types";
import type { Attempt } from "./types";

/**
 * MF-0007 (CONTEXT.md Attempt, Spoiled): the attempts that may grow a tree. Attempts on a rejected
 * question are dropped; attempts a learner made on a question at or after reviewing it are
 * dropped (reviewing shows the key); attempts on a flagged question still count.
 */
export function countableAttempts(
  attempts: readonly Attempt[],
  context: ReviewContext,
): Attempt[] {
  return attempts.filter((attempt) => {
    if (context.rejected.has(attempt.questionId)) return false;
    const spoiledAt = context.spoiledAt.get(attempt.questionId);
    return (
      spoiledAt === undefined ||
      attempt.answeredAt.getTime() < spoiledAt.getTime()
    );
  });
}
