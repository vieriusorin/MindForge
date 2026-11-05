# MF-0022 LOOP-PLAN (iteration 0)

## Discovery summary

See GOAL "Discovery". Precedent: MF-0008 (`questions.ts`, `batch.ts`), MF-0014 (`items.ts`, `item-eval.ts`).
The generation CLIs call `loadPrompts(names)` (`scripts/generate/batch.ts:32`) then
`buildWriterBatch` / `buildItemWriterBatch`; the eval scorers are library-only.

## SC → steps

| SC | Steps | Proof |
|---|---|---|
| SC-2 | T1 `fillPrompt`; T2 `loadPrompts(names, { packName })` required + callers pass `pack.name`; T3 prompts edited, versions bumped, `pnpm prompts:lock` | frozen mf-0022 SC-2 cases; MF-0008 SC-5, MF-0014 SC-6 lock tests |
| SC-3 | T1 `judgeEvalSet`; T4 `scripts/generate/eval.ts` + `generate:eval` script | frozen SC-3 cases; real run report (key) |
| SC-4 | T4 `--injection` mode: writer batch over the MF-0008 injection fixture page, parse via `parseDraft`, report fields | real run report (key) |
| SC-5/6 | T5 real runs, stop rule C-1 | runs.log + loader + check:packs (key) |
| SC-7 | T6 hand-off grouping | hand-off |
| SC-8 | T7 `pnpm db:reset` once + browser | evidence (key) |

## Steps

1. `src/content-pipeline/prompts.ts` `fillPrompt`: replace `{{packName}}`; then any `/\{\{\w+\}\}/` left → throw `fillPrompt: unfilled {{name}} in <prompt>`. Re-export from `pipeline.ts`.
2. `src/content-pipeline/eval-report.ts` `judgeEvalSet`: per `Object.keys(passRate)`: planted, caught (found includes the flaw), status untested|pass|fail; falseAlarms = clean cases with found length > 0; passed = no fail && no false alarm.
3. `scripts/generate/batch.ts` `loadPrompts(names, vars)`: fill every loaded prompt **after** the lock check (lock hashes stay over the template). Callers: `questions.ts:101`, `items.ts:156` pass `{ packName: pack.name }` (pack loaded before prompts — move the load up if needed). `eval.ts` uses the pack of each golden case (`ccdv-f`).
4. Prompts: `writer.md`, `nature-card.md`, `diagram.md`: "for the Claude Certified Developer – Foundations exam" → "for the {{packName}} course pack"; add the `Before you answer, check:` block (4 lines, wording from GOAL SC-2); `version: 2`; keep nature-card §2.4 seeds. `pnpm prompts:lock`.
5. `scripts/generate/eval.ts`: loads golden sets, builds `buildVerifierBatch` / `buildItemVerifierBatch` per set, `runBatch` with the cap, `codeCaughtFlaws` + verdicts → `found`, `judgeEvalSet`, prints table, appends `runLogLine` cost, `process.exitCode = 1` on any failed set. `--dry-run` prints requests + estimate. `--injection`: writer batch (count 3) over the injection fixture as corpus; report per draft: parsed?, and `origin/author/generatedBy/skill` set by code (`renderQuestionFile` path) vs any page string. `package.json`: `"generate:eval": "tsx scripts/generate/eval.ts"`.
5b. `questions.ts --domain <code>` (found in BUILD: CCDV-F is $70.68 > $50 cap and the CLI had only `--skill`). Per-domain dry-runs: D1 $6.74, D2 $15.91, D3 $2.76, D4 $2.33, D5 $11.02, D6 $9.16, D7 $12.72, D8 $10.04.
6. Real runs (needs key): eval → injection → ccdv-f one domain (record real/estimate) → rest per stop rule.

## Riskiest step

Step 6: paid, irreversible spend and writes into `packs/`. Re-run state it does not own: (a) `.cache/runs/runs.log` is append-only; the monthly sum reads it, so a deleted log under-counts — the stop rule also reads the Console's figure the user reports if the log is missing; (b) items already in `packs/` (hand-written or a previous run) — the CLIs count existing questions per skill (`questionsNeeded`) and only top up, so a re-run never deletes or rewrites; (c) failure order: the cap check runs before submit (`submitBatch`), and files are written only after a batch ends, so a refused or failed batch writes nothing. A re-run of a domain after a partial write is a top-up, verified by the dry-run count before each batch.

Not versioned-judgement writes: no review verdicts are recorded by this ticket.

## Rejected options

- Pack name in the user message instead of the system prompt: changes `buildWriterBatch` output asserted by frozen MF-0008 tests.
- An optional `packName` defaulting to CCDV-F: hides a forgotten caller; required param makes `tsc` find every caller.
- Changing `scoreEval` / `scoreItemEval` to fail on false alarms: frozen MF-0008 SC-4 / MF-0014 SC-5 assert their current results.

## Frozen files this will re-freeze

None. MF-0008 SC-5 and MF-0014 SC-6 read `prompt-lock.json` and stay green after `pnpm prompts:lock`; MF-0014 SC-6's §2.4 seeds are kept.

```json tasks
[
  {"id":"T1","agent":"service-builder","owns":["src/content-pipeline/prompts.ts","src/content-pipeline/eval-report.ts","src/content-pipeline/pipeline.ts"],"depends_on":[],"closes":["SC-2","SC-3"],"done_when":"frozen SC-3 cases and fillPrompt cases green","context":"GOAL SC-2, SC-3"},
  {"id":"T2","agent":"service-builder","owns":["scripts/generate/batch.ts","scripts/generate/questions.ts","scripts/generate/items.ts"],"depends_on":["T1"],"closes":["SC-2"],"done_when":"typecheck green; dry-runs print same counts","context":"step 3"},
  {"id":"T3","agent":"service-builder","owns":["prompts/writer.md","prompts/nature-card.md","prompts/diagram.md","prompts/prompt-lock.json"],"depends_on":["T1"],"closes":["SC-2"],"done_when":"all frozen SC-2 cases + MF-0008/MF-0014 lock tests green","context":"step 4"},
  {"id":"T4","agent":"service-builder","owns":["scripts/generate/eval.ts","package.json"],"depends_on":["T1","T2"],"closes":["SC-3","SC-4"],"done_when":"pnpm generate:eval --dry-run prints 3 sets + estimate","context":"step 5"},
  {"id":"T5","agent":"human+orchestrator","owns":["packs/*/questions/**","packs/ccdv-f/cards/**","packs/ccdv-f/diagrams/**"],"depends_on":["T3","T4"],"closes":["SC-3","SC-4","SC-5","SC-6"],"done_when":"stop rule reached or all packs run","context":"step 6; needs ANTHROPIC_API_KEY"},
  {"id":"T6","agent":"orchestrator","owns":[".planning/evidence/MF-0022.md"],"depends_on":["T5"],"closes":["SC-7"],"done_when":"hand-off lists one commit per pack-domain","context":""},
  {"id":"T7","agent":"ui-builder","owns":[],"depends_on":["T5"],"closes":["SC-8"],"done_when":"review queue shows items","context":"db:reset approved once"}
]
```
