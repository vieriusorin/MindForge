/** One graded answer. `correct` is computed by the database, never by the client. */
export interface Attempt {
  questionId: string;
  skillCode: string;
  correct: boolean;
  answeredAt: Date;
}
