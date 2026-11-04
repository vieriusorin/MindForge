import type { CuckooFeedback } from "@/engine/content";
import type { ActionResult } from "@/lib/action-result";

export type AnswerCuckooResult = ActionResult<{ feedback: CuckooFeedback }>;

/** The finish screen's way out of the round. */
export interface CuckooBackLink {
  href: string;
  label: string;
}
