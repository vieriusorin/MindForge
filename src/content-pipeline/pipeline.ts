/**
 * MF-0008 content pipeline. Typed stubs written at freeze (Stage 2b): each throws until BUILD
 * implements it, so the frozen acceptance tests fail at runtime and typecheck stays green.
 * BUILD may split this into one file per function; the frozen tests import from here.
 */
import type {
  BatchClient,
  BatchRequest,
  CorpusEntry,
  CorpusReport,
  CorpusStore,
  Draft,
  Dropped,
  EvalCase,
  EvalScore,
  FetchPage,
  GeneratedBy,
  Prompt,
  PromptLock,
  SkillSources,
  Usage,
  Verdict,
} from "./types";

const notImplemented = (): never => {
  throw new Error("not implemented");
};

/** SC-1: fetch each skill's sources (conditional GET); refuse non-https and skilljar first. */
export async function syncCorpus(_input: {
  sources: SkillSources[];
  fetchPage: FetchPage;
  store: CorpusStore;
  now: Date;
}): Promise<CorpusReport> {
  return notImplemented();
}

/** SC-2: how many questions a skill still needs, and how many drafts to ask for. */
export function questionsNeeded(_input: { existing: number; count?: number }): {
  need: number;
  request: number;
} {
  return notImplemented();
}

/** SC-2: Batch-safe id for draft `index` of `skill` (`D2.S1`, 3 → `D2_S1-3`). */
export function customIdFor(_skill: string, _index: number): string {
  return notImplemented();
}

/** SC-2: the skill a writer `custom_id` belongs to (`D2_S1-3` → `D2.S1`). */
export function skillFromCustomId(_customId: string): string {
  return notImplemented();
}

/** SC-2, SC-10: one writer request per draft, sharing a cached corpus prefix. */
export function buildWriterBatch(_input: {
  skill: { code: string; name: string };
  corpus: CorpusEntry[];
  request: number;
  existingStems: string[];
  prompt: Prompt;
}): BatchRequest[] {
  return notImplemented();
}

/** SC-3: a questions YAML file for one skill, provenance set by code. */
export function renderQuestionFile(_input: {
  packSlug: string;
  skill: string;
  runTag: string;
  drafts: Draft[];
  author: string;
  generatedBy: GeneratedBy;
  sourceUrls: string[];
  need: number;
}): { text: string; written: number; dropped: Dropped[] } {
  return notImplemented();
}

/** SC-3: the runner's sign-in email from `MF_AUTHOR_EMAIL`; throws when missing or invalid. */
export function authorEmail(_env: Record<string, string | undefined>): string {
  return notImplemented();
}

/** SC-4: the golden set under `evals/golden/`. */
export function loadGoldenCases(_dir: string): EvalCase[] {
  return notImplemented();
}

/** SC-4: one verifier request per item. */
export function buildVerifierBatch(_input: {
  items: { id: string; yaml: string }[];
  corpus: CorpusEntry[];
  prompt: Prompt;
}): BatchRequest[] {
  return notImplemented();
}

/** SC-4: catch rates per flaw; passes at 100% wrong-key and ≥ 80% for the other flaws. */
export function scoreEval(_cases: EvalCase[], _verdicts: Verdict[]): EvalScore {
  return notImplemented();
}

/** SC-5: parse a prompt file with its version header. */
export function parsePrompt(_text: string): Prompt {
  return notImplemented();
}

/** SC-5: prompts whose body changed without a version bump (names), against the lock. */
export function promptLockViolations(
  _prompts: Prompt[],
  _lock: PromptLock,
): string[] {
  return notImplemented();
}

/** SC-6: `MF_MAX_BATCH_USD`, default 25; throws on a non-positive or non-numeric value. */
export function maxBatchUsd(_env: Record<string, string | undefined>): number {
  return notImplemented();
}

/** SC-6: real cost of one result at Batch prices (50% of list), from its usage. */
export function costFromUsage(_model: string, _usage: Usage): number {
  return notImplemented();
}

/** SC-6: submit only when the estimate is within the cap; the client is never called otherwise. */
export async function submitBatch(_input: {
  requests: BatchRequest[];
  estimatedUsd: number;
  capUsd: number;
  client: BatchClient;
}): Promise<
  { submitted: true; id: string } | { submitted: false; reason: string }
> {
  return notImplemented();
}

/** SC-6: one run-log line with tokens and cost. */
export function runLogLine(_input: {
  runId: string;
  model: string;
  usage: Usage;
}): string {
  return notImplemented();
}

/** SC-7: corpus pages as delimited, escaped data blocks. */
export function wrapCorpus(_entries: CorpusEntry[]): string {
  return notImplemented();
}

/** SC-7: a model output parsed against the strict draft schema, or null. */
export function parseDraft(_json: string): Draft | null {
  return notImplemented();
}

/** SC-7: the letter that holds ≥ 80% of the correct answers, or null. */
export function answerLetterBias(_drafts: Draft[]): string | null {
  return notImplemented();
}

/** SC-10: a stem reduced for duplicate checks (lower-case, no punctuation or whitespace). */
export function normalizeStem(_stem: string): string {
  return notImplemented();
}

/** SC-10: drafts whose normalized stem repeats an existing question or an earlier draft are dropped. */
export function dropDuplicates(
  _drafts: Draft[],
  _existingStems: string[],
): { kept: Draft[]; dropped: Dropped[] } {
  return notImplemented();
}
