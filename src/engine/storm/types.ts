import type { ReviewState } from "../content/types";
import type { MemorySnapshot } from "../forest/tree-stage";

export const STORM_KINDS = ["full", "boss"] as const;
export type StormKind = (typeof STORM_KINDS)[number];

/** One question the composer may pick, with everything the choice depends on (MF-0013). */
export interface StormCandidate {
  readonly id: string;
  readonly skillCode: string;
  readonly state: ReviewState;
  /** The learner reviewed it (CONTEXT.md "Spoiled"): never served in their storms. */
  readonly spoiled: boolean;
  /** It was in one of the learner's earlier storms: used only when the pool is otherwise short. */
  readonly seenInStorm: boolean;
}

export interface StormPlanQuestion {
  readonly id: string;
  readonly skillCode: string;
  readonly domainCode: string;
  /** Filled from the unreviewed pool; the report labels it. */
  readonly unreviewed: boolean;
}

export interface StormPlan {
  readonly kind: StormKind;
  /** Boss Storm only. */
  readonly domainCode: string | null;
  readonly questions: readonly StormPlanQuestion[];
  readonly durationSeconds: number;
}

/** A finished storm's question as stored: graded by the DB at finish. */
export interface StormResultQuestion {
  readonly id: string;
  readonly skillCode: string;
  /** null = unanswered (wrong in the score, no attempt). */
  readonly chosen: readonly string[] | null;
  /** null when unanswered or voided. */
  readonly correct: boolean | null;
  /** Its content changed during the storm (CONTEXT.md "Voided question"). */
  readonly voided: boolean;
}

export interface StormResult {
  readonly kind: StormKind;
  readonly finishedAt: Date;
  readonly questions: readonly StormResultQuestion[];
}

export interface StormDomainReport {
  readonly domainCode: string;
  /** Scored questions (answered or not, never voided). */
  readonly scored: number;
  readonly correct: number;
  /** Whole percent, 0–100. */
  readonly percent: number;
  readonly survived: boolean;
}

export interface StormSkillReport {
  readonly skillCode: string;
  readonly scored: number;
  readonly correct: number;
  readonly proven: boolean;
}

export interface StormReport {
  readonly kind: StormKind;
  readonly finishedAt: Date;
  readonly domains: readonly StormDomainReport[];
  readonly skills: readonly StormSkillReport[];
  readonly voided: readonly string[];
}

/** MF-0015's input shape (ROADMAP §4.3: the receiver defines it; the second to merge wires it). */
export interface StormDomainScore {
  readonly domainCode: string;
  readonly percent: number;
  /** ISO 8601. */
  readonly finishedAt: string;
}

/** A skill's storm proof, derived from finished storms (GOAL.md: derived, never stored). */
export type SkillStormProof = Readonly<
  Pick<MemorySnapshot, "stormProven" | "fullStormProven">
>;
