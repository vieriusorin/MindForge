import type { Diagram, NatureCard, OrderItem } from "../content/types";
import type { TreeState } from "../forest/tree-stage";
import type { Question } from "../questions/types";

/**
 * MF-0064: every kind of step a lesson can show, as one closed set. A plan holds the first five; the
 * player appends `reask` steps for items missed in this lesson. MF-0066 adds a kind here first.
 */
export const LESSON_STEP_KINDS = [
  "guess",
  "card",
  "diagram",
  "recall",
  "confusable",
  "reask",
  "order",
] as const;
export type LessonStepKind = (typeof LESSON_STEP_KINDS)[number];

/** One planned step. `guess` is never graded; `recall` and `confusable` are graded attempts. */
export type LessonStep =
  | { kind: "guess"; question: Question }
  | { kind: "card"; card: NatureCard }
  | { kind: "diagram"; diagram: Diagram }
  | { kind: "recall"; question: Question }
  | { kind: "confusable"; question: Question; skillCode: string };

/** MF-0066: the order step, kept out of `LessonStep` so a plan's question/teach steps keep their shape. */
export interface LessonOrderStep {
  kind: "order";
  order: OrderItem;
}

/** What the player is given: the plan's steps with its order step placed (`lessonSteps`). */
export type PlannedStep = LessonStep | LessonOrderStep;

export interface LessonPlan {
  skillCode: string;
  /** The skill had no successful recall (a Seed), so the lesson opens with a guess. */
  isNewSkill: boolean;
  /** The earlier skill the confusable step asks about, or null when none qualifies. */
  confusableSkill: string | null;
  steps: LessonStep[];
  /** MF-0066: the skill's order item to ask, or null; `lessonSteps` places it. */
  order: OrderItem | null;
  /** How many re-asks still fit under LESSON_MAX_INTERACTIONS. */
  maxReasks: number;
}

/** How a skill's tree moved during a lesson (MF-0064 D-L12). */
export const LESSON_CHANGES = ["grew", "watered", "shrank", "same"] as const;
export type LessonChange = (typeof LESSON_CHANGES)[number];

export interface LessonSkillOutcome {
  skillCode: string;
  name: string;
  before: TreeState;
  after: TreeState;
  change: LessonChange;
  /** Graded attempts on this skill at or after the lesson started. */
  answeredCount: number;
  correctCount: number;
  /** When this tree starts to fade (`nextReviewAt`); null for a Seed. */
  nextReviewAt: Date | null;
}

export interface LessonOutcome {
  packSlug: string;
  skillCode: string;
  /** The lesson's skill first, then every other skill answered since the start, in pack order. */
  skills: LessonSkillOutcome[];
}

/** The state of each segment of the progress bar. */
export type LessonSegment = "done" | "current" | "todo";

export interface LessonProgress {
  /** 1-based position of the current step. */
  position: number;
  total: number;
  segments: LessonSegment[];
}
