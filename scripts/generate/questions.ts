/**
 * MF-0008: draft exam questions per skill with the Batch API, verify them with a second model, and
 * write the survivors as `origin: ai` YAML for a PR. `--dry-run` prints the plan and an upper-bound
 * cost without calling the API (no key needed). A real run is MF-0022's.
 *
 * Usage: pnpm generate:questions [--pack ccdv-f] [--skill D2.S1] [--count N] [--dry-run]
 * Env (real run): ANTHROPIC_API_KEY or an `ant auth login` profile, MF_AUTHOR_EMAIL, MF_MAX_BATCH_USD (default 25).
 */
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
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
  promptRef,
  questionsNeeded,
  renderQuestionFile,
  runLogLine,
  skillFromCustomId,
  verifierIdFor,
} from "@/content-pipeline/pipeline";
import type {
  BatchRequest,
  CorpusEntry,
  Draft,
  Dropped,
} from "@/content-pipeline/types";
import { FLAWS } from "@/content-pipeline/types";
import { loadPackFile } from "@/engine/pack";
import { loadPackQuestions } from "@/engine/questions";
import {
  loadPrompts,
  RUNS_DIR,
  runBatch,
  runTagFor,
  ZERO_USAGE,
} from "./batch";
import { CORPUS_DIR, fileCorpusStore } from "./corpus";

const ROOT = process.cwd();

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

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const prompts = loadPrompts(["writer", "verifier"] as const);
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
  const runTag = runTagFor(new Date());

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
      ? { outputs: new Map<string, string>(), failed: [], usage: ZERO_USAGE }
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
