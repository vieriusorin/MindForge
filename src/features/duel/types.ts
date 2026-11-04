import type { AnswerFeedback } from "@/engine/questions";
import type { ActionResult } from "@/lib/action-result";

export type AnswerQuestionResult = ActionResult<{ feedback: AnswerFeedback }>;

/** MF-0012: the finish screen's way out of the duel. */
export interface DuelBackLink {
  href: string;
  label: string;
}
