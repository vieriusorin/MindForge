---
ticket_id: MF-0030
tier: normal                      # offline dev tooling; spends money only behind --run, which stays the user's
stage: handoff
branch: feat/MF-0030
builds_on: [MF-0008, MF-0014, MF-0018, MF-0022]
last_iteration: 0
goal_status: complete-pending-manual-commit
---

> Requested 2026-11-04 by the user, drafted from MF-0014's session. Picked up 2026-11-05.

## Objective

**Today.** The corpus is fetched by hand, one pack at a time (`pnpm generate:corpus --pack <p>`), and
generating all content means running three CLIs per pack in the right order (diagrams before cards,
so a card can link its skill's diagram) while keeping each batch under `MF_MAX_BATCH_USD`. CCDV-F's
questions do not fit one batch ($70.68 against a $50 cap), so they are run by hand per `--domain`.

**End state.**
1. `pnpm dev:setup --with-corpus` also fetches the public docs of every pack into `.cache/corpus/`
   (free, no key, needs network). Without the flag, setup does exactly what it does today.
2. `pnpm content:all` runs corpus, then diagrams, then cards, then questions, for every pack (or one
   `--pack`). It defaults to a dry run (plan + upper-bound cost, no key) and needs an explicit `--run`
   to spend money. Every batch keeps the `MF_MAX_BATCH_USD` guard. Setup and CI never call it.

## Facts (re-derived at pickup, 2026-11-05)

- The per-batch guard exists: `submitBatch` refuses when `estimatedUsd > capUsd`, so an estimate equal to
  the cap is allowed (`src/content-pipeline/cost.ts:91`). Cap default $25 when unset (`cost.ts:16,68`).
- Dry-run estimates today (offline, `.cache/corpus` = 35 files, CCDV-F only): questions $70.68 /
  572 requests (whole pack), $6.74 for `--domain D1`; cards $6.00 / 48; diagrams $5.75 / 46. Estimates
  cover the **writer batch only**; the verifier batch is "extra" and is guarded only at its own submit.
- `--domain` exists on `generate:questions` only (MF-0022). `generate:cards` / `generate:diagrams`
  take `--pack`, `--skill`, `--dry-run` (`scripts/generate/items.ts` `parseArgs`).
- Every generate CLI defaults to `--pack ccdv-f`; there is no "all packs" mode. `packs/` holds 7 course
  packs plus `team-onboarding-sample` (no `sources`; its dry run plans 0 requests, $0.00).
- A real run writes `packs/<p>/{questions,cards,diagrams}/*.ai-<tag>.yaml` and `.cache/runs/*`; the
  run itself needs `ANTHROPIC_API_KEY`, which `.env.local` does not hold yet (MF-0022 C-0).
- `pnpm` is 12.3.4 here (`pnpm -s` is not accepted); the dev-setup precedent spawns tools directly.
- `questions.ts` calls `main()` at import time, and `items.ts` exposes `runItemCli`. Neither returns its
  plan to a caller: the estimates exist only as printed text.

## Affected

- **Roles:** maintainer / contributor running content tooling locally. No app role, no route, no table.
- **Surfaces:** `scripts/dev-setup.mjs`, `scripts/generate/*`, `package.json` scripts, README.

## Constraints

- `prompts:lock` is never run automatically (it would re-lock an edited prompt and hide a missing
  version bump) → no step in `content:all` or `dev:setup` invokes it; a prompt out of lock stops the
  dry run with the existing `loadPrompts` error (SC-6).
- Paid runs stay the user's (MF-0022) → default is dry; `--run` is explicit; this ticket proves the
  dry and refusal paths offline with an injected runner and never calls the API (SC-2, SC-3).
- Fail before spending: every check that can fail (args, prompt lock, pack loads, each batch under the
  cap, the run total) runs for ALL planned batches before the first paid submit (SC-3, SC-4).
- `dev:setup` stays non-destructive and network-free by default (MF-0018 SC-3) → corpus only behind
  `--with-corpus` (SC-5).

## Decided without a question

- Step order per pack: corpus → diagrams → cards → questions — from the brief and `diagrams.ts` header
  ("Run before `generate:cards`").
- `generate:eval` is not a step: it evaluates the verifier, not a pack (MF-0022 "Decided").
- The cap boundary is the existing one: estimate equal to the cap passes, a cent above is refused
  (`cost.ts:91`); `content:all` reuses `maxBatchUsd` / `estimateBatchCost`, it does not restate them.
- A step that exits non-zero stops the run: later steps (cards after a failed diagrams step) are not run
  and `content:all` exits non-zero.
- The pure decisions (step list, refusal) live in a tested module; the shell only spawns
  (engineering-principles §1). Location decided at PLAN.

## Decided by the user (2026-11-05)

- C-1 → **split + refuse up front**: questions run one batch per domain; with `--run`, every writer batch
  is estimated before the first paid call, and one over the cap refuses the whole run.
- C-2 → **`--run` requires `--max-total-usd N`**; the summed writer estimates above N refuse the run
  before spending. Verifier batches are not covered by N, and the output says so.
- C-3 → **`--pack <slug>` is required** for `content:all` (one pack per invocation).
- C-4 → **the dry run fetches the corpus too**; offline it fails loud and points at `--no-corpus`,
  which skips the fetch and estimates from the cache.
- Following from C-3 without a question: `dev:setup --with-corpus` fetches every pack (free, no key);
  `--pack` there is not added (YAGNI).

## Success Criteria

- [x] SC-1: `content:all --pack A` plans, in order: corpus, diagrams, cards, then questions **once per
  domain of A** (`--domain <code>`), each step passing `--pack A`; no step names `prompts:lock` or
  `generate:eval`. A missing `--pack`, an invalid slug or a slug with no `packs/<slug>/pack.yaml` exits 1
  before any step runs. Proof: acceptance test over the pure plan + arg parser.
- [x] SC-2: Without `--run`, every diagrams/cards/questions step carries `--dry-run`, and the corpus step
  runs unless `--no-corpus` is given. With `ANTHROPIC_API_KEY` unset, `pnpm content:all --pack ccdv-f`
  exits 0 and prints one row per writer batch plus the total upper-bound estimate, with the verifier
  stated as extra. Proof: acceptance (plan) + real command log.
- [x] SC-3: With `--run`, after the corpus step and before any paid step, every planned writer batch is
  estimated; if any exceeds `MF_MAX_BATCH_USD`, the run exits 1 naming pack/step/domain and no paid step
  starts. Cap 50: a batch of 50.00 passes, 50.01 is refused. Proof: acceptance with injected estimates and
  a runner that records calls (zero paid calls on refusal).
- [x] SC-4: `--run` without `--max-total-usd`, or with a value that is not a positive number, exits 1
  before any step (corpus included). With `--max-total-usd 100`, summed writer estimates of 100.00 pass
  and 100.01 refuse before any paid step; the printout states the verifier batches are not counted.
  Proof: acceptance (same harness as SC-3).
- [x] SC-5: `pnpm dev:setup --with-corpus` runs the corpus fetch for every pack with a `pack.yaml`, after
  `.env.local` is written; without the flag no corpus step runs. A failed fetch exits non-zero with a
  message saying the stack is ready and naming the retry command. Proof: acceptance over the pure
  argv → steps helper + real run log.
- [x] SC-6: A failing step stops the run: steps after it are not started and the exit code is non-zero.
  An offline corpus failure in the dry run names `--no-corpus`. Proof: acceptance with an injected runner
  failing at corpus and at diagrams (later steps never called).
- [x] SC-7: `content:all` is called from neither `scripts/dev-setup.mjs` nor `.github/workflows/**`.
  Proof: acceptance test reading those files.
- [x] SC-8: README documents both commands; typecheck, lint, test, gate:planning green; evidence file.

### Edge inputs for the shown totals (SC-2..SC-4)

| Input state | Shown / result | Decided by |
|---|---|---|
| Pack with no fetched corpus (`--no-corpus`, empty cache) | skills listed as skipped, $0.00 | existing CLI behaviour |
| Pack with no `sources` (`team-onboarding-sample`) | 0 requests, $0.00, exit 0 | existing CLI behaviour |
| Domain whose question need is 0 | its row shows 0 requests, $0.00 | existing `questionsNeeded` |
| `MF_MAX_BATCH_USD` unset | cap $25 | `cost.ts:16` |
| `MF_MAX_BATCH_USD` invalid ("abc", 0) | exit 1 with the existing message, before any paid step | `maxBatchUsd` |
| batch estimate = cap / cap + 0.01 | allowed / `--run` refused | `cost.ts:91`, C-1 |
| summed estimate = N / N + 0.01 | allowed / `--run` refused | C-2 |
| verifier batch | not estimated, printed as extra; guarded at its own submit | existing CLI, C-2 |
| no network | corpus step fails, exit non-zero, message names `--no-corpus` | C-4 |

## Concerns

| # | Collision | Owner | Status |
|---|-----------|-------|--------|
| C-1 | When a batch is over the cap: stop, split or skip | user | resolved 2026-11-05: split + refuse up front |
| C-2 | A full run (~$222 writer + verifier) vs the $100/month console cap | user | resolved: `--max-total-usd` required. Residual: verifier batches are not bounded by N (each still under the per-batch cap) |
| C-3 | Default pack scope | user | resolved: `--pack` required |
| C-4 | Dry run and network | user | resolved: fetch, fail loud, `--no-corpus` |

## Out of Scope

- Running any paid batch (MF-0022 / MF-0047). `--domain` for cards and diagrams. The MF-0033 gate.
- Changing prompts, the lock, the pipeline's cost model, or what a real CLI run writes.

## Open questions

- none

## Iteration Log

<!-- append-only -->
- 2026-11-04 reserved from MF-0014's session.
- 2026-11-05 picked up on `feat/MF-0030`; facts re-derived; baseline typecheck ✓ lint ✓ test 617/617 ✓,
  gate:planning ✓; main CI latest in_progress (previous: cancelled, then success).
- 2026-11-05 user resolved C-1..C-4 (split + refuse up front; `--max-total-usd` required; `--pack`
  required; dry run fetches corpus, `--no-corpus`). SCs frozen as text.
- 2026-11-05 iteration 0: freeze 22 RED + SC-7 lock; build T1..T4; TEST typecheck ✓ lint ✓ test 645/645 ✓
  gate:planning ✓; real dry run ccdv-f $82.43, refusal at --max-total-usd 50, dev:setup ±--with-corpus. DONE.
