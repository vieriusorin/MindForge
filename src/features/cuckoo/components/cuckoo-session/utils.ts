import type { CuckooFeedback } from "@/engine/content";

/** The live region's verdict once the database graded the answer. */
export function verdictMessage(feedback: CuckooFeedback): string {
  return feedback.correct
    ? "Correct! You spotted the cuckoo."
    : `Not quite. The cuckoo was on line ${feedback.flawLine}.`;
}

/** Check answer is enabled only with a line picked, before grading, with nothing in flight. */
export function canCheck({
  chosenLine,
  isAnswered,
  isPending,
}: {
  chosenLine: number | null;
  isAnswered: boolean;
  isPending: boolean;
}): boolean {
  return chosenLine !== null && !isAnswered && !isPending;
}

export type LineState = "cuckoo" | "missed" | "plain";

/** After grading: the flawed line, the learner's wrong pick, or neither. Before grading: plain. */
export function lineState(
  line: number,
  chosenLine: number | null,
  feedback: CuckooFeedback | null,
): LineState {
  if (!feedback) return "plain";
  if (line === feedback.flawLine) return "cuckoo";
  return line === chosenLine ? "missed" : "plain";
}

/** A blank line can't hold the flaw (schema), so it isn't offered as a choice. */
export function isChoosable(text: string): boolean {
  return text.trim() !== "";
}

/** The forward button's label: a refused snippet can only be skipped; the last one finishes. */
export function nextLabel({
  isRefused,
  isLast,
}: {
  isRefused: boolean;
  isLast: boolean;
}): string {
  if (isRefused) return "Skip this snippet";
  return isLast ? "Finish" : "Next snippet";
}
