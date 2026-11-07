import type { Confidence } from "@/engine/memory";

/** MF-0067: the client attempt id held for one submission (an item and the answer chosen for it). */
export interface HeldAttemptId {
  readonly submission: string;
  readonly id: string;
}

/**
 * MF-0067: the id to send for `submission`. The same submission (a retry after an error) keeps the held
 * id, so the database records it once; any other submission (a changed answer, another item) gets a
 * fresh id from `mint`.
 */
export function attemptIdFor({
  held,
  submission,
  mint,
}: {
  held: HeldAttemptId | null;
  submission: string;
  mint: () => string;
}): HeldAttemptId {
  if (held !== null && held.submission === submission) return held;
  return { submission, id: mint() };
}

/**
 * MF-0067: one key per (item, answer); the answer is the chosen option ids or a cuckoo line. MF-0065: the
 * confidence tap is part of the answer, so a changed tap is a new submission (a new id, never a 23505).
 */
export function submissionKey(
  itemId: string,
  answer: readonly string[] | number,
  confidence: Confidence | null = null,
): string {
  return confidence === null
    ? JSON.stringify([itemId, answer])
    : JSON.stringify([itemId, answer, confidence]);
}
