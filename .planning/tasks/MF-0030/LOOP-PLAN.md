# LOOP-PLAN — MF-0030 (iteration 0)

## Discovery

- Children: `scripts/generate/{corpus,diagrams,cards,questions}.ts`, run with `tsx`. Dry runs print a
  final line `… upper-bound estimate $<x.yy> (verifier batch extra)` (`items.ts`, `questions.ts`); a
  real run is the same command without `--dry-run`. `questions.ts` takes `--domain` (MF-0022).
- Precedent for a pure helper + `.mjs` shell: MF-0018 (`scripts/lib/env-file.mjs`, test under `src/`).
- Cap: `maxBatchUsd(env)` / `submitBatch` (`src/content-pipeline/cost.ts`), `>` refuses.
- No generate CLI loads `.env.local` (no dotenv / `--env-file`): `MF_MAX_BATCH_USD` in `.env.local` is
  not seen unless exported. Pre-existing; out of scope, reported in the hand-off (affects MF-0022).
- Gates: `gate:planning` only. Frozen files touched: none other than this ticket's (grep for
  `dev-setup`, `content-all`, `generate:` over `**/*.acceptance.test.*`: only MF-0018's `env-file`).

## SC → steps

| SC | Step |
|---|---|
| SC-1, SC-2, SC-3, SC-4, SC-6 | T1 `src/content-pipeline/content-all.ts` (pure parse/plan + injected-IO orchestration) |
| SC-2 (real) | T2 `scripts/generate/content-all.ts` shell + `package.json` `content:all` |
| SC-5 | T3 `scripts/lib/dev-setup-corpus.mjs` + `scripts/dev-setup.mjs` wiring |
| SC-7 | lock only: nothing references `content:all` from setup/CI |
| SC-8 | T4 README, evidence |

## Steps

1. T1: implement `parseContentAllArgs`, `planContentAll`, `runContentAll`, plus `parseEstimate(stdout)`
   (pure, unit-tested in `__tests__/content-all.test.ts`). Order inside `runContentAll`: parse args
   (exit 1) → `loadDomains` (null → exit 1) → plan → corpus step (fail → exit 1, names `--no-corpus`)
   → estimate every generation step (a throw → exit 1) → print rows + total + "verifier not counted"
   → dry: exit 0 → run: check each ≤ cap and sum ≤ `--max-total-usd` (else exit 1, naming the step)
   → run paid steps in order, stop at the first failure (exit 1).
2. T2: shell `scripts/generate/content-all.ts`: `loadDomains` via `loadPackFile` when
   `packs/<p>/pack.yaml` exists; `runStep` = `spawnSync(tsx, argv, { stdio: "inherit" })`;
   `estimateStep` = same with the step's dry argv, piped, echoed, `parseEstimate` on stdout, throws on a
   non-zero exit or no estimate line; `capUsd = maxBatchUsd(process.env)` (children inherit the same env).
   `package.json`: `"content:all": "tsx scripts/generate/content-all.ts"`.
3. T3: `corpusFetches(argv, packSlugs)`; `dev-setup.mjs` parses argv first (unknown flag → exit 1 before
   Docker), lists `packs/*/pack.yaml`, and after `.env.local` runs each fetch with `tsx`; a failure says
   the stack is ready and names `pnpm generate:corpus --pack <p>`.
4. T4: README section "Content tooling"; header comments.

## Riskiest step

The estimate the refusal relies on. `estimateStep` reads the child's printed estimate, rounded to cents,
so a batch at $50.004 reads as $50.00 and passes the orchestrator's check; the child's own
`submitBatch` still compares the unrounded figure and refuses before any call. The orchestrator check is
an early, whole-run refusal; the per-batch guard stays authoritative. An unparseable estimate is an
error, never $0 (fail loud). The verifier batch is not estimated by any CLI; the output says so (C-2).

Writes it does not own: a `--run` writes `packs/<p>/*/*.ai-<tag>.yaml` and `.cache/runs/*` through the
existing CLIs; a re-run plans only skills without items (existing `plan*Run` / `questionsNeeded`), so
it does not duplicate. Not exercised here (paid; MF-0022).

## Rejected options

- Import the CLIs in-process: `questions.ts` runs `main()` on import and neither CLI returns its plan;
  refactoring both is a wider change than the ticket needs.
- A `--json` flag on every child CLI: cleaner contract, but widens three CLIs for one caller (YAGNI).
- Loading `.env.local` in the orchestrator: changes the cap the children see versus running them alone.

```json tasks
[
  {"id": "T1", "agent": "service-builder", "owns": ["src/content-pipeline/content-all.ts", "src/content-pipeline/__tests__/content-all.test.ts"], "depends_on": [], "closes": ["SC-1", "SC-2", "SC-3", "SC-4", "SC-6"], "done_when": "frozen SC-1..SC-4, SC-6 cases green; parseEstimate unit-tested", "context": "GOAL.md SCs + this plan step 1"},
  {"id": "T2", "agent": "service-builder", "owns": ["scripts/generate/content-all.ts", "package.json"], "depends_on": ["T1"], "closes": ["SC-2"], "done_when": "pnpm content:all --pack ccdv-f exits 0 with no ANTHROPIC_API_KEY; log pasted", "context": "plan step 2"},
  {"id": "T3", "agent": "service-builder", "owns": ["scripts/lib/dev-setup-corpus.mjs", "scripts/dev-setup.mjs"], "depends_on": [], "closes": ["SC-5", "SC-7"], "done_when": "frozen SC-5 green; dev:setup --with-corpus log pasted", "context": "plan step 3"},
  {"id": "T4", "agent": "service-builder", "owns": ["README.md", ".planning/evidence/MF-0030.md"], "depends_on": ["T2", "T3"], "closes": ["SC-8"], "done_when": "gates green; evidence written", "context": "plan step 4"}
]
```
