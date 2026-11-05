/**
 * MF-0008 / MF-0014: what every generate CLI shares — the locked prompts and one Message Batch run
 * through the cost guard. Hoisted out of `questions.ts` when the card and diagram CLIs arrived.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import {
  estimateBatchCost,
  fillPrompt,
  parsePrompt,
  promptLockViolations,
  submitBatch,
} from "@/content-pipeline/pipeline";
import type { PromptVars } from "@/content-pipeline/prompts";
import type {
  BatchClient,
  BatchRequest,
  Prompt,
  Usage,
} from "@/content-pipeline/types";

const ROOT = process.cwd();
export const RUNS_DIR = join(ROOT, ".cache", "runs");
const POLL_MS = 60_000;

const PromptLockFile = z.record(
  z.string(),
  z.strictObject({ version: z.number().int(), bodyHash: z.string() }),
);

/**
 * Every prompt must match its lock (MF-0008 SC-5); returns the named ones filled for the pack
 * (MF-0022 SC-2: the lock hashes the template, so filling comes after the check), throwing when one
 * is missing or keeps a placeholder.
 */
export function loadPrompts<N extends string>(
  names: readonly N[],
  vars: PromptVars,
): Record<N, Prompt> {
  const dir = join(ROOT, "prompts");
  const prompts = readdirSync(dir)
    .filter((n) => n.endsWith(".md"))
    .map((n) => parsePrompt(readFileSync(join(dir, n), "utf8")));
  const lock = PromptLockFile.parse(
    JSON.parse(readFileSync(join(dir, "prompt-lock.json"), "utf8")),
  );
  const violations = promptLockViolations(prompts, lock);
  if (violations.length > 0)
    throw new Error(
      `prompt(s) changed without a version bump: ${violations.join(", ")} (pnpm prompts:lock)`,
    );
  const entries = names.map((name) => {
    const prompt = prompts.find((p) => p.name === name);
    if (!prompt) throw new Error(`prompts/${name}.md is required`);
    return [name, fillPrompt(prompt, vars)] as const;
  });
  return Object.fromEntries(entries) as Record<N, Prompt>;
}

const usageOf = (u: Anthropic.Messages.Usage): Usage => ({
  input_tokens: u.input_tokens,
  output_tokens: u.output_tokens,
  cache_creation_input_tokens: u.cache_creation_input_tokens ?? 0,
  cache_read_input_tokens: u.cache_read_input_tokens ?? 0,
});

const addUsage = (a: Usage, b: Usage): Usage => ({
  input_tokens: a.input_tokens + b.input_tokens,
  output_tokens: a.output_tokens + b.output_tokens,
  cache_creation_input_tokens:
    a.cache_creation_input_tokens + b.cache_creation_input_tokens,
  cache_read_input_tokens:
    a.cache_read_input_tokens + b.cache_read_input_tokens,
});

export const ZERO_USAGE: Usage = {
  input_tokens: 0,
  output_tokens: 0,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
};

export interface BatchOutcome {
  outputs: Map<string, string>;
  failed: string[];
  usage: Usage;
}

/** Submit through the cost guard, wait for the batch to end, and return text output per custom_id. */
export async function runBatch(
  client: Anthropic,
  requests: BatchRequest[],
  capUsd: number,
): Promise<BatchOutcome> {
  const batchClient: BatchClient = {
    create: (reqs) =>
      client.messages.batches.create({
        requests: reqs satisfies Anthropic.Messages.BatchCreateParams.Request[],
      }),
  };
  const submitted = await submitBatch({
    requests,
    estimatedUsd: estimateBatchCost(requests),
    capUsd,
    client: batchClient,
  });
  if (!submitted.submitted) throw new Error(submitted.reason);
  console.log(`batch ${submitted.id}: ${requests.length} request(s) submitted`);
  for (;;) {
    const batch = await client.messages.batches.retrieve(submitted.id);
    if (batch.processing_status === "ended") break;
    console.log(
      `batch ${submitted.id}: ${batch.processing_status}, ${batch.request_counts.processing} processing`,
    );
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  const outputs = new Map<string, string>();
  const failed: string[] = [];
  let usage = ZERO_USAGE;
  for await (const item of await client.messages.batches.results(
    submitted.id,
  )) {
    if (
      item.result.type !== "succeeded" ||
      item.result.message.stop_reason === "refusal"
    ) {
      failed.push(
        `${item.custom_id}: ${item.result.type === "succeeded" ? "refusal" : item.result.type}`,
      );
      if (item.result.type === "succeeded")
        usage = addUsage(usage, usageOf(item.result.message.usage));
      continue;
    }
    usage = addUsage(usage, usageOf(item.result.message.usage));
    const text = item.result.message.content
      .flatMap((b) => (b.type === "text" ? [b.text] : []))
      .join("");
    outputs.set(item.custom_id, text);
  }
  return { outputs, failed, usage };
}

/** `ai-<yyyymmddhhmm>`: the run's tag in item ids, file names and the run log. */
export function runTagFor(now: Date): string {
  return `ai-${now.toISOString().slice(0, 16).replace(/[-:T]/g, "").toLowerCase()}`;
}
