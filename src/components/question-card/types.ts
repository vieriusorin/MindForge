import type { ReactNode, Ref } from "react";
import type { AnswerFeedback, PlayableQuestion } from "@/engine/questions";

/** How one option reads after grading: the key, a wrong pick, or neither. */
export type OptionState = "key" | "missed" | "plain";

export interface QuestionCardProps {
  question: PlayableQuestion;
  /** Progress, skill name, reason badges: whatever the mode shows above the stem. */
  meta: ReactNode;
  chosen: readonly string[];
  feedback: AnswerFeedback | null;
  /** Options can't change (answered, or grading in flight). */
  isLocked: boolean;
  onToggle: (optionId: string) => void;
  /** The stem heading; the mode moves focus here when a new question appears. */
  headingRef?: Ref<HTMLHeadingElement>;
  /** Live region, errors and buttons. */
  footer: ReactNode;
  /**
   * MF-0064: false keeps each option's verdict but leaves the rationales to the mode (the lesson's
   * "Why?"). Defaults to true: every other mode shows them inline.
   */
  showRationales?: boolean;
}
