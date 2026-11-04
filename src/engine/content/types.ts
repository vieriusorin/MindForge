import type { Question } from "../questions/types";
import type { DIAGRAM_DIRECTIONS, DIAGRAM_NODE_SHAPES } from "./schema";

/** CONTEXT.md Origin: who wrote an item. Fixed in the file; a review never changes it. */
export type Origin = "official" | "human" | "ai";

/** CONTEXT.md Review state. Computed from reviews (MF-0007), never stored in a file (ADR 0001). */
export const REVIEW_STATES = [
  "unreviewed",
  "approved",
  "flagged",
  "rejected",
] as const;
export type ReviewState = (typeof REVIEW_STATES)[number];

/** MF-0007: the kinds of item a pack holds; each one is reviewed. */
export const ITEM_TYPES = ["question", "card", "diagram"] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

/** Practice modes serve approved + unreviewed; storms prefer approved (CONTEXT.md Playable). */
export type PlayMode = "practice" | "storm";

export interface NatureCard {
  id: string;
  skill: string;
  concept: string;
  origin: Origin;
  author?: string;
  simply: string;
  inNature: string;
  whereItBreaks: string[];
  contrast?: string;
  whyTheName?: string;
  /** id of a Diagram in the same pack */
  diagram?: string;
  /** https URLs */
  sources: string[];
}

/** ADR 0003: diagrams are graphs, drawn with React Flow; the words are the source of truth. */
export type DiagramDirection = (typeof DIAGRAM_DIRECTIONS)[number];
export type DiagramNodeShape = (typeof DIAGRAM_NODE_SHAPES)[number];

export interface DiagramNode {
  id: string;
  label: string;
  /** Absent = "step". */
  shape?: DiagramNodeShape;
}

export interface DiagramEdge {
  from: string;
  to: string;
  label?: string;
}

export interface Diagram {
  id: string;
  skill: string;
  title: string;
  origin: Origin;
  author?: string;
  direction: DiagramDirection;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  sources: string[];
}

/** One content file as read from disk; `name` appears in every error about it. */
export interface ContentFile {
  name: string;
  text: string;
}

export interface ContentFiles {
  questions: ContentFile[];
  cards: ContentFile[];
  diagrams: ContentFile[];
}

export interface PackContent {
  questions: Question[];
  cards: NatureCard[];
  diagrams: Diagram[];
}

/** The review seam (SC-8). MF-0007 fills it from `item_reviews`; until then it is empty. */
export interface ReviewContext {
  states: Map<string, ReviewState>;
  rejected: Set<string>;
  spoiledBy: Set<string>;
  /** MF-0007: when this learner first reviewed each spoiled item; later attempts on it don't count. */
  spoiledAt: Map<string, Date>;
}

/** MF-0007: one row of `public.review_states(pack)` for the signed-in learner, as the server reads it. */
export interface ReviewRow {
  itemId: string;
  state: ReviewState;
  /** ISO timestamp of this learner's first review of the item (any version), or null. */
  reviewedAt: string | null;
}

/** MF-0007: an item in the signed-in learner's review queue, as the server reads it. */
export interface ReviewCandidate {
  itemId: string;
  skillCode: string;
  itemType: ItemType;
  /** The registry's current version of the item (its content hash). */
  contentHash: string;
}

/** MF-0010: what a learner meets when planting a skill: card → diagram → checks. */
export interface SeedPlanting {
  card: NatureCard | null;
  diagram: Diagram | null;
  checks: Question[];
}
