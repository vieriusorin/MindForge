/**
 * MF-0030: `pnpm content:all` — corpus → diagrams → cards → questions (one batch per domain) for one
 * pack. Dry by default; `--run` needs `--max-total-usd` and refuses before spending when any writer
 * batch is over `MF_MAX_BATCH_USD` or the sum is over the total. The I/O (spawning the CLIs, reading
 * the pack) is injected so every decision here is tested offline.
 */

export const CONTENT_STEP_KINDS = [
  "corpus",
  "diagrams",
  "cards",
  "questions",
] as const;
export type ContentStepKind = (typeof CONTENT_STEP_KINDS)[number];

export interface ContentStep {
  readonly kind: ContentStepKind;
  readonly pack: string;
  /** The question domain this batch covers; null for every other step. */
  readonly domain: string | null;
  /** The CLI script and its flags, e.g. `["scripts/generate/cards.ts", "--pack", "x", "--dry-run"]`. */
  readonly argv: readonly string[];
}

/** C-2: a paid run always carries the total the user typed; a dry run may omit it. */
export type ContentAllArgs = {
  readonly pack: string;
  readonly corpus: boolean;
} & (
  | { readonly run: false; readonly maxTotalUsd: number | null }
  | { readonly run: true; readonly maxTotalUsd: number }
);

export interface ContentAllIo {
  /** The pack's domain codes, or null when `packs/<pack>/pack.yaml` does not exist. */
  loadDomains: (pack: string) => Promise<readonly string[] | null>;
  /** Runs one step; resolves false when it exited non-zero. */
  runStep: (step: ContentStep) => Promise<boolean>;
  /** The step's writer-batch upper-bound estimate in USD, from a dry run. */
  estimateStep: (step: ContentStep) => Promise<number>;
  capUsd: number;
  log: (line: string) => void;
}

const USAGE =
  "usage: pnpm content:all --pack <slug> [--no-corpus] [--run --max-total-usd <usd>]";
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const FLAGS = new Set(["--pack", "--no-corpus", "--run", "--max-total-usd"]);
const VALUED = new Set(["--pack", "--max-total-usd"]);

/** Throws with a usage message on a missing or invalid flag. */
export function parseContentAllArgs(argv: readonly string[]): ContentAllArgs {
  const values = new Map<string, string>();
  const switches = new Set<string>();
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i] ?? "";
    if (!FLAGS.has(flag))
      throw new Error(`unknown argument "${flag}"; ${USAGE}`);
    if (!VALUED.has(flag)) {
      switches.add(flag);
      continue;
    }
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--"))
      throw new Error(`${flag} needs a value; ${USAGE}`);
    values.set(flag, value);
    i++;
  }
  const pack = values.get("--pack");
  if (pack === undefined) throw new Error(`--pack is required; ${USAGE}`);
  if (!SLUG.test(pack)) throw new Error(`invalid --pack "${pack}"; ${USAGE}`);
  const rawTotal = values.get("--max-total-usd");
  const maxTotalUsd = rawTotal === undefined ? null : Number(rawTotal);
  if (
    maxTotalUsd !== null &&
    !(Number.isFinite(maxTotalUsd) && maxTotalUsd > 0)
  )
    throw new Error(
      `--max-total-usd must be a positive number, got "${rawTotal}"`,
    );
  const corpus = !switches.has("--no-corpus");
  if (!switches.has("--run")) return { pack, corpus, run: false, maxTotalUsd };
  // C-2: a paid run is bounded by a total the user typed, not only by the per-batch cap.
  if (maxTotalUsd === null)
    throw new Error(`--run requires --max-total-usd <usd>; ${USAGE}`);
  return { pack, corpus, run: true, maxTotalUsd };
}

const SCRIPT = {
  corpus: "scripts/generate/corpus.ts",
  diagrams: "scripts/generate/diagrams.ts",
  cards: "scripts/generate/cards.ts",
  questions: "scripts/generate/questions.ts",
} as const satisfies Record<ContentStepKind, string>;

/** The ordered steps for one pack; generation steps carry `--dry-run` unless `run`. */
export function planContentAll({
  pack,
  domains,
  run,
  corpus,
}: {
  pack: string;
  domains: readonly string[];
  run: boolean;
  corpus: boolean;
}): ContentStep[] {
  const dry = run ? [] : ["--dry-run"];
  const step = (
    kind: ContentStepKind,
    domain: string | null,
    extra: readonly string[],
  ): ContentStep => ({
    kind,
    pack,
    domain,
    argv: [
      SCRIPT[kind],
      "--pack",
      pack,
      ...(domain === null ? [] : ["--domain", domain]),
      ...extra,
    ],
  });
  return [
    ...(corpus ? [step("corpus", null, [])] : []),
    // Diagrams first so a card can link its skill's diagram (MF-0014).
    step("diagrams", null, dry),
    step("cards", null, dry),
    // C-1: one questions batch per domain keeps a pack under MF_MAX_BATCH_USD (MF-0022).
    ...domains.map((d) => step("questions", d, dry)),
  ];
}

const ESTIMATE_LINE = /upper-bound estimate \$(\d+(?:\.\d+)?)/g;

/** The writer-batch estimate a generate CLI's dry run printed; throws unless there is exactly one. */
export function parseEstimate(stdout: string): number {
  const matches = [...stdout.matchAll(ESTIMATE_LINE)];
  if (matches.length !== 1)
    throw new Error(
      `expected one "upper-bound estimate $…" line, found ${matches.length}`,
    );
  return Number(matches[0]?.[1]);
}

const labelOf = (step: ContentStep) =>
  step.domain === null ? step.kind : `${step.kind} ${step.domain}`;
const usd = (n: number) => `$${n.toFixed(2)}`;

/** Parses, plans, fetches, estimates, checks the budget, then runs. Returns the exit code. */
export async function runContentAll(
  argv: readonly string[],
  io: ContentAllIo,
): Promise<number> {
  let args: ContentAllArgs;
  try {
    args = parseContentAllArgs(argv);
  } catch (error) {
    io.log(error instanceof Error ? error.message : String(error));
    return 1;
  }
  const domains = await io.loadDomains(args.pack);
  if (domains === null) {
    io.log(`no pack "${args.pack}" (packs/${args.pack}/pack.yaml not found)`);
    return 1;
  }
  const steps = planContentAll({ ...args, domains });
  const [first, ...rest] = steps;
  const generation = first?.kind === "corpus" ? rest : steps;

  if (first?.kind === "corpus" && !(await io.runStep(first))) {
    io.log(
      `corpus fetch for ${args.pack} failed (network?); re-run with --no-corpus to estimate from the cache`,
    );
    return 1;
  }

  const estimates: { step: ContentStep; usd: number }[] = [];
  try {
    for (const step of generation)
      estimates.push({ step, usd: await io.estimateStep(step) });
  } catch (error) {
    io.log(
      `estimate failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return 1;
  }
  const total = estimates.reduce((sum, e) => sum + e.usd, 0);
  io.log(`content:all ${args.pack}: writer batch estimates (upper bound)`);
  for (const e of estimates)
    io.log(`  ${labelOf(e.step).padEnd(16)} ${usd(e.usd)}`);
  io.log(
    `  total            ${usd(total)}  (verifier batches not counted; each is still checked against MF_MAX_BATCH_USD ${usd(io.capUsd)} at submit)`,
  );
  if (!args.run) {
    io.log(
      "dry run: nothing was spent. Add --run --max-total-usd <usd> to generate.",
    );
    return 0;
  }

  // C-1: every batch is checked before the first paid call; one over the cap refuses the run.
  const over = estimates.filter((e) => e.usd > io.capUsd);
  if (over.length > 0) {
    for (const e of over)
      io.log(
        `refused: ${args.pack} ${labelOf(e.step)} estimate ${usd(e.usd)} exceeds MF_MAX_BATCH_USD ${usd(io.capUsd)}`,
      );
    return 1;
  }
  if (total > args.maxTotalUsd) {
    io.log(
      `refused: total estimate ${usd(total)} exceeds --max-total-usd ${usd(args.maxTotalUsd)}`,
    );
    return 1;
  }
  for (const step of generation) {
    if (!(await io.runStep(step))) {
      io.log(`${labelOf(step)} failed; later steps were not started`);
      return 1;
    }
  }
  return 0;
}
