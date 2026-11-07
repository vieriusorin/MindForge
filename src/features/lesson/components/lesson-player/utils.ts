import type { LessonSegment, LessonStepKind } from "@/engine/lesson";
import { reaskQuestionIds } from "@/engine/lesson";
import type { AnswerFeedback, PlayableQuestion } from "@/engine/questions";
import type { PlayerStep } from "../../types";

/** A step that shows a question, graded or not. */
export type QuestionStep = Extract<PlayerStep, { question: PlayableQuestion }>;

/** Steps graded through `record_attempt` (D-L4: the guess never is). */
export function isGradedStep(step: PlayerStep): boolean {
  return (
    step.kind === "recall" ||
    step.kind === "confusable" ||
    step.kind === "reask"
  );
}

/** A miss on these steps earns a re-ask (D-L8: never the guess, never a re-ask). */
export function earnsReask(step: PlayerStep): boolean {
  return step.kind === "recall" || step.kind === "confusable";
}

/**
 * MF-0064 D-L8: the planned steps plus one `reask` per missed item, as the engine allows
 * (`reaskQuestionIds`: miss order, once each, within 12 interactions).
 */
export function withReasks(
  steps: readonly PlayerStep[],
  missedIds: readonly string[],
): PlayerStep[] {
  const questions = new Map<string, PlayableQuestion>();
  for (const step of steps) {
    if ("question" in step && earnsReask(step)) {
      questions.set(step.question.id, step.question);
    }
  }
  const reasks = reaskQuestionIds({ plannedCount: steps.length, missedIds })
    .map((id) => questions.get(id))
    .filter((q): q is PlayableQuestion => q !== undefined)
    .map((question): PlayerStep => ({ kind: "reask", question }));
  return [...steps, ...reasks];
}

/** D-L4: what the graded recall says about the learner's earlier guess, or null with no guess. */
export function guessLine(
  guess: readonly string[] | undefined,
  feedback: AnswerFeedback | null,
): string | null {
  if (!guess || guess.length === 0 || !feedback) return null;
  const key = [...feedback.correctOptionIds].sort();
  const picked = [...guess].sort();
  const isRight =
    key.length === picked.length && key.every((id, i) => id === picked[i]);
  return isRight
    ? "Your guess before the lesson was right."
    : "Your guess before the lesson was not the answer.";
}

/** The line above each step. MF-0066: a new kind fails to compile until it has one. */
export const STEP_META = {
  guess: "Guess first",
  card: "Nature card",
  diagram: "Diagram",
  recall: "Recall",
  confusable: "From an earlier skill",
  reask: "Try again",
} as const satisfies Record<LessonStepKind, string>;

/** The meta line for a step; the confusable one names its earlier skill. */
export function stepMeta(step: PlayerStep): string {
  return step.kind === "confusable"
    ? `${STEP_META.confusable}: ${step.skillName}`
    : STEP_META[step.kind];
}

/** "Step k of n". */
export function stepCountLine(position: number, total: number): string {
  return `Step ${position} of ${total}`;
}

/** Fill of each progress segment. */
export const SEGMENT_VALUE = {
  done: 100,
  current: 50,
  todo: 0,
} as const satisfies Record<LessonSegment, number>;
