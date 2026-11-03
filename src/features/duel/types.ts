export interface AnswerFeedback {
  correct: boolean;
  correctOptionIds: string[];
  rationales: Record<string, string>;
}

export type AnswerResult =
  | { ok: true; feedback: AnswerFeedback }
  | { ok: false; message: string };
