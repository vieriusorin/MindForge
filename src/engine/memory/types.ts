/** MF-0065 (ADR 0007): the learner's own tap before the reveal. Absent or null = no tap. */
export const CONFIDENCES = ["sure", "unsure"] as const;
export type Confidence = (typeof CONFIDENCES)[number];

/** One graded answer. `correct` is computed by the database, never by the client. */
export interface Attempt {
  questionId: string;
  skillCode: string;
  correct: boolean;
  answeredAt: Date;
  /** MF-0065: grades the FSRS rating (ADR 0007). Never read for a group figure. */
  confidence?: Confidence | null;
  /** MF-0065: the option ids picked, read by the misconception tally. */
  chosen?: readonly string[];
}
