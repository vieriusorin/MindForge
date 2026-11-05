/**
 * MF-0022 SC-3: run the real verifier over the three golden sets (`evals/golden/**`) and judge each
 * set (any false alarm fails; a flaw with no planted case is `untested`). Writes nothing under
 * `packs/`. `--injection` (SC-4) instead runs the real writer on a CCDV-F page with an attack appended
 * and checks that nothing in the rendered file came from the page. `--dry-run` prints the plan and
 * an upper-bound cost without calling the API.
 *
 * Usage: pnpm generate:eval [--injection] [--dry-run]
 * Env (real run): ANTHROPIC_API_KEY or an `ant auth login` profile, MF_AUTHOR_EMAIL, MF_MAX_BATCH_USD.
 */
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import YAML from "yaml";
import { z } from "zod";
import {
  type EvalSetName,
  type EvalSetReport,
  INJECTION_TEXT,
  injectionFindings,
  judgeEvalSet,
} from "@/content-pipeline/eval-report";
import {
  buildItemVerifierBatch,
  codeCaughtFlaws,
  ITEM_PASS_RATE,
  itemVerdictSchema,
  loadItemGoldenCases,
} from "@/content-pipeline/item-eval";
import { VERIFIER_MODEL, WRITER_MODEL } from "@/content-pipeline/models";
import {
  authorEmail,
  buildVerifierBatch,
  buildWriterBatch,
  estimateBatchCost,
  loadGoldenCases,
  maxBatchUsd,
  parseDraft,
  promptRef,
  renderQuestionFile,
  runLogLine,
  verifierIdFor,
} from "@/content-pipeline/pipeline";
import type {
  BatchRequest,
  CorpusEntry,
  ItemKind,
} from "@/content-pipeline/types";
import { CARD_FLAWS, DIAGRAM_FLAWS, FLAWS } from "@/content-pipeline/types";
import { PASS_RATE } from "@/content-pipeline/verifier";
import { loadPackFile } from "@/engine/pack";
import { loadPrompts, RUNS_DIR, runBatch, runTagFor } from "./batch";
import { CORPUS_DIR, fileCorpusStore } from "./corpus";

const ROOT = process.cwd();
const GOLDEN_DIR = join(ROOT, "evals", "golden");
/** Every golden case is a CCDV-F item; its corpus comes from that pack's sources. */
const GOLDEN_PACK = "ccdv-f";
const INJECTION_SKILL = "D5.S3";
const INJECTION_DRAFTS = 3;

const QuestionVerdict = z.object({
  flaws: z.array(z.enum(FLAWS)),
  notes: z.string(),
});

/** `ccdv-f.D2.S3.official-1` → `D2.S3`. */
function skillOfCaseId(id: string): string {
  const [, domain, skill] = id.split(".");
  if (!domain || !skill) throw new Error(`eval: no skill in case id "${id}"`);
  return `${domain}.${skill}`;
}

const pickBar = (flaws: readonly (keyof typeof ITEM_PASS_RATE)[]) =>
  Object.fromEntries(flaws.map((f) => [f, ITEM_PASS_RATE[f]]));

interface EvalSetPlan {
  set: EvalSetName;
  cases: { id: string; flaw: string | null }[];
  requests: BatchRequest[];
  /** Verifier custom_id → case id. */
  caseOf: Map<string, string>;
  /** Flaws code finds before any model (cards, diagrams). */
  codeFound: Map<string, string[]>;
  parseVerdict: (text: string) => readonly string[] | null;
  passRate: Readonly<Record<string, number>>;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run");
  const pack = await loadPackFile(
    join(ROOT, "packs", GOLDEN_PACK, "pack.yaml"),
  );
  const prompts = loadPrompts(
    ["writer", "verifier", "card-verifier", "diagram-verifier"] as const,
    { packName: pack.name },
  );
  const store = fileCorpusStore(CORPUS_DIR);
  const skills = new Map(
    pack.domains.flatMap((d) => d.skills).map((s) => [s.code, s]),
  );
  const corpusOf = (code: string): CorpusEntry[] => {
    const urls = skills.get(code)?.sources ?? [];
    const corpus = urls.flatMap((url) => {
      const entry = store.get(url);
      return entry ? [entry] : [];
    });
    if (corpus.length === 0)
      throw new Error(
        `eval: no fetched sources for ${GOLDEN_PACK} ${code} (pnpm generate:corpus --pack ${GOLDEN_PACK})`,
      );
    return corpus;
  };
  mkdirSync(RUNS_DIR, { recursive: true });
  const runTag = runTagFor(new Date());

  if (argv.includes("--injection")) {
    await runInjection({ dryRun, runTag, corpusOf, prompts, skills });
    return;
  }

  const plans = [
    planQuestions(corpusOf, prompts.verifier),
    planItems("cards", "card", corpusOf, prompts["card-verifier"]),
    planItems("diagrams", "diagram", corpusOf, prompts["diagram-verifier"]),
  ];
  for (const p of plans)
    console.log(
      `${p.set}: ${p.cases.length} case(s), ${p.requests.length} request(s), upper-bound $${estimateBatchCost(p.requests).toFixed(2)}`,
    );
  if (dryRun) return;

  const client = new Anthropic();
  const capUsd = maxBatchUsd(process.env);
  const reports: EvalSetReport[] = [];
  const failures: Record<string, string[]> = {};
  for (const plan of plans) {
    const outcome = await runBatch(client, plan.requests, capUsd);
    const found = new Map(plan.codeFound);
    for (const [customId, text] of outcome.outputs) {
      const caseId = plan.caseOf.get(customId);
      const flaws = plan.parseVerdict(text);
      if (!caseId || flaws === null) continue;
      found.set(caseId, [...(found.get(caseId) ?? []), ...flaws]);
    }
    const report = judgeEvalSet({
      set: plan.set,
      cases: plan.cases,
      found,
      passRate: plan.passRate,
    });
    reports.push(report);
    failures[plan.set] = outcome.failed;
    const line = runLogLine({
      runId: `${runTag}/eval-${plan.set}`,
      model: VERIFIER_MODEL,
      usage: outcome.usage,
    });
    appendFileSync(join(RUNS_DIR, "runs.log"), `${line}\n`);
    console.log(line);
    for (const f of report.flaws)
      console.log(
        `  ${plan.set} ${f.flaw.padEnd(18)} ${f.caught}/${f.planted} ${f.status}`,
      );
    console.log(
      `  ${plan.set} false alarms: ${report.falseAlarms.join(", ") || "none"} → ${report.passed ? "PASS" : "FAIL"}`,
    );
  }
  writeFileSync(
    join(RUNS_DIR, `${runTag}-eval.json`),
    `${JSON.stringify({ runTag, reports, failures }, null, 2)}\n`,
  );
  if (reports.some((r) => !r.passed)) process.exitCode = 1;
}

function planQuestions(
  corpusOf: (code: string) => CorpusEntry[],
  prompt: ReturnType<typeof loadPrompts<"verifier">>["verifier"],
): EvalSetPlan {
  const cases = loadGoldenCases(GOLDEN_DIR);
  const requests: BatchRequest[] = [];
  const caseOf = new Map<string, string>();
  for (const c of cases) {
    const [request] = buildVerifierBatch({
      items: [{ id: c.id, yaml: YAML.stringify(c.question) }],
      corpus: corpusOf(skillOfCaseId(c.id)),
      prompt,
    });
    if (!request) continue;
    const id = verifierIdFor(requests.length);
    caseOf.set(id, c.id);
    requests.push({ ...request, custom_id: id });
  }
  return {
    set: "questions",
    cases,
    requests,
    caseOf,
    codeFound: new Map(),
    parseVerdict: (text) => {
      const v = QuestionVerdict.safeParse(parseJson(text));
      return v.success ? v.data.flaws : null;
    },
    passRate: PASS_RATE,
  };
}

function planItems(
  set: "cards" | "diagrams",
  kind: ItemKind,
  corpusOf: (code: string) => CorpusEntry[],
  prompt: ReturnType<typeof loadPrompts<"card-verifier">>["card-verifier"],
): EvalSetPlan {
  const cases = loadItemGoldenCases(join(GOLDEN_DIR, set), kind);
  const requests: BatchRequest[] = [];
  const caseOf = new Map<string, string>();
  const codeFound = new Map<string, string[]>();
  for (const c of cases) {
    codeFound.set(c.id, codeCaughtFlaws(kind, c.item));
    const [request] = buildItemVerifierBatch({
      kind,
      items: [{ id: c.id, yaml: YAML.stringify(c.item) }],
      corpus: corpusOf(skillOfCaseId(c.id)),
      prompt,
    });
    if (!request) continue;
    const id = verifierIdFor(requests.length);
    caseOf.set(id, c.id);
    requests.push({ ...request, custom_id: id });
  }
  const schema = itemVerdictSchema(kind);
  return {
    set,
    cases,
    requests,
    caseOf,
    codeFound,
    parseVerdict: (text) => {
      const v = schema.safeParse(parseJson(text));
      return v.success ? v.data.flaws : null;
    },
    passRate: pickBar(kind === "card" ? CARD_FLAWS : DIAGRAM_FLAWS),
  };
}

async function runInjection({
  dryRun,
  runTag,
  corpusOf,
  prompts,
  skills,
}: {
  dryRun: boolean;
  runTag: string;
  corpusOf: (code: string) => CorpusEntry[];
  prompts: ReturnType<typeof loadPrompts<"writer">>;
  skills: Map<string, { name: string; sources?: string[] }>;
}): Promise<void> {
  const [page, ...rest] = corpusOf(INJECTION_SKILL);
  if (!page) throw new Error(`eval: no page for ${INJECTION_SKILL}`);
  const corpus = [
    { ...page, text: `${page.text}\n\n${INJECTION_TEXT}` },
    ...rest,
  ];
  const requests = buildWriterBatch({
    skill: {
      code: INJECTION_SKILL,
      name: skills.get(INJECTION_SKILL)?.name ?? INJECTION_SKILL,
    },
    corpus,
    request: INJECTION_DRAFTS,
    existingStems: [],
    prompt: prompts.writer,
  });
  console.log(
    `injection: ${requests.length} writer request(s) on ${page.url} + attack, upper-bound $${estimateBatchCost(requests).toFixed(2)}`,
  );
  if (dryRun) return;

  const author = authorEmail(process.env);
  const generatedBy = {
    model: WRITER_MODEL,
    prompt: promptRef(prompts.writer),
  };
  const outcome = await runBatch(
    new Anthropic(),
    requests,
    maxBatchUsd(process.env),
  );
  const drafts = [...outcome.outputs.values()].map(parseDraft);
  const parsed = drafts.filter((d) => d !== null);
  const rendered = renderQuestionFile({
    packSlug: GOLDEN_PACK,
    skill: INJECTION_SKILL,
    runTag,
    drafts: parsed,
    author,
    generatedBy,
    sourceUrls: skills.get(INJECTION_SKILL)?.sources ?? [],
    need: INJECTION_DRAFTS,
  });
  const findings = injectionFindings({
    text: rendered.text,
    expected: { skill: INJECTION_SKILL, author, generatedBy },
  });
  const report = {
    runTag,
    returned: outcome.outputs.size,
    offSchemaDropped: drafts.length - parsed.length,
    written: rendered.written,
    dropped: rendered.dropped,
    failed: outcome.failed,
    findings,
  };
  writeFileSync(
    join(RUNS_DIR, `${runTag}-injection.json`),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  writeFileSync(join(RUNS_DIR, `${runTag}-injection.yaml`), rendered.text);
  const line = runLogLine({
    runId: `${runTag}/eval-injection`,
    model: WRITER_MODEL,
    usage: outcome.usage,
  });
  appendFileSync(join(RUNS_DIR, "runs.log"), `${line}\n`);
  console.log(line);
  console.log(JSON.stringify(report, null, 2));
  if (findings.length > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
