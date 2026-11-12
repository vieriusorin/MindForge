import type { Ref } from "react";
import type { OrderFeedback, PlayableOrder } from "@/engine/content";
import type { PlayerStep } from "../../types";

/** MF-0066: one shown step of an order (the playable copy). */
export type ShownStep = PlayableOrder["steps"][number];

/** Which control gets keyboard focus after a move: an Add button by step id, or Check order. */
export type FocusKey = `add:${string}` | "check";

export type OrderPlayerStep = Extract<PlayerStep, { kind: "order" }>;

export interface OrderStepProps {
  step: OrderPlayerStep;
  meta: string;
  packSlug: string;
  isLast: boolean;
  onNext: () => void;
}

export interface StepPoolProps {
  pool: readonly ShownStep[];
  isLocked: boolean;
  onAdd: (id: string) => void;
}

export interface AnswerListProps {
  answer: readonly ShownStep[];
  isLocked: boolean;
  onRemove: (id: string) => void;
}

export interface OrderFeedbackPanelProps {
  feedback: OrderFeedback;
  verdict: string;
  feedbackRef: Ref<HTMLOutputElement>;
}
