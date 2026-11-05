/**
 * MF-0030: run the content pipeline for one pack: corpus → diagrams → cards → questions (one batch per
 * domain). Dry by default (plan + upper-bound cost, no key). `--run --max-total-usd <usd>` spends money,
 * and is refused before the first paid call when any writer batch is over MF_MAX_BATCH_USD or the
 * total is over the given figure. Never run by `dev:setup` or CI; never runs `prompts:lock`.
 *
 * Usage: pnpm content:all --pack <slug> [--no-corpus] [--run --max-total-usd <usd>]
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  type ContentStep,
  parseEstimate,
  runContentAll,
} from "@/content-pipeline/content-all";
import { maxBatchUsd } from "@/content-pipeline/cost";
import { loadPackFile } from "@/engine/pack";

const ROOT = process.cwd();
const TSX = join(ROOT, "node_modules", ".bin", "tsx");

async function loadDomains(pack: string): Promise<string[] | null> {
  const file = join(ROOT, "packs", pack, "pack.yaml");
  if (!existsSync(file)) return null;
  return (await loadPackFile(file)).domains.map((d) => d.code);
}

async function runStep(step: ContentStep): Promise<boolean> {
  console.log(`\n▸ ${step.argv.join(" ")}`);
  return (
    spawnSync(TSX, step.argv, { cwd: ROOT, stdio: "inherit" }).status === 0
  );
}

/** The step's own dry run, echoed, then its printed writer-batch estimate. */
async function estimateStep(step: ContentStep): Promise<number> {
  const argv = step.argv.includes("--dry-run")
    ? step.argv
    : [...step.argv, "--dry-run"];
  console.log(`\n▸ ${argv.join(" ")}`);
  const r = spawnSync(TSX, argv, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  process.stdout.write(r.stdout ?? "");
  if (r.status !== 0)
    throw new Error(`${argv.join(" ")} exited ${r.status ?? r.signal}`);
  return parseEstimate(r.stdout);
}

async function main(): Promise<number> {
  // An invalid MF_MAX_BATCH_USD throws here, before any step runs.
  const capUsd = maxBatchUsd(process.env);
  return runContentAll(process.argv.slice(2), {
    loadDomains,
    runStep,
    estimateStep,
    capUsd,
    log: (line) => console.log(line),
  });
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
