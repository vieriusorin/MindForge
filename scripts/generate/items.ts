/**
 * MF-0014: draft nature cards or diagrams for the skills that have none in the pack files, verify
 * them with a second model, and write the survivors as `origin: ai` YAML for a PR. `--dry-run` prints
 * the plan and an upper-bound cost without a key. The real run is MF-0022's (SC-5..SC-7).
 * Entry points: `cards.ts`, `diagrams.ts`. Run diagrams first so a card can link its skill's diagram.
 *
 * Usage: pnpm generate:<cards|diagrams> [--pack ccdv-f] [--skill D2.S1] [--dry-run]
 * Env (real run): ANTHROPIC_API_KEY or an `ant auth login` profile, MF_AUTHOR_EMAIL, MF_MAX_BATCH_USD (default 25).
 */
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import YAML from "yaml";
import { VERIFIER_MODEL, WRITER_MODEL } from "@/content-pipeline/models";
import {
  authorEmail,
  buildCardWriterBatch,
  buildDiagramWriterBatch,
  buildItemVerifierBatch,
  costFromUsage,
  estimateBatchCost,
  itemRunLogLines,
  itemVerdictSchema,
  maxBatchUsd,
  parseCardDraft,
  parseDiagramDraft,
  planCardRun,
  planDiagramRun,
  promptRef,
  renderCardFile,
  renderDiagramFile,
  skillFromCustomId,
  verifierIdFor,
} from "@/content-pipeline/pipeline";
import type {
  BatchRequest,
  CardDraft,
  CorpusEntry,
  DiagramDraft,
  Dropped,
  GeneratedBy,
  ItemKind,
  ItemRunPlan,
  Prompt,
} from "@/content-pipeline/types";
import { loadPackContent, type PackContent } from "@/engine/content";
import { loadPackFile, type Pack } from "@/engine/pack";
import {
  loadPrompts,
  RUNS_DIR,
  runBatch,
  runTagFor,
  ZERO_USAGE,
} from "./batch";
import { CORPUS_DIR, fileCorpusStore } from "./corpus";

const ROOT = process.cwd();

interface RenderContext {
  packSlug: string;
  skill: string;
  runTag: string;
  author: string;
  generatedBy: GeneratedBy;
  sourceUrls: string[];
  content: PackContent;
}

/** What differs between the card and the diagram run; everything else is shared. */
interface ItemCli<D> {
  kind: ItemKind;
  folder: "cards" | "diagrams";
  writerPrompt: string;
  verifierPrompt: string;
  plan: (input: {
    pack: Pack;
    content: PackContent;
    skill: string | null;
    hasCorpus: (skill: string) => boolean;
  }) => ItemRunPlan;
  buildWriter: (input: {
    skill: { code: string; name: string };
    corpus: CorpusEntry[];
    request: number;
    prompt: Prompt;
  }) => BatchRequest[];
  parse: (json: string) => D | null;
  render: (
    drafts: D[],
    context: RenderContext,
  ) => { text: string; written: number; dropped: Dropped[] };
}

export const CARD_CLI: ItemCli<CardDraft> = {
  kind: "card",
  folder: "cards",
  writerPrompt: "nature-card",
  verifierPrompt: "card-verifier",
  plan: planCardRun,
  buildWriter: buildCardWriterBatch,
  parse: parseCardDraft,
  render: (drafts, { content, ...context }) => {
    // GOAL "Decided": link the skill's diagram only when there is exactly one; never from the model.
    const diagrams = content.diagrams.filter((d) => d.skill === context.skill);
    return renderCardFile({
      ...context,
      drafts,
      diagramId: diagrams.length === 1 ? (diagrams[0]?.id ?? null) : null,
    });
  },
};

export const DIAGRAM_CLI: ItemCli<DiagramDraft> = {
  kind: "diagram",
  folder: "diagrams",
  writerPrompt: "diagram",
  verifierPrompt: "diagram-verifier",
  plan: planDiagramRun,
  buildWriter: buildDiagramWriterBatch,
  parse: parseDiagramDraft,
  render: (drafts, { content: _content, ...context }) =>
    renderDiagramFile({ ...context, drafts }),
};

interface Args {
  pack: string;
  skill: string | null;
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
  return {
    pack,
    skill: value("--skill") ?? null,
    dryRun: argv.includes("--dry-run"),
  };
}

interface SkillPlan {
  code: string;
  sourceUrls: string[];
  corpus: CorpusEntry[];
  requests: BatchRequest[];
}

export async function runItemCli<D>(cli: ItemCli<D>): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const packDir = join(ROOT, "packs", args.pack);
  const pack = await loadPackFile(join(packDir, "pack.yaml"));
  const names = [cli.writerPrompt, cli.verifierPrompt];
  const prompts = loadPrompts(names, { packName: pack.name });
  const writerPrompt = prompts[cli.writerPrompt];
  const verifierPrompt = prompts[cli.verifierPrompt];
  if (!writerPrompt || !verifierPrompt)
    throw new Error(`prompts ${names.join(", ")} are required`);

  const content = await loadPackContent(pack, packDir);
  const store = fileCorpusStore(CORPUS_DIR);
  const skills = new Map(
    pack.domains.flatMap((d) => d.skills).map((s) => [s.code, s]),
  );
  const corpusOf = (code: string): CorpusEntry[] =>
    (skills.get(code)?.sources ?? []).flatMap((url) => {
      const entry = store.get(url);
      return entry ? [entry] : [];
    });

  const run = cli.plan({
    pack,
    content,
    skill: args.skill,
    hasCorpus: (code) => corpusOf(code).length > 0,
  });
  const plans: SkillPlan[] = run.skills.map(({ code, request }) => {
    const corpus = corpusOf(code);
    return {
      code,
      sourceUrls: skills.get(code)?.sources ?? [],
      corpus,
      requests: cli.buildWriter({
        skill: { code, name: skills.get(code)?.name ?? code },
        corpus,
        request,
        prompt: writerPrompt,
      }),
    };
  });

  const writerRequests = plans.flatMap((p) => p.requests);
  console.log(`${cli.folder}: skill     pages  drafts  est.$`);
  for (const p of plans)
    console.log(
      `${cli.folder}: ${p.code.padEnd(9)} ${String(p.corpus.length).padStart(5)} ${String(p.requests.length).padStart(7)}  ${estimateBatchCost(p.requests).toFixed(2)}`,
    );
  for (const s of run.skipped)
    console.log(`${cli.folder}: ${s.code} skipped: ${s.reason}`);
  console.log(
    `${cli.folder}: ${plans.length} skill(s), writer batch ${writerRequests.length} request(s), upper-bound estimate $${estimateBatchCost(writerRequests).toFixed(2)} (verifier batch extra)`,
  );
  if (args.dryRun || writerRequests.length === 0) return;

  const author = authorEmail(process.env);
  const capUsd = maxBatchUsd(process.env);
  const client = new Anthropic();
  const runTag = runTagFor(new Date());

  const writer = await runBatch(client, writerRequests, capUsd);
  const draftsBySkill = new Map<string, D[]>();
  const parseFailures: string[] = [];
  for (const [customId, text] of writer.outputs) {
    const draft = cli.parse(text);
    if (!draft) {
      parseFailures.push(`${customId}: unparseable draft`);
      continue;
    }
    const skill = skillFromCustomId(customId);
    draftsBySkill.set(skill, [...(draftsBySkill.get(skill) ?? []), draft]);
  }

  // One verifier batch for every skill: items keep their own skill's corpus as a cached prefix.
  const verifierRequests: BatchRequest[] = [];
  const itemOf = new Map<string, string>();
  for (const plan of plans) {
    const drafts = draftsBySkill.get(plan.code) ?? [];
    buildItemVerifierBatch({
      kind: cli.kind,
      items: drafts.map((d, i) => ({
        id: `${plan.code}#${i}`,
        yaml: YAML.stringify(d),
      })),
      corpus: plan.corpus,
      prompt: verifierPrompt,
    }).forEach((request, i) => {
      const id = verifierIdFor(verifierRequests.length);
      itemOf.set(id, `${plan.code}#${i}`);
      verifierRequests.push({ ...request, custom_id: id });
    });
  }
  const verifier =
    verifierRequests.length === 0
      ? { outputs: new Map<string, string>(), failed: [], usage: ZERO_USAGE }
      : await runBatch(client, verifierRequests, capUsd);
  const verdictSchema = itemVerdictSchema(cli.kind);
  const sound = new Set<string>();
  const flagged: Record<string, string[]> = {};
  for (const [id, text] of verifier.outputs) {
    const item = itemOf.get(id);
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      continue;
    }
    const verdict = verdictSchema.safeParse(raw);
    if (!item || !verdict.success) continue;
    if (verdict.data.flaws.length === 0) sound.add(item);
    else flagged[item] = verdict.data.flaws;
  }

  mkdirSync(RUNS_DIR, { recursive: true });
  const generatedBy = { model: WRITER_MODEL, prompt: promptRef(writerPrompt) };
  const skillReports: Record<string, unknown> = {};
  for (const plan of plans) {
    const drafts = draftsBySkill.get(plan.code) ?? [];
    const passed = drafts.filter((_, i) => sound.has(`${plan.code}#${i}`));
    const out = cli.render(passed, {
      packSlug: args.pack,
      skill: plan.code,
      runTag,
      author,
      generatedBy,
      sourceUrls: plan.sourceUrls,
      content,
    });
    if (out.written > 0)
      writeFileSync(
        join(packDir, cli.folder, `${plan.code}.${runTag}.yaml`),
        out.text,
      );
    skillReports[plan.code] = {
      drafts: drafts.length,
      verified: passed.length,
      written: out.written,
      dropped: out.dropped,
    };
  }
  const report = {
    runTag,
    kind: cli.kind,
    skills: skillReports,
    skipped: run.skipped,
    flagged,
    writerFailures: [...writer.failed, ...parseFailures],
    verifierFailures: verifier.failed,
  };
  writeFileSync(
    join(RUNS_DIR, `${runTag}-${cli.folder}.json`),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  const lines = itemRunLogLines({
    runTag,
    kind: cli.kind,
    writer: writer.usage,
    verifier: verifier.usage,
  });
  appendFileSync(join(RUNS_DIR, "runs.log"), `${lines.join("\n")}\n`);
  for (const l of lines) console.log(l);
  console.log(
    `total $${(costFromUsage(WRITER_MODEL, writer.usage) + costFromUsage(VERIFIER_MODEL, verifier.usage)).toFixed(2)}; report .cache/runs/${runTag}-${cli.folder}.json`,
  );
}

export function main<D>(cli: ItemCli<D>): void {
  runItemCli(cli).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
