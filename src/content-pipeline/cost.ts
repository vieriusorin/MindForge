import { VERIFIER_MODEL, WRITER_MODEL } from "./models";
import type { BatchClient, BatchRequest, Usage } from "./types";

/** List prices per million tokens (claude-api skill, 2026-11-04). Cache writes are the 5-minute TTL (1.25× input). */
export const LIST_PRICES_PER_MTOK = {
  [WRITER_MODEL]: { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.2 },
  [VERIFIER_MODEL]: { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 },
} as const satisfies Record<
  string,
  { input: number; output: number; cacheWrite: number; cacheRead: number }
>;

/** The Message Batches API bills every token type at 50% of list. */
export const BATCH_DISCOUNT = 0.5;

export const DEFAULT_MAX_BATCH_USD = 25;

function pricesFor(model: string) {
  const prices = Object.entries(LIST_PRICES_PER_MTOK).find(
    ([id]) => id === model,
  )?.[1];
  if (!prices) throw new Error(`no price for model "${model}"`);
  return prices;
}

/** SC-6: the real cost of a batch result (or a sum of results) from its usage, at Batch prices. */
export function costFromUsage(model: string, usage: Usage): number {
  const p = pricesFor(model);
  const list =
    usage.input_tokens * p.input +
    usage.output_tokens * p.output +
    usage.cache_creation_input_tokens * p.cacheWrite +
    usage.cache_read_input_tokens * p.cacheRead;
  return (list / 1_000_000) * BATCH_DISCOUNT;
}

/** A conservative token count for an estimate: about 3 characters per token. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3);
}

/**
 * SC-6: an upper-bound estimate for a batch: every request is assumed to write the cache (Batch cache
 * hits are best-effort) and to use its whole `max_tokens` for output.
 */
export function estimateBatchCost(requests: BatchRequest[]): number {
  let total = 0;
  for (const r of requests) {
    const cached = r.params.system
      .filter((b) => b.cache_control)
      .reduce((n, b) => n + estimateTokens(b.text), 0);
    const uncached =
      r.params.system
        .filter((b) => !b.cache_control)
        .reduce((n, b) => n + estimateTokens(b.text), 0) +
      r.params.messages.reduce((n, m) => n + estimateTokens(m.content), 0);
    total += costFromUsage(r.params.model, {
      input_tokens: uncached,
      output_tokens: r.params.max_tokens,
      cache_creation_input_tokens: cached,
      cache_read_input_tokens: 0,
    });
  }
  return total;
}

/** SC-6: `MF_MAX_BATCH_USD`, default 25; throws on a non-numeric or non-positive value. */
export function maxBatchUsd(env: Record<string, string | undefined>): number {
  const raw = env.MF_MAX_BATCH_USD?.trim();
  if (!raw) return DEFAULT_MAX_BATCH_USD;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0)
    throw new Error(`MF_MAX_BATCH_USD must be a positive number, got "${raw}"`);
  return value;
}

/** SC-6: submits only when the estimate is within the cap; otherwise the client is never called. */
export async function submitBatch({
  requests,
  estimatedUsd,
  capUsd,
  client,
}: {
  requests: BatchRequest[];
  estimatedUsd: number;
  capUsd: number;
  client: BatchClient;
}): Promise<
  { submitted: true; id: string } | { submitted: false; reason: string }
> {
  if (estimatedUsd > capUsd)
    return {
      submitted: false,
      reason: `estimated $${estimatedUsd.toFixed(2)} exceeds the cap of $${capUsd.toFixed(2)} (MF_MAX_BATCH_USD)`,
    };
  const { id } = await client.create(requests);
  return { submitted: true, id };
}

/** SC-6: one run-log line with every token count and the cost. */
export function runLogLine({
  runId,
  model,
  usage,
}: {
  runId: string;
  model: string;
  usage: Usage;
}): string {
  return [
    `run=${runId}`,
    `model=${model}`,
    `input=${usage.input_tokens}`,
    `output=${usage.output_tokens}`,
    `cache_write=${usage.cache_creation_input_tokens}`,
    `cache_read=${usage.cache_read_input_tokens}`,
    `usd=${costFromUsage(model, usage).toFixed(2)}`,
  ].join(" ");
}
