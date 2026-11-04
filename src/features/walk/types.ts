import type { WalkReason } from "@/engine/memory";
import type { AnswerFeedback, PlayableQuestion } from "@/engine/questions";
import type { ActionResult } from "@/lib/action-result";

/** One step of the walk as the browser sees it: no key, no rationale. */
export interface WalkStep {
  question: PlayableQuestion;
  reason: WalkReason;
}

export type AnswerWalkResult = ActionResult<{ feedback: AnswerFeedback }>;
