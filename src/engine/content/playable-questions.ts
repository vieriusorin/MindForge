import type { Question } from "../questions/types";
import { isPlayable, reviewStateOf } from "./review";
import type { PlayMode, ReviewContext } from "./types";

/** The questions a learner may be served in `mode` (CONTEXT.md Playable). Order is kept. */
export function playableQuestions(
  questions: readonly Question[],
  review: ReviewContext,
  mode: PlayMode,
): Question[] {
  return questions.filter((q) => isPlayable(reviewStateOf(review, q), mode));
}
