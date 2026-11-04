/**
 * MF-0008: draft exam questions per skill with the Batch API, verify them with a second model, and
 * write the survivors as `origin: ai` YAML for a PR. `--dry-run` prints the plan and an upper-bound
 * cost without calling the API (no key needed). A real run is MF-0022's.
 *
 * Usage: pnpm generate:questions [--pack ccdv-f] [--skill D2.S1] [--count N] [--dry-run]
 * Env (real run): ANTHROPIC_API_KEY or an `ant auth login` profile, MF_AUTHOR_EMAIL, MF_MAX_BATCH_USD (default 25).
 */
import {
  appendFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import YAML from "yaml";
import { z } from "zod";
import { VERIFIER_MODEL, WRITER_MODEL } from "@/content-pipeline/models";
import {
  answerLetterBias,
  authorEmail,
  buildVerifierBatch,
  buildWriterBatch,
  costFromUsage,
  dropDuplicates,
  estimateBatchCost,
  maxBatchUsd,
  parseDraft,
  parsePrompt,
  promptLockViolations,
  promptRef,
  questionsNeeded,
  renderQuestionFile,
  runLogLine,
  skillFromCustomId,
  submitBatch,
  verifierIdFor,
} from "@/content-pipeline/pipeline";
import type {
  BatchClient,
  BatchRequest,
  CorpusEntry,
  Draft,
  Dropped,
  Prompt,
  Usage,
} from "@/content-pipeline/types";
import { FLAWS } from "@/content-pipeline/types";
import { loadPackFile } from "@/engine/pack";
import { loadPackQuestions } from "@/engine/questions";
import { CORPUS_DIR, fileCorpusStore } from "./corpus";

const ROOT = process.cwd();
const RUNS_DIR = join(ROOT, ".cache", "runs");
const POLL_MS = 60_000;

const PromptLockFile = z.record(
  z.string(),
  z.strictObject({ version: z.number().int(), bodyHash: z.string() }),
);
/** The verifier's structured output (VERDICT_JSON_SCHEMA), checked again at the boundary. */
const VerdictOutput = z.object({
  flaws: z.array(z.enum(FLAWS)),
  notes: z.string(),
});

interface Args {
  pack: string;
  skill: string | null;
  count: number | undefined;
  dryRun: boolean;
}

function parseArgs(argv: string[]): Args {
  const value = (flag: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const pack = value("--pack") ?? "ccdv-f";
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(pack))
    throw new Error(`invalid --pack "${pack}"`);
  const countRaw = value("--count");
  const count = countRaw === undefined ? undefined : Number(countRaw);
  if (
    count !== undefined &&
    (!Number.isInteger(count) || count < 0 || count > 100)
  )
    throw new Error(`--count must be an integer 0..100, got "${countRaw}"`);
  return {
    pack,
    skill: value("--skill") ?? null,
    count,
    dryRun: argv.includes("--dry-run"),
  };
}

function loadPrompts(): { writer: Prompt; verifier: Prompt } {
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
  const writer = prompts.find((p) => p.name === "writer");
  const verifier = prompts.find((p) => p.name === "verifier");
  if (!writer || !verifier)
    throw new Error("prompts/writer.md and prompts/verifier.md are required");
  return { writer, verifier };
}

interface SkillPlan {
  code: string;
  name: string;
  existing: number;
  need: number;
  sourceUrls: string[];
  corpus: CorpusEntry[];
  existingStems: string[];
  requests: BatchRequest[];
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

const ZERO: Usage = {
  input_tokens: 0,
  output_tokens: 0,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
};

/** Submit through the cost guard, wait for the batch to end, and return text output per custom_id. */
async function runBatch(
  client: Anthropic,
  requests: BatchRequest[],
  capUsd: number,
): Promise<{ outputs: Map<string, string>; failed: string[]; usage: Usage }> {
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
  let usage = ZERO;
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

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const prompts = loadPrompts();
  const pack = await loadPackFile(join(ROOT, "packs", args.pack, "pack.yaml"));
  const questions = await loadPackQuestions(
    pack,
    join(ROOT, "packs", args.pack, "questions"),
  );
  const store = fileCorpusStore(CORPUS_DIR);

  const skills = pack.domains
    .flatMap((d) => d.skills)
    .filter((s) => args.skill === null || s.code === args.skill);
  if (skills.length === 0)
    throw new Error(`no skill "${args.skill}" in ${args.pack}`);

  const plans: SkillPlan[] = [];
  for (const s of skills) {
    const own = questions.filter((q) => q.skillCode === s.code);
    const { need, request } = questionsNeeded({
      existing: own.length,
      count: args.count,
    });
    const sourceUrls = s.sources ?? [];
    const corpus = sourceUrls.flatMap((url) => {
      const entry = store.get(url);
      return entry ? [entry] : [];
    });
    if (request > 0 && corpus.length === 0) {
      console.warn(
        `${s.code}: no fetched sources in .cache/corpus (run pnpm generate:corpus); skipped`,
      );
      continue;
    }
    const existingStems = own.map((q) => q.stem);
    plans.push({
      code: s.code,
      name: s.name,
      existing: own.length,
      need,
      sourceUrls,
      corpus,
      existingStems,
      requests: buildWriterBatch({
        skill: { code: s.code, name: s.name },
        corpus,
        request,
        existingStems,
        prompt: prompts.writer,
      }),
    });
  }

  const writerRequests = plans.flatMap((p) => p.requests);
  const estimate = estimateBatchCost(writerRequests);
  console.log("skill     existing  need  drafts  pages  est.$");
  for (const p of plans)
    console.log(
      `${p.code.padEnd(9)} ${String(p.existing).padStart(8)} ${String(p.need).padStart(5)} ${String(p.requests.length).padStart(7)} ${String(p.corpus.length).padStart(6)}  ${estimateBatchCost(p.requests).toFixed(2)}`,
    );
  console.log(
    `writer batch: ${writerRequests.length} request(s), upper-bound estimate $${estimate.toFixed(2)} (verifier batch extra)`,
  );
  if (args.dryRun || writerRequests.length === 0) return;

  const author = authorEmail(process.env);
  const capUsd = maxBatchUsd(process.env);
  const client = new Anthropic();
  const runTag = `ai-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "").toLowerCase()}`;

  const writer = await runBatch(client, writerRequests, capUsd);
  const draftsBySkill = new Map<string, Draft[]>();
  const parseFailures: string[] = [];
  for (const [customId, text] of writer.outputs) {
    const draft = parseDraft(text);
    if (!draft) {
      parseFailures.push(customId);
      continue;
    }
    const skill = skillFromCustomId(customId);
    draftsBySkill.set(skill, [...(draftsBySkill.get(skill) ?? []), draft]);
  }

  // One verifier batch for every skill: items keep their own skill's corpus as a cached prefix.
  interface Pending {
    plan: SkillPlan;
    kept: Draft[];
    duplicates: Dropped[];
    letterBias: string | null;
  }
  const pending: Pending[] = plans.map((plan) => {
    const { kept, dropped } = dropDuplicates(
      draftsBySkill.get(plan.code) ?? [],
      plan.existingStems,
    );
    return {
      plan,
      kept,
      duplicates: dropped,
      letterBias: answerLetterBias(kept),
    };
  });
  const verifierRequests: BatchRequest[] = [];
  const itemOf = new Map<string, { skill: string; index: number }>();
  for (const { plan, kept } of pending) {
    const requests = buildVerifierBatch({
      items: kept.map((d, i) => ({
        id: `${plan.code}#${i}`,
        yaml: YAML.stringify(d),
      })),
      corpus: plan.corpus,
      prompt: prompts.verifier,
    });
    requests.forEach((request, index) => {
      const id = verifierIdFor(verifierRequests.length);
      itemOf.set(id, { skill: plan.code, index });
      verifierRequests.push({ ...request, custom_id: id });
    });
  }
  const verifier =
    verifierRequests.length === 0
      ? { outputs: new Map<string, string>(), failed: [], usage: ZERO }
      : await runBatch(client, verifierRequests, capUsd);
  const sound = new Set<string>();
  for (const [id, text] of verifier.outputs) {
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      continue;
    }
    const verdict = VerdictOutput.safeParse(raw);
    const item = itemOf.get(id);
    if (verdict.success && verdict.data.flaws.length === 0 && item)
      sound.add(`${item.skill}#${item.index}`);
  }

  mkdirSync(RUNS_DIR, { recursive: true });
  const skillReports: Record<string, unknown> = {};
  for (const { plan, kept, duplicates, letterBias } of pending) {
    const passed = kept.filter((_, i) => sound.has(`${plan.code}#${i}`));
    const out = renderQuestionFile({
      packSlug: args.pack,
      skill: plan.code,
      runTag,
      drafts: passed,
      author,
      generatedBy: { model: WRITER_MODEL, prompt: promptRef(prompts.writer) },
      sourceUrls: plan.sourceUrls,
      need: plan.need,
    });
    if (out.written > 0)
      writeFileSync(
        join(
          ROOT,
          "packs",
          args.pack,
          "questions",
          `${plan.code}.${runTag}.yaml`,
        ),
        out.text,
      );
    skillReports[plan.code] = {
      drafts: draftsBySkill.get(plan.code)?.length ?? 0,
      duplicates,
      letterBias,
      verified: passed.length,
      written: out.written,
      dropped: out.dropped,
    };
  }
  const report = {
    runTag,
    skills: skillReports,
    writerFailures: [
      ...writer.failed,
      ...parseFailures.map((id) => `${id}: unparseable draft`),
    ],
    verifierFailures: verifier.failed,
  };

  writeFileSync(
    join(RUNS_DIR, `${runTag}.json`),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  const lines = [
    runLogLine({
      runId: `${runTag}/writer`,
      model: WRITER_MODEL,
      usage: writer.usage,
    }),
    runLogLine({
      runId: `${runTag}/verifier`,
      model: VERIFIER_MODEL,
      usage: verifier.usage,
    }),
  ];
  appendFileSync(join(RUNS_DIR, "runs.log"), `${lines.join("\n")}\n`);
  for (const l of lines) console.log(l);
  console.log(
    `total $${(costFromUsage(WRITER_MODEL, writer.usage) + costFromUsage(VERIFIER_MODEL, verifier.usage)).toFixed(2)}; report .cache/runs/${runTag}.json`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
