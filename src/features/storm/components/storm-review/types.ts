import type { AnswerFeedback, PlayableQuestion } from "@/engine/questions";

/** One finished storm question with its key: built on the server only after the storm ended. */
export interface StormReviewItem {
  question: PlayableQuestion;
  /** [] when unanswered. */
  chosen: readonly string[];
  /** The DB's grade; null when unanswered or voided. */
  correct: boolean | null;
  voided: boolean;
  unreviewed: boolean;
  feedback: AnswerFeedback;
}

export type ReviewVerdict = "Correct" | "Wrong" | "Not answered" | "Voided";

export interface StormReviewProps {
  items: StormReviewItem[];
  skillNames: Record<string, string>;
}
