---
ticket_id: MF-0014
tier: normal                      # offline script + one optional schema field on pack items; no DB, no app runtime change
stage: handoff
branch: feat/MF-0014
builds_on: [MF-0006, MF-0008, MF-0010]
last_iteration: 0
goal_status: complete-pending-manual-commit
track: C                          # seat Coder B; analogy review by Coder F
week: W3
depends_on: [MF-0008]
---

> Drafted 2026-11-03 from the planning grill (Q7, Q13). Claimed 2026-11-04 on `feat/MF-0014` (user, `/gsd-goal-loop MF-0014`).
> DESIGN redrafted 2026-11-04 on the MF-0008 shape: offline harness here, paid runs split out (below).

## Objective

**Today.** G3 needs an approved nature card and an approved diagram for every skill (CONTEXT.md *Covered
skill*). The pack has 1 card (D5.S1) and 2 diagrams (D1.S3, D5.S1) for 25 skills. Hand-writing (H-2) will
cover only a few by W3. MF-0008 built the corpus → writer batch → verifier → YAML pipeline for questions only.

**End state.** The same pipeline also drafts **nature cards** (with a specific "where it breaks") and **diagrams**
(ADR 0003 graph YAML: direction, nodes, edges) for every skill that has none in the pack files. A second model
verifies them, and the survivors are written as `origin: ai` files for a PR. Reviewers and the analogy owner then
approve them in the app (MF-0007 queue, which already covers cards and diagrams by item type).

## Affected

- **Roles:** content-pipeline owner (runs it), analogy owner (Coder F; approves cards), reviewers.
- **Surfaces:** `src/content-pipeline/**` (logic + tests), `scripts/generate/{cards,diagrams}.ts` (thin CLIs),
  `package.json` (2 scripts), `prompts/{nature-card,diagram,card-verifier,diagram-verifier}.md` + `prompt-lock.json`,
  `evals/golden/**`, `src/engine/content/schema.ts` (optional `generatedBy` on cards and diagrams),
  `packs/ccdv-f/{cards,diagrams}/*.yaml` (written only by the paid run, not by this ticket).
- **Not touched:** the database, RLS, the review flow, any page or client component.

## Constraints

- Same rules as MF-0008: local only (key in `.env.local`, never CI/Vercel), cost guard `MF_MAX_BATCH_USD` before
  submitting, corpus is untrusted data, model + prompt version recorded on every item, citations required, Skilljar never fetched.
- The seed nature library in `MINDFORGE.md` §2.4 is the starting point. The writer may propose other analogies, but
  "where it breaks" must name a real limit of that analogy.
- Diagrams must pass the MF-0006 graph schema (ADR 0003: unique node ids, no edge to an unknown node, ≥ 2 nodes, ≥ 1 edge).
- Structured outputs cannot enforce `minItems`/`minLength` ("complex array constraints" and string constraints are
  unsupported, claude-api skill 2026-11-04). Counts and non-empty entries are enforced by code, never trusted to the schema.

### Constraints → how met

| Constraint | How met | SC |
|---|---|---|
| local only, key never in CI | thin `tsx` CLIs; no import from `src/app`; real run in MF-0022 | SC-1 |
| cost guard | both CLIs go through MF-0008 `submitBatch` + `estimateBatchCost`; `--dry-run` needs no key | SC-7 |
| corpus untrusted | reuse `wrapCorpus`; strict draft schemas; provenance and ids set by code | SC-3, SC-4 |
| model + prompt recorded | `generatedBy: { model, prompt }` on `ai` cards and diagrams (MF-0008 C-3 precedent) | SC-2 |
| citations | every card/diagram `sources` ⊆ its skill's `sources` in `pack.yaml` | SC-3, SC-4 |
| "where it breaks" real | code drops empty; verifier flags generic; golden set proves both | SC-3, SC-5 |
| diagram parses | output re-validated with the pack's own `DiagramSchema` before writing | SC-4 |

## Scope split

No Claude credential exists (2026-11-04: `ANTHROPIC_API_KEY` unset in the environment). As in MF-0008, every
proof that needs a paid model call moves to **MF-0022** (SC-5..SC-7, see C-2): the real card and diagram batches,
the verifier eval with the real model, and the per-domain PRs. This ticket builds and proves everything offline
with the Claude client injected and mocked, plus a real `--dry-run` against the real pack and corpus.

## Decided without a question

- One card and one diagram per skill; over-generation reuses MF-0008's factor: need 1 → request `ceil(1 × 1.25) = 2`
  drafts, write at most 1 (MF-0008 SC-2/SC-3 rule, `OVERGENERATION`).
- **Which skills need one** is read from the pack files: a skill with ≥ 1 card (any origin) gets no card draft; same for
  diagrams. Approval state lives in the hosted DB, which an offline script must not read; an unreviewed AI card
  already in the files would otherwise be generated twice. To regenerate, delete the file. `--skill` limits the run.
- `generatedBy` on cards and diagrams: optional, `ai` only, strict `{ model, prompt }`. Same rule and wording as
  questions (MF-0008 C-3, CONTEXT.md Origin). The card/diagram screens are Server Components and the client
  island (`FlowDiagram`) gets graph fields only; PLAN confirms this, so no DTO change is expected.
- Writer = `claude-sonnet-5-5`, verifier = `claude-opus-5-5`, Batch prices as in `cost.ts` (claude-api skill
  2026-11-04, unchanged since MF-0008). `custom_id` keeps MF-0008's `D2_S1-0` pattern (`^[a-zA-Z0-9_-]{1,64}$`);
  cards and diagrams are separate batches, so ids never collide.
- The §2.4 seed library goes into the `nature-card` prompt body, so a change to it is a prompt version bump
  (SC-6) and is recorded in `generatedBy.prompt`.
- Card → diagram link: code sets `card.diagram` only when the skill has exactly one diagram in the files at
  write time; never from model output. Run `generate:diagrams` before `generate:cards`.
- Ids by code: `<pack>.<skill>.card-<runTag>-1` / `<pack>.<skill>.diagram-<runTag>-1`; files
  `<skill>.<runTag>.yaml` (loader reads every `*.yaml` in the folder, as for questions).
- Code checks run before the verifier and count as caught in the eval: empty or missing "where it breaks",
  citation outside the skill's sources, a diagram the graph schema rejects.
- Flaw names: cards `factual-error`, `generic-break`, `wrong-citation`; diagrams `wrong-edge`, `factual-error`,
  `wrong-citation`. Question flaws (`FLAWS`) are unchanged.
- No proof wipes or restarts the local stack (all offline). Preflight 2026-11-04 on `feat/MF-0014` (= main d7bc39d):
  `pnpm typecheck` clean, `pnpm lint` clean, `pnpm test` 239/239.

## Success Criteria (confirmed by the user and frozen 2026-11-04)

- [x] SC-1: `planCardRun` / `planDiagramRun` list exactly the pack skills with no card / no diagram in the files
  (`--skill` narrows to one; a skill without fetched corpus is listed as skipped, not silently dropped).
  `pnpm generate:diagrams --dry-run` and `pnpm generate:cards --dry-run` on the real pack print one row per such
  skill (today: 23 diagram skills, 24 card skills) and an estimated cost, without a key and without calling the API.
  Proof: unit test over the real pack files (counts are literals from the files) + dry-run log.
- [x] SC-2: The card and diagram schemas accept an optional `generatedBy: { model, prompt }` (non-empty strings,
  nothing else) on `ai` items only; on a `human` or `official` item it is a validation error; unknown keys are
  still rejected; all existing pack files still load. Proof: unit test.
- [x] SC-3: `renderCardFile` writes YAML that passes the pack loader: `origin: ai`, `author` = `MF_AUTHOR_EMAIL`,
  `generatedBy`, id and `skill` from code; ≥ 1 non-empty "where it breaks" entry and ≥ 1 source, every source one of
  the skill's `sources`; a draft with an empty / whitespace-only / missing "where it breaks" or a foreign source is
  dropped with a reason; at most 1 card per skill. Proof: loader test over fixture output.
- [x] SC-4: `renderDiagramFile` writes YAML that passes the pack loader (same provenance rules); a draft with an edge
  to an unknown node, a duplicate node id, < 2 nodes, no edge or a foreign source is dropped with a reason; at most
  1 diagram per skill. Proof: loader test over fixture output.
- [x] SC-5: Golden set `evals/golden/` gains card and diagram cases: the human D5.S1 card and the D1.S3 and D5.S1
  diagrams unchanged, plus planted variants: empty "where it breaks", generic "where it breaks", a factual error, a
  wrong citation (card); a wrong arrow, a factual error in a label (diagram). The scorer counts code-caught flaws as
  caught, reports per-flaw rates, and passes only at 100% for empty "where it breaks" and ≥ 80% per other flaw type;
  with mocked verdicts it reports the expected rates and fails below the thresholds; the empty case is caught by code
  with no verdict at all. MF-0008's question golden file still loads. Proof: unit test.
- [x] SC-6: Four new prompts with version headers are in `prompts/prompt-lock.json`; changing one's body without a
  bump fails the existing check; the `nature-card` prompt contains every §2.4 seed concept. Proof: unit test.
- [x] SC-7: Both CLIs go through the cost guard: a cap below the estimate refuses before the (spy) client is called;
  each real run appends writer + verifier usage and cost to `.cache/runs/runs.log`. Proof: unit test with a spy client.
- [x] SC-8: Injection defences: card and diagram drafts parse against strict schemas (extra field, wrong shape or
  over-long text → dropped); `origin`, `author`, `generatedBy`, `skill`, `id` and `diagram` link are never read from
  model output; corpus wrapped with `wrapCorpus`. Proof: unit test with the injection fixture page.

## Concerns

| # | Collision | Owner | Status |
|---|-----------|-------|--------|
| C-1 | ~25 cards land at once on the analogy owner; split the PR by domain and stagger. The PRs are output of the real runs. | Coder B + Coder F | moved 2026-11-04 (user) to MF-0022 SC-7 |
| C-2 | Where the paid runs go. `MF-0022` and `MF-0023` each held two tickets (a merge concatenated MF-0008's paid runs / Stop-hook gate with MF-0012's double-click / reveal tickets). Code cites `MF-0022` as the paid-runs ticket. | user | resolved 2026-11-04 (user): untangled; paid runs → MF-0022 SC-5..SC-7 |

## Out of Scope

- Cuckoo writer (MF-0016), illustrated images, personal analogy themes.
- The real runs, the real-model eval and the content PRs (MF-0022).

## Decided by the user (2026-11-04)

- C-2: untangle the collision. MF-0022 = paid runs (MF-0008), MF-0023 = Stop-hook gate (MF-0008 retro);
  MF-0012's tickets renumbered to **MF-0026** (Walk/Seed double-click) and **MF-0027** (learn-the-key), with
  their references in MF-0012's GOAL, RETRO and evidence. MF-0014's real runs, real-model eval and PR split
  are MF-0022 SC-5..SC-7. Hand-off lists these planning edits as a separate hunk.
- C-1: moved to MF-0022 SC-7.
- Skip rule: any card / diagram in the pack files (any origin) means the skill gets no draft.

## Open questions

- none.

## Iteration Log

<!-- append-only -->

- 2026-11-04 · design · Claimed on `feat/MF-0014`. Read MF-0008 pipeline, content schema, §2.4/§2.5, MF-0007
  review queue (covers cards/diagrams by item type). claude-api skill: model ids and prices unchanged; structured
  outputs do not enforce minItems/minLength → code enforces. Baseline green (239/239). Redrafted SCs on the MF-0008
  offline shape. Open: C-1 (move), C-2 (paid-runs ticket number). Nothing frozen, no code.
- 2026-11-04 · design · User: C-2 untangle (MF-0012's tickets → MF-0026/MF-0027; paid runs → MF-0022 SC-5..7),
  C-1 moved to MF-0022, skip rule = any item in files. No concern open. Waiting for SC confirmation before freeze.
- 2026-11-04 · design → plan · User confirmed the SCs. Froze 2 files, 7 tests red at runtime (FROZEN.json,
  LOOP-VERIFY.md); typecheck + lint green with typed stubs (`src/content-pipeline/items.ts`).
- 2026-11-04 · plan → build · LOOP-PLAN.md written (4 tasks, inline). Tier normal: no plan approval.
- 2026-11-04 · build → test → handoff · T1–T4 built (hoisted `generatedBy` rule, 4 prompts, cards/diagrams/
  item-plan/item-eval/item-render, shared CLI helpers in `scripts/generate/batch.ts`). Fetched the corpus for the
  dry-runs (no key). Receipt DONE, hash cda4ed23…; 255/255, build green. No plan divergence.
