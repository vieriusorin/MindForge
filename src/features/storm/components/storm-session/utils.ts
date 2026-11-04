import type { QuestionStatus, StormSessionQuestion } from "./types";

/**
 * MF-0013: seconds left until the DB deadline, never negative. Always derived from `ends_at`
 * and the current clock, never from a client start time, so reloads and tabs agree.
 */
export function remainingSeconds(endsAtIso: string, nowMs: number): number {
  const left = Math.ceil((Date.parse(endsAtIso) - nowMs) / 1000);
  return Math.max(0, left);
}

const pad = (n: number): string => String(n).padStart(2, "0");

/** `h:mm:ss` from an hour up, `mm:ss` below; `--:--` before the clock has been read. */
export function formatCountdown(seconds: number | null): string {
  if (seconds === null) return "--:--";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** A question counts as answered once exactly `select` options are picked (what the DB stores). */
export function isAnswered(chosen: readonly string[], select: number): boolean {
  return chosen.length === select;
}

/**
 * MF-0013: what a pick change sends to the DB. A complete answer is stored; a saved answer that
 * drops below `select` picks is cleared (`[]`) so the screen and the DB agree; a partial pick
 * that was never complete sends nothing (`null`).
 */
export function storedAnswerChange(
  previous: readonly string[],
  next: readonly string[],
  select: number,
): readonly string[] | null {
  if (isAnswered(next, select)) return next;
  if (isAnswered(previous, select)) return [];
  return null;
}

export function questionStatus(
  chosen: readonly string[],
  select: number,
): QuestionStatus {
  return isAnswered(chosen, select) ? "Answered" : "Not answered";
}

/** The polite announcement: silent except near the end, so it speaks once per threshold. */
export function countdownAnnouncement(seconds: number | null): string {
  if (seconds === null || seconds > 300) return "";
  if (seconds === 0) return "Time is up.";
  if (seconds > 60) return "5 minutes left.";
  return "1 minute left.";
}

/** The answers already stored for a storm, keyed by question id (a reload resumes them). */
export function initialChoices(
  questions: readonly StormSessionQuestion[],
): Record<string, readonly string[]> {
  return Object.fromEntries(
    questions.map((q) => [q.question.id, q.chosen ?? []]),
  );
}

export function unansweredCount(
  questions: readonly StormSessionQuestion[],
  choices: Readonly<Record<string, readonly string[]>>,
): number {
  return questions.filter(
    (q) => !isAnswered(choices[q.question.id] ?? [], q.question.select),
  ).length;
}

/** The Finish confirmation's warning (AlertDialog description). */
export function finishWarning(unanswered: number): string {
  if (unanswered === 0) return "Every question has an answer.";
  if (unanswered === 1)
    return "1 question is not answered and counts as wrong.";
  return `${unanswered} questions are not answered and count as wrong.`;
}
