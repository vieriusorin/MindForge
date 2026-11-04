import type { RefObject } from "react";
import type { StormSessionQuestion } from "../../types";

export type { StormSessionQuestion };

export type QuestionStatus = "Answered" | "Not answered";

export interface StormSessionProps {
  stormId: string;
  /** ISO 8601 deadline from the database: the only source of the countdown. */
  endsAt: string;
  questions: StormSessionQuestion[];
  skillNames: Record<string, string>;
}

/** One navigator entry: where it jumps and what it says in words (not colour alone). */
export interface NavigatorItem {
  questionId: string;
  number: number;
  status: QuestionStatus;
  isCurrent: boolean;
}

export interface UseStormSessionReturn {
  current: StormSessionQuestion;
  /** "Question 3 of 12". */
  positionLabel: string;
  chosen: readonly string[];
  navigator: NavigatorItem[];
  countdownLabel: string;
  /** Polite announcement at 5 min, 1 min and the end; empty otherwise. */
  announcement: string;
  /** Time is up or the storm is finishing: options and buttons stop accepting input. */
  isLocked: boolean;
  isSaving: boolean;
  isFinishing: boolean;
  isFirst: boolean;
  isLast: boolean;
  error: string | null;
  finishWarning: string;
  headingRef: RefObject<HTMLHeadingElement | null>;
  toggle: (optionId: string) => void;
  previous: () => void;
  next: () => void;
  goTo: (index: number) => void;
  finish: () => void;
}

export interface StormCountdownProps {
  label: string;
  announcement: string;
}

export interface StormNavigatorProps {
  items: NavigatorItem[];
  isLocked: boolean;
  onJump: (index: number) => void;
}

export interface FinishStormDialogProps {
  warning: string;
  isFinishing: boolean;
  isLocked: boolean;
  onConfirm: () => void;
}
