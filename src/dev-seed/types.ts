/**
 * MF-0029: the local demo world. Pure planning (`plan-demo-world.ts`) is separate from the writes
 * (`seed-demo-world.ts`), so the plan is tested without a database. Never imported by the app.
 */

export const PERSONAS = [
  "steady",
  "crammer",
  "lapsed",
  "new",
  "strong",
  "you",
] as const;
export type Persona = (typeof PERSONAS)[number];

/** A question as the planner needs it: its option ids and its answer key (from the pack files). */
export interface SeedQuestion {
  questionId: string;
  skillCode: string;
  packSlug: string;
  optionIds: string[];
  correctOptions: string[];
}

/** A pack item with the content hash the review registry holds (MF-0007). */
export interface SeedItem {
  itemId: string;
  itemType: "question" | "card" | "diagram";
  skillCode: string;
  origin: "official" | "human" | "ai";
  authorEmail: string | null;
  contentHash: string;
}

export interface PlannedLearner {
  email: string;
  displayName: string;
  persona: Persona;
}

export interface PlannedAttempt {
  email: string;
  questionId: string;
  skillCode: string;
  packSlug: string;
  chosen: string[];
  correct: boolean;
  answeredAt: Date;
}

export interface PlannedReview {
  reviewerEmail: string;
  itemId: string;
  contentHash: string;
  verdict: "approve" | "flag";
  comment: string | null;
  createdAt: Date;
}

export interface DemoWorld {
  learners: PlannedLearner[];
  /** Created by a demo learner (so a re-run's cascade removes it); `you` joins as admin. */
  group: { name: string; packSlug: string; createdByEmail: string };
  attempts: PlannedAttempt[];
  reviews: PlannedReview[];
}

/** What a run leaves behind so the next run can replace your seeded rows (and only those). */
export interface SeedManifest {
  /** The account the ids belong to: after a `pnpm db:reset` ids restart, so another account's ids mean nothing. */
  youId: string;
  youAttemptIds: number[];
}
