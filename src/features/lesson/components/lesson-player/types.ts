import type { ReactNode, Ref } from "react";
import type { LessonProgress } from "@/engine/lesson";
import type { AnswerFeedback } from "@/engine/questions";
import type { PlayerStep } from "../../types";
import type { QuestionStep } from "./utils";

export interface LessonPlayerProps {
  packSlug: string;
  skillCode: string;
  /** The planned steps; re-asks are added as items are missed. */
  steps: PlayerStep[];
  /** ISO time the page was rendered on the server; the close screen counts attempts from here. */
  startedAt: string;
  /** Server-rendered nature card, shown on the `card` step. */
  card: ReactNode;
  /** Server-rendered diagram, shown on the `diagram` step. */
  diagram: ReactNode;
  mapHref: string;
}

export interface ProgressBarProps {
  progress: LessonProgress;
}

export interface TeachStepProps {
  meta: string;
  slot: ReactNode;
  onContinue: () => void;
}

export interface GuessStepProps {
  step: Extract<PlayerStep, { kind: "guess" }>;
  meta: string;
  chosen: readonly string[];
  canLock: boolean;
  onToggle: (optionId: string) => void;
  onLock: () => void;
  onSkip: () => void;
}

export interface QuestionStepProps {
  step: QuestionStep;
  meta: string;
  chosen: readonly string[];
  feedback: AnswerFeedback | null;
  announcement: string;
  guessNote: string | null;
  error: string | null;
  isPending: boolean;
  canSubmit: boolean;
  isLast: boolean;
  feedbackRef: Ref<HTMLOutputElement>;
  onToggle: (optionId: string) => void;
  onSubmit: () => void;
  onNext: () => void;
}

export interface WhyPanelProps {
  step: QuestionStep;
  feedback: AnswerFeedback;
}

export interface EmptyLessonProps {
  mapHref: string;
}
