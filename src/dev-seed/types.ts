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

/**
 * MF-0052 SC-1: when a learner joined a world's group (`group_members.joined_at`). Backdated before
 * the world's first planned answer; across worlds planned together, an exam pack's join is the newest,
 * so `listMyGroups(you)[0]` (ordered by `joined_at desc`) is deterministic.
 */
export interface PlannedJoin {
  email: string;
  joinedAt: Date;
}

/** MF-0052 SC-3: one question of a planned storm. `chosen` null = left unanswered. Graded by the DB, never here. */
export interface PlannedStormQuestion {
  questionId: string;
  skillCode: string;
  domainCode: string;
  /** The registry hash the storm binds to (`storm_questions.content_hash`); `finalize_storm` voids on a mismatch. */
  contentHash: string;
  chosen: string[] | null;
  /** Null exactly when `chosen` is null; becomes the attempt's `answered_at` at `finalize_storm`. */
  chosenAt: Date | null;
}

/**
 * MF-0052 SC-3: a storm played in the past. The seed inserts it unfinished and lets
 * `private.finalize_storm` grade it, so `endsAt` must lie before `now` (finished_at = least(now(), ends_at)).
 */
export interface PlannedStorm {
  email: string;
  kind: "full" | "boss";
  /** Boss Storm only (`storms_boss_has_domain`). */
  domainCode: string | null;
  startedAt: Date;
  endsAt: Date;
  questions: PlannedStormQuestion[];
}

/** MF-0052 SC-5: the group's running expedition. MF-0059: open, with no end (own pace). */
export interface PlannedExpedition {
  domainCode: string;
  target: number;
  startsAt: Date;
  createdByEmail: string;
}

export interface DemoWorld {
  learners: PlannedLearner[];
  /** Created by a demo learner (so a re-run's cascade removes it); `you` joins as admin. */
  group: { name: string; packSlug: string; createdByEmail: string };
  attempts: PlannedAttempt[];
  reviews: PlannedReview[];
  /** MF-0052 SC-1: one per learner. */
  joins: PlannedJoin[];
  /** MF-0052 SC-3: empty for a pack without an exam. */
  storms: PlannedStorm[];
  /** MF-0052 SC-5. */
  expedition: PlannedExpedition | null;
}

/** What a run leaves behind so the next run can replace your seeded rows (and only those). */
export interface SeedManifest {
  /** The account the ids belong to: after a `pnpm db:reset` ids restart, so another account's ids mean nothing. */
  youId: string;
  youAttemptIds: number[];
  /** MF-0052 SC-8: your seeded storms. Absent in a manifest written before MF-0052. */
  youStormIds?: string[];
}
