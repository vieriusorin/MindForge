import type { Question } from "../questions/types";
import type { ITEM_LEVELS } from "./level";
import type {
  CUCKOO_FLAW_KINDS,
  CUCKOO_SNIPPET_KINDS,
  DIAGRAM_DIRECTIONS,
  DIAGRAM_NODE_SHAPES,
} from "./schema";

/** CONTEXT.md Origin: who wrote an item. Fixed in the file; a review never changes it. */
export type Origin = "official" | "human" | "ai";

/** MF-0031: the audience an item is pitched at (junior → senior). */
export type ItemLevel = (typeof ITEM_LEVELS)[number];

/** CONTEXT.md Review state. Computed from reviews (MF-0007), never stored in a file (ADR 0001). */
export const REVIEW_STATES = [
  "unreviewed",
  "approved",
  "flagged",
  "rejected",
] as const;
export type ReviewState = (typeof REVIEW_STATES)[number];

/** MF-0007 / MF-0016: the kinds of item a pack holds; each one is reviewed. */
export const ITEM_TYPES = ["question", "card", "diagram", "cuckoo"] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

/** Practice modes serve approved + unreviewed; storms prefer approved (CONTEXT.md Playable). */
export type PlayMode = "practice" | "storm";

/** MF-0008 / MF-0014: model + prompt version of an `ai` item, written by the pipeline. Never sent to the browser. */
export interface GeneratedBy {
  model: string;
  prompt: string;
}

export interface NatureCard {
  id: string;
  skill: string;
  concept: string;
  origin: Origin;
  author?: string;
  generatedBy?: GeneratedBy;
  level?: ItemLevel;
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
  generatedBy?: GeneratedBy;
  level?: ItemLevel;
  direction: DiagramDirection;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  sources: string[];
}

/** MF-0016: what a Spot the Cuckoo snippet is, and what kind of flaw is planted in it. */
export type CuckooSnippetKind = (typeof CUCKOO_SNIPPET_KINDS)[number];
export type CuckooFlawKind = (typeof CUCKOO_FLAW_KINDS)[number];

/**
 * MF-0016 (Spot the Cuckoo): a short snippet with exactly one planted flaw. Graded like a question
 * (`record_attempt`), with the 1-based line number as the only option id.
 */
export interface Cuckoo {
  id: string;
  skill: string;
  /** What the learner is looking at ("A tool result returned to your support agent"). */
  title: string;
  origin: Origin;
  author?: string;
  generatedBy?: GeneratedBy;
  snippetKind: CuckooSnippetKind;
  lines: string[];
  /** 1-based index into `lines`: the key. Never sent to the browser before grading. */
  flawLine: number;
  flawKind: CuckooFlawKind;
  explanation: string;
  /** https URLs */
  sources: string[];
}

/** What the browser may see before answering: no flaw line, kind, explanation or author. */
export interface PlayableCuckoo {
  id: string;
  skillCode: string;
  origin: Origin;
  title: string;
  snippetKind: CuckooSnippetKind;
  lines: string[];
  /** The version the learner reads; the answer sends it back (C-4). */
  contentHash: string;
}

/** Revealed only after the database graded the answer. */
export interface CuckooFeedback {
  correct: boolean;
  flawLine: number;
  flawKind: CuckooFlawKind;
  explanation: string;
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
  /** MF-0016: absent = none. */
  cuckoos?: ContentFile[];
}

export interface PackContent {
  questions: Question[];
  cards: NatureCard[];
  diagrams: Diagram[];
  /** MF-0016: optional so pre-cuckoo fixtures (frozen MF-0010/0014 tests) still type; absent = none. */
  cuckoos?: Cuckoo[];
}

/** MF-0016: what the loader returns; every kind is present. */
export interface LoadedPackContent extends PackContent {
  cuckoos: Cuckoo[];
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
