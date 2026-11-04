import type { AnswerFeedback, Question } from "@/engine/questions";

/**
 * MF-0013: a finished storm question's key and rationales, read from the pack file. Only the
 * finished branch of /storms/[id] calls this (SC-4). `correct` is the DB's grade: null
 * (unanswered or voided) reads as not correct.
 */
export function reviewFeedback(
  question: Question,
  correct: boolean | null,
): AnswerFeedback {
  return {
    correct: correct === true,
    correctOptionIds: question.options
      .filter((o) => o.correct)
      .map((o) => o.id),
    rationales: Object.fromEntries(
      question.options.map((o) => [o.id, o.rationale]),
    ),
  };
}
