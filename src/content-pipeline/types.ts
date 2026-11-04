/**
 * MF-0008: the offline content pipeline (corpus → writer batch → verifier → YAML). Never imported by
 * the app. The Claude client is injected, so every decision here is testable without a key.
 */

/** One fetched source page (CONTEXT.md Source), as cached in `.cache/corpus/`. */
export interface CorpusEntry {
  url: string;
  skill: string;
  /** ISO timestamp of the last fetch that returned a body. */
  fetchedAt: string;
  /** sha256 (hex) of `text`. */
  hash: string;
  etag: string | null;
  text: string;
}

export interface CorpusStore {
  get(url: string): CorpusEntry | undefined;
  put(entry: CorpusEntry): void;
}

export type FetchResult =
  | {
      status: 200;
      body: string;
      etag: string | null;
      /** The response Content-Type; absent means HTML. */
      contentType?: string | null;
    }
  | { status: 304 };

/** The network edge: a conditional GET. Injected so tests never touch the network. */
export type FetchPage = (
  url: string,
  options: { etag: string | null },
) => Promise<FetchResult>;

export interface CorpusReport {
  fetched: string[];
  unchanged: string[];
  /** URLs refused before any request (non-https, skilljar). */
  refused: string[];
  /** Fetched, but not a type the corpus can hold as text (e.g. PDF); not stored. */
  unsupported: string[];
}

export interface SkillSources {
  skill: string;
  urls: string[];
}

/** A Message Batches request as sent to `client.messages.batches.create({ requests })`. */
export interface BatchRequest {
  custom_id: string;
  params: {
    model: string;
    max_tokens: number;
    system: {
      type: "text";
      text: string;
      cache_control?: { type: "ephemeral" };
    }[];
    messages: { role: "user"; content: string }[];
    output_config: {
      format: { type: "json_schema"; schema: Record<string, unknown> };
    };
  };
}

/** What the writer model returns for one question (parsed, before code adds provenance). */
export interface Draft {
  stem: string;
  options: { id: string; text: string; correct: boolean; rationale: string }[];
  citation: { url: string; title: string };
}

/** Who and what produced an `ai` item: written into the YAML by code, never by the model. */
export type { GeneratedBy } from "@/engine/content";

export interface Dropped {
  index: number;
  reason: string;
}

/** A prompt file: `---\nname: <name>\nversion: <n>\n---\n<body>`. */
export interface Prompt {
  name: string;
  version: number;
  body: string;
}

/** `prompts/prompt-lock.json`: the body hash each version was released with. */
export type PromptLock = Record<string, { version: number; bodyHash: string }>;

export const FLAWS = [
  "wrong-key",
  "missing-rationale",
  "wrong-citation",
] as const;
export type Flaw = (typeof FLAWS)[number];

/** A golden-set case: an official sample (no flaw) or a planted variant of one. */
export interface EvalCase {
  id: string;
  flaw: Flaw | null;
}

export interface Verdict {
  id: string;
  flaws: Flaw[];
}

export interface EvalScore {
  /** Share of planted cases of each flaw type that the verifier named. */
  catchRate: Record<Flaw, number>;
  /** Clean cases the verifier flagged anyway. */
  falseAlarms: number;
  passed: boolean;
}

/** `usage` of one batch result message. */
export interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
}

/** The part of the Anthropic client the guard may call. */
export interface BatchClient {
  create(requests: BatchRequest[]): Promise<{ id: string }>;
}

/** MF-0014: the item kinds the card and diagram writers produce. */
export type ItemKind = "card" | "diagram";

/** What the card writer model returns (parsed, before code adds provenance). Empty optional text = omitted. */
export interface CardDraft {
  concept: string;
  simply: string;
  inNature: string;
  whereItBreaks: string[];
  contrast: string;
  whyTheName: string;
  sources: string[];
}

/** What the diagram writer model returns (ADR 0003 graph). An empty edge label = no label. */
export interface DiagramDraft {
  title: string;
  direction: "LR" | "TB";
  nodes: { id: string; label: string; shape: "step" | "decision" }[];
  edges: { from: string; to: string; label: string }[];
  sources: string[];
}

/** MF-0014 SC-5: `empty-break` is caught by code, the rest by the verifier model. */
export const CARD_FLAWS = [
  "empty-break",
  "generic-break",
  "factual-error",
  "wrong-citation",
] as const;
export type CardFlaw = (typeof CARD_FLAWS)[number];

export const DIAGRAM_FLAWS = [
  "wrong-edge",
  "factual-error",
  "wrong-citation",
] as const;
export type DiagramFlaw = (typeof DIAGRAM_FLAWS)[number];

export type ItemFlaw = CardFlaw | DiagramFlaw;

/** A card or diagram golden case: a pack item (unchanged or planted) and the flaw planted in it. */
export interface ItemGoldenCase {
  id: string;
  kind: ItemKind;
  flaw: ItemFlaw | null;
  item: Record<string, unknown>;
}

export interface ItemVerdict {
  id: string;
  flaws: ItemFlaw[];
}

export interface ItemEvalScore {
  /** Share of planted cases of each flaw type caught by code or by the verifier. */
  catchRate: Record<string, number>;
  falseAlarms: number;
  passed: boolean;
}

/** MF-0014 SC-1: the skills a card or diagram run drafts for, and the ones it cannot. */
export interface ItemRunPlan {
  skills: { code: string; request: number }[];
  skipped: { code: string; reason: string }[];
}
