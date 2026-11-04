import type { AnswerFeedback } from "@/engine/questions";

export type { AnswerFeedback };

export type AnswerResult =
  | { ok: true; feedback: AnswerFeedback }
  | { ok: false; message: string };
