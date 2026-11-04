# MF-0008 — LOOP-PLAN (iteration 0) · tier normal: proceeds without approval

## Discovery summary

- Frozen tests import `src/content-pipeline/pipeline.ts` (stubs) and `../types`; the schema tests use
  `@/engine/questions` + `@/engine/pack`. Vitest picks up `src/**/__tests__/**/*.test.ts` only.
- `@anthropic-ai/sdk` 1.4.0 and `tsx` added as devDependencies (2026-11-04, user: "add anthropic sdk").
  `tsx` runs files with the repo's `@/` imports (probe: `contentHash` printed). pnpm skipped esbuild's
  build script; the platform binary works without it.
- Question schema: `src/engine/questions/schema.ts` (strict, `superRefine` for author/select).
  `toPlayableQuestion` is an allow-list, so `generatedBy` never reaches it. `parseContent` (MF-0006)
  reuses `QuestionFileSchema`, so the review queue and hashes pick the new field up unchanged.
- `packs/ccdv-f/pack.yaml` is LF; every skill block is `code / name / weight / description` at 8-space
  indent. `SkillSchema.sources` (optional, https URLs, min 1) already exists (MF-0006).
- Official samples: `D2.S3.official-1`, `D7.S1.official-1`, `D8.S3.official-1`.
- Claude API facts (claude-api skill, live docs 2026-11-04): Batches `{custom_id, params}`, `custom_id`
  `^[a-zA-Z0-9_-]{1,64}$`; structured output `output_config.format = {type:"json_schema", schema}`;
  usage `input_tokens / output_tokens / cache_creation_input_tokens / cache_read_input_tokens`; Batch = 50%
  of list on every token type; Sonnet 5.5 $2/$10, Opus 5.5 $4/$20, cache write 5 min 1.25×, cache read $0.20.

## SC → steps

| SC | Steps | Proof |
|---|---|---|
| SC-1 | 2, 7 | frozen SC-1 + run log of `pnpm generate:corpus` on the real docs |
| SC-2 | 2, 7 | frozen SC-2 + `pnpm generate:questions --pack ccdv-f --dry-run` log |
| SC-3 | 1, 2 | frozen SC-3 |
| SC-4 | 2, 4 | frozen SC-4 |
| SC-5 | 2, 5 | frozen SC-5 |
| SC-6 | 2 | frozen SC-6 |
| SC-7 | 2 | frozen SC-7 |
| SC-8 | 1 | frozen SC-8 |
| SC-9 | 3 | frozen SC-9 |
| SC-10 | 2 | frozen SC-10 |

## Steps

1. **Schema (SC-8):** `generatedBy: z.strictObject({ model: min1, prompt: min1 }).optional()` on the
   question schema; `superRefine` adds an issue when it is set and `origin !== "ai"`.
2. **Pipeline (SC-1..7, 10):** split by concern under `src/content-pipeline/`: `corpus.ts`, `plan.ts`,
   `writer.ts`, `drafts.ts`, `render.ts`, `verifier.ts`, `prompts.ts`, `cost.ts`, `models.ts`.
   `pipeline.ts` (the frozen tests' import path) re-exports them by name. It is the one entry point
   the frozen files fix, not a general barrel. Pure functions; the clock, `fetchPage`, the store and the
   client are parameters. `BatchRequest` stays the repo's own type (it is what the tests read). The CLI
   checks it against the SDK's `MessageBatchCreateParams.Request` with `satisfies`.
3. **Sources (SC-9):** one-off `scripts/generate/seed-sources.mjs` inserts `sources:` (the distinct
   citations of each skill's questions, sorted) after each skill's `description:` line, LF-only
   (`[ \t]+`, never `\s`). Expected diff: 25 skills, one `sources:` block each.
4. **Golden set (SC-4):** `evals/golden/cases.yaml`: the 3 official samples (`flaw: null`) and, per
   sample, one planted variant of each flaw (key moved, one rationale emptied, citation to another
   skill's page): 12 cases.
5. **Prompts (SC-5):** `prompts/writer.md`, `prompts/verifier.md` (version 1) +
   `prompts/prompt-lock.json`; `scripts/generate/lock-prompts.ts` re-locks only bumped versions.
6. **Unit tests** for exported decisions the frozen files don't pin: `estimateBatchCost`,
   `promptBodyHash`, the file corpus store.
7. **CLIs (thin, `tsx`):** `scripts/generate/corpus.ts` (`pnpm generate:corpus`),
   `scripts/generate/questions.ts` (`pnpm generate:questions --pack --skill --count --dry-run`): dry-run
   prints the plan and estimate. A real run submits through the guard, polls, verifies with the Opus
   batch, writes `packs/<pack>/questions/<skill>.<runTag>.yaml` + `.cache/runs/<runTag>.json`, and
   appends `.cache/runs/runs.log`. `.cache/` is git-ignored. The real run is MF-0020's proof.
8. **Verify:** typecheck, lint, test, test:db (no DB change expected), build, fresh-context review.

## Riskiest step

Step 2's injection and provenance boundary. Page text and model output are untrusted. Provenance
(`origin`, `author`, `generatedBy`, `skill`, `id`) is set only in `render.ts`; drafts are parsed with
a strict zod schema; corpus delimiters are escaped. The MF-0007 rule on judgements of versioned content
does not apply: verifier verdicts live inside one run and decide only which drafts get written. Nothing
is stored against a content version.

## Rejected options

- Forced `tool_choice` for JSON: 400 on these models, so structured output is used instead.
- Server-side refusal `fallbacks`: rejected on Batches, so a refused request is dropped and listed.
- Importing the SDK type into `types.ts`: the frozen tests read plain objects. One `satisfies` check
  in the CLI keeps parity without coupling the pure core to the SDK.
- Hand-written YAML: rendering goes through `yaml.stringify` of objects, so the loader is the oracle.

## Tasks

```json tasks
[
  { "id": "T1", "title": "question schema: generatedBy on ai items", "agent": "service-builder",
    "owns": ["src/engine/questions/schema.ts", "src/engine/questions/types.ts"], "depends_on": [], "closes": ["SC-8"],
    "done_when": ["frozen SC-8 green"], "context": [] },
  { "id": "T2", "title": "pipeline core", "agent": "service-builder",
    "owns": ["src/content-pipeline/**"], "depends_on": ["T1"], "closes": ["SC-1", "SC-2", "SC-3", "SC-6", "SC-7", "SC-10"],
    "done_when": ["frozen SC-1,2,3,6,7,10 green"], "context": ["skill:claude-api"] },
  { "id": "T3", "title": "seed sources in pack.yaml", "agent": "service-builder",
    "owns": ["scripts/generate/seed-sources.mjs", "packs/ccdv-f/pack.yaml"], "depends_on": [], "closes": ["SC-9"],
    "done_when": ["frozen SC-9 green"], "context": [] },
  { "id": "T4", "title": "golden set + prompts + lock", "agent": "service-builder",
    "owns": ["evals/golden/**", "prompts/**", "scripts/generate/lock-prompts.ts"], "depends_on": ["T2"], "closes": ["SC-4", "SC-5"],
    "done_when": ["frozen SC-4, SC-5 green"], "context": [] },
  { "id": "T5", "title": "CLIs + package scripts + .gitignore", "agent": "service-builder",
    "owns": ["scripts/generate/corpus.ts", "scripts/generate/questions.ts", "package.json", ".gitignore"], "depends_on": ["T2", "T3", "T4"], "closes": [],
    "done_when": ["generate:corpus run log", "generate:questions --dry-run log"], "context": [] },
  { "id": "T6", "title": "verify + review + evidence", "agent": "verifier",
    "owns": [".planning/tasks/MF-0008/**", ".planning/evidence/MF-0008.md"], "depends_on": ["T1", "T2", "T3", "T4", "T5"], "closes": [],
    "done_when": ["receipt PASS for the current tree"], "context": [] }
]
```

## Divergence (2026-11-04, BUILD T5, recorded before continuing)

The first real `pnpm generate:corpus` run (35 pages) showed two defects that the frozen tests can't see:
- The exam-guide PDF (cited by the 3 official samples) was read as text and gave 64,942 replacement
  characters. **Change:** `FetchResult` carries an optional `contentType`. `syncCorpus` stores HTML
  through `pageText`, keeps `text/markdown` and `text/plain` as they are, and lists any other type
  (PDF) in a new `CorpusReport.unsupported`, without storing it. Unit-tested.
- Docs pages on code.claude.com embed their compiled MDX as inline JS: `hooks` came out at 1.29M
  characters. **Change:** the CLI's `fetchPage` asks for the page's Markdown copy (`<url>.md`) on
  `platform.claude.com`, `code.claude.com` and `docs.claude.com`, which both sites publish (hooks.md:
  286 KB, text/markdown), and falls back to the HTML page when that is missing. A skill's corpus can
  still be large. The dry run prints its pages and an upper-bound cost, the guard refuses anything over
  the cap, and sizing it is MF-0020's call (no silent truncation).
