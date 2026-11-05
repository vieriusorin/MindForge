import { type ReviewContext, reviewStateOf } from "@/engine/content";
import type { Question } from "@/engine/questions";
import type { StormCandidate } from "@/engine/storm";

export interface BuildStormCandidatesInput {
  readonly questions: readonly Pick<Question, "id" | "skillCode" | "origin">[];
  readonly review: ReviewContext;
  /** Deployed-file content hashes by item id: the version the learner will read. */
  readonly hashes: Readonly<Record<string, string>>;
  /** Question ids from the learner's earlier storms. */
  readonly seen: ReadonlySet<string>;
}

/**
 * The composer's pool for one learner. A question without a deployed hash is dropped: the DB
 * would refuse it at start. Flagged, rejected and spoiled ones are kept and marked; the composer
 * excludes them.
 */
export function buildStormCandidates({
  questions,
  review,
  hashes,
  seen,
}: BuildStormCandidatesInput): StormCandidate[] {
  return questions
    .filter((q) => Object.hasOwn(hashes, q.id))
    .map((q) => ({
      id: q.id,
      skillCode: q.skillCode,
      state: reviewStateOf(review, q),
      spoiled: review.spoiledBy.has(q.id),
      seenInStorm: seen.has(q.id),
    }));
}
