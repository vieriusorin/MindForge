import type { OrderFeedback, PlayableOrder } from "@/engine/content";
import type { LessonStepKind } from "@/engine/lesson";
import type { AnswerFeedback, PlayableQuestion } from "@/engine/questions";
import type { ActionResult } from "@/lib/action-result";

/**
 * MF-0064: a lesson step as the browser receives it. Questions are playable copies (no key, no
 * rationale); the card and diagram arrive as server-rendered slots, so their steps carry nothing.
 */
export type PlayerStep =
  | { kind: "guess"; question: PlayableQuestion }
  | { kind: "card" }
  | { kind: "diagram" }
  | { kind: "recall"; question: PlayableQuestion }
  | { kind: "confusable"; question: PlayableQuestion; skillName: string }
  | { kind: "reask"; question: PlayableQuestion }
  | { kind: "order"; order: PlayableOrder };

/** Compile-time check: the player renders exactly the engine's closed set of step kinds. */
export type PlayerStepKindsMatch = [LessonStepKind] extends [PlayerStep["kind"]]
  ? [PlayerStep["kind"]] extends [LessonStepKind]
    ? true
    : never
  : never;
// MF-0064 review: the check only bites when used; this line fails to compile when the kinds drift.
true satisfies PlayerStepKindsMatch;

export type AnswerLessonItemResult = ActionResult<{ feedback: AnswerFeedback }>;

/** MF-0066: the graded order, its key and why. */
export type AnswerLessonOrderResult = ActionResult<{ feedback: OrderFeedback }>;
