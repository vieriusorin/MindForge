---
ticket_id: MF-0022
tier: normal                      # paid model runs + content files; small script/prompt code, no app code
stage: build
branch: feat/MF-0022
builds_on: [MF-0008, MF-0014, MF-0031, MF-0037, MF-0038, MF-0039, MF-0040, MF-0042]
last_iteration: 0
goal_status: blocked-on-user      # offline build done; paid runs need ANTHROPIC_API_KEY in .env.local (C-0)
track: C
week: W2
depends_on: [MF-0008, MF-0014]
---

> Split out of MF-0008 in DESIGN on 2026-11-04 (user decision): every proof that needs a paid Claude
> call. MF-0008 and MF-0014 build and prove the pipeline offline with a mocked client; this ticket runs
> it for real. Re-scoped 2026-11-05 by the user to **every content pack**, not only `ccdv-f`.

## Objective

**Today:** `pnpm generate:{corpus,questions,cards,diagrams}` and the verifier scorers exist, proven only
offline. Seven content packs hold hand-written starter sets (CCDV-F: 2–3 questions per skill; the six
course packs: 6 questions, 1 card, 1 diagram per skill) and several GOALs defer "top skills up to the
Covered-skill bar" to this ticket. The writer, card and diagram prompts hard-code "Claude Certified
Developer – Foundations exam", so a run on any other pack would frame its items as CCDV-F exam items.

**End state:** the verifier is proven on the golden sets with the real model, the injection fixture is
proven against the real writer, and every pack's skills are topped up with verified `origin: ai`
questions (and CCDV-F's missing diagrams and cards), written as reviewable files grouped one commit per
pack-domain, each batch under the per-batch cap with its real cost logged.

## Affected users and surfaces

- Learners and reviewers of all 7 content packs (`agent-skills`, `ai-capabilities`, `ccdv-f`,
  `claude-code-in-action`, `platform-foundations`, `prod-prompting`, `subagents`). `team-onboarding-sample`
  has no sources and is out of scope.
- `prompts/{writer,nature-card,diagram}.md` + `prompt-lock.json`, `scripts/generate/**` (a new eval
  command), `packs/*/questions/*.yaml`, `packs/ccdv-f/{cards,diagrams}/**`, `.cache/{corpus,runs}/`
  (git-ignored).

## Constraints

- Key in `.env.local` only; never in CI or Vercel (ROADMAP D-2). Console cap $100/month.
- Skilljar content is never fetched (MINDFORGE §1.3).
- `MF_MAX_BATCH_USD=50` (user's `.env.local`, 2026-11-05): a batch whose upper-bound estimate exceeds it
  is refused before any call (MF-0008 SC-6).
- Never commit, push or open PRs (`no-commit.md`).
- CCDV-F exam is 2026-12-07 (memory: MindForge vision): CCDV-F content first.

## Discovery (2026-11-05, read-only)

- Credentials: `.env.local` holds `MF_AUTHOR_EMAIL`, `MF_MAX_BATCH_USD=50`, **no `ANTHROPIC_API_KEY`**;
  not in the shell; `ant` CLI not installed (no profile).
- Corpus: `pnpm generate:corpus --pack <p>` for all 7 packs: 0 refused; only unsupported = CCDV-F
  exam-guide PDF (known, MF-0008).
- Dry-runs (writer batch only, upper bound; verifier batch extra):

  | pack | questions | diagrams | cards |
  |---|---|---|---|
  | agent-skills | 162 req / $26.89 | 0 | 0 |
  | ai-capabilities | 144 / $16.95 | 0 | 0 |
  | ccdv-f | 572 / $70.55 (> $50 cap → per domain) | 46 / $5.75 | 48 / $5.99 |
  | claude-code-in-action | 198 / $30.67 | 0 | 0 |
  | platform-foundations | 162 / $17.55 | 0 | 0 |
  | prod-prompting | 162 / $21.89 | 0 | 0 |
  | subagents | 144 / $26.06 | 0 | 0 |
  | **total** | **1,544 / $210.56** | **$5.75** | **$5.99** |

  Writer upper bound ≈ **$222**; the bound assumes every request writes the cache and uses all 16,000
  `max_tokens`. The Opus verifier batch is extra (≈ same order). Real cost is unknown until one batch runs.
- Models/prices re-checked against the claude-api skill (2026-11-05): `claude-sonnet-5-5` $2/$10,
  `claude-opus-5-5` $4/$20, Batches 50% — match `src/content-pipeline/cost.ts`. No `temperature` or
  thinking params sent (both would 400 / are defaults). Opus 5.5 default effort is `medium`; the
  verifier sends none. Batches reject the `fallbacks` param, so a refusal is dropped and logged
  (`scripts/generate/batch.ts:120`), which is the existing behaviour.
- No script runs the verifier eval or the injection fixture against the real model: `scoreEval` /
  `scoreItemEval` are library functions only. SC-3/SC-4 need a new command.
- Golden sets: questions 12 cases (3 clean, 3 each wrong-key / missing-rationale / wrong-citation);
  cards 5 (1 clean, 1 of each of 4 flaws); diagrams 4 (2 clean, wrong-edge 1, factual-error 1,
  **wrong-citation 0**). `falseAlarms` is reported but never fails the eval.
- Baseline: typecheck ✓, lint ✓, test 121 files / 528 tests ✓. `main` CI on 2233f67: `success`.

## Success Criteria

- [x] SC-1: The Owner reviewed `packs/ccdv-f/pack.yaml` `sources` (MF-0008 C-1). Closed by the user
  2026-11-05 ("2 good"). The six course packs' sources were written and verified in their own tickets
  (MF-0031/37/38/39/40/42) and stand as-is (user: "cover everything").
- [ ] SC-2: Generation prompts are pack-agnostic and carry the MF-0039 drafter checks. `writer`,
  `nature-card` and `diagram` hold a `{{packName}}` placeholder and no "Certified" literal;
  `fillPrompt(prompt, { packName })` replaces it, keeps `name`/`version`, and throws, naming it, on any `{{…}}`
  left unfilled; `loadPrompts` requires `{ packName }` (the pack's `pack.yaml` `name`), so no CLI can
  build a request from an unfilled prompt. Each of the three bodies has a `Before you answer, check:`
  block naming the four checks with the words **strictest** (keep the page's strictest rule and its
  qualifier for security/permission claims), **exception** (scope "always / by default" to the page's
  flag or mode that removes it), **table row** (every row the page gives is reachable in a diagram /
  covered by the item), **the page's reason** (a rationale gives the page's reason). Versions bumped,
  `prompt-lock.json` re-locked (`pnpm prompts:lock`); the nature-card §2.4 seeds stay (MF-0014 SC-6).
  Proof: frozen `mf-0022-generation.acceptance.test.ts` (filled for "Introduction to Subagents", a writer
  request's system text contains it and not "Certified Developer"); MF-0008 SC-5 and MF-0014 SC-6 lock
  tests stay green.
- [ ] SC-3: `pnpm generate:eval` runs the verifier over all three golden sets (one Batch per set, each
  under the cap), logs real cost to `.cache/runs/runs.log`, writes nothing under `packs/`, prints per
  set and flaw type `planted / caught / pass|fail|untested` plus the false-alarm ids, and exits 1 when
  any set fails. The decision is the pure `judgeEvalSet({ set, cases, found, passRate })` in
  `src/content-pipeline/eval-report.ts` (edge table below): a flaw with 0 planted is `untested`; caught
  ÷ planted < bar is `fail`; a case with no entry in `found` is a miss; any clean case with ≥ 1 found
  flaw is a false alarm and fails the set. Offline proof: frozen acceptance test (literal cases; plus the
  real golden files with no verdicts → diagrams `wrong-citation` is `untested`, every planted type is
  `fail`). Real proof: run report with **100% wrong-key, 100% empty-break, ≥ 80% every other planted
  flaw, 0 false alarms** (merges old SC-2 and SC-6).
- [ ] SC-4: `pnpm generate:eval --injection` runs the real writer on the MF-0008 injection fixture page;
  no surviving draft's schema, `origin`, `author`, `generatedBy` or `skill` came from page text.
  Proof: run report (offline structure already proven by MF-0008 SC-7).
- [ ] SC-5: Questions, every pack: for each pack-domain, one writer batch + one verifier batch, each
  under `MF_MAX_BATCH_USD`, real cost from usage in `.cache/runs/runs.log`; survivors written as
  `origin: ai` YAML under `packs/<p>/questions/`. Every pack passes its loader and `pnpm check:packs`;
  `pnpm test` stays green. Order: SC-3/SC-4 evals, then one CCDV-F domain (measured real ÷ estimate
  recorded), the rest of `ccdv-f`, SC-6, then the course packs smallest-estimate first. **Stop rule
  (C-1):** before each batch, sum real cost in `runs.log` for 2026-11; if that sum plus the next
  batch's upper bound × the measured real/estimate ratio would exceed $100, stop and list every
  unrun pack-domain in the hand-off as MF-0047's scope. Proof: runs.log lines + monthly sum + loader/gate
  output in evidence.
- [ ] SC-6: CCDV-F diagrams then cards: `pnpm generate:diagrams` then `pnpm generate:cards` cover every
  skill without one (today 23 / 24), each batch under the cap, real cost logged; every written file
  passes the pack loader. Proof: run report + logs.
- [ ] SC-7: The hand-off groups the AI files one suggested commit per pack-domain, and CCDV-F cards are
  split by domain so the analogy owner (Coder F) is not handed ~25 at once (MF-0014 C-1). PRs and their
  review in-app (MF-0007) are the user's. Proof: the hand-off list.
- [ ] SC-8: After all files land, one `pnpm db:reset` (user-approved, C-3) seeds them; the MF-0007 review
  queue on port 3001 shows at least one new `origin: ai` question per pack that ran, plus one CCDV-F card
  and one diagram. Proof: browser observation (snapshot text) in evidence.

### Edge-input table (SC-3 eval bar)

| Input state | Shown result | Decided by |
|---|---|---|
| flaw type with 3 planted (questions) | ≥ 80% means 3/3; 2/3 = 67% fails | arithmetic of MF-0008 PASS_RATE |
| flaw type with 1 planted (cards, diagrams) | ≥ 80% means 1/1 | arithmetic of ITEM_PASS_RATE |
| flaw type with 0 planted (diagram wrong-citation) | printed `untested`; neither pass nor fail; listed in evidence as unverified | user, C-2 (2026-11-05) |
| verdict missing for a case (refused / errored) | counts as a miss | MF-0008 SC-4 |
| clean case flagged (any false alarm, any set) | eval **fails**, exit 1 | user, C-2 (2026-11-05) |
| batch over cap | refused, no call, exit 1 | MF-0008 SC-6 |

## Constraints → how met

- Key only in `.env.local`: scripts read `process.env`; nothing writes the key; evidence never prints it.
- Skilljar never fetched: corpus fetches only `pack.yaml` `sources` (all docs.claude.com / anthropic.com).
- Per-batch cap: existing `submitBatch` refusal; CCDV-F questions run `--domain` / per-skill slices.
- Monthly cap: see C-1. Every run appends real cost to `runs.log`; the running total is checked against
  the user's monthly budget before each next batch.
- No commit: hand-off only.

## Decided without a question

- "PR per domain" (SC-4/SC-7 of the draft) becomes "one suggested commit per pack-domain in the
  hand-off": `no-commit.md` forbids `gh pr create`.
- In-app review of every draft (MF-0007) is the user's and reviewers' work after the files land; this
  ticket proves they load, not that they were approved.
- Diagrams and cards run only for CCDV-F: the six course packs' dry-runs need 0 (starter sets cover
  every skill).
- The verifier eval proves the model + prompt, not a pack: one golden set serves every pack.
- Verifier effort stays at the model default; it is raised only if SC-3's real run fails the bar
  (then: back to BUILD, one iteration).
- The new eval command is `scripts/generate/eval.ts`, reusing `runBatch`, `scoreEval`, `scoreItemEval`.

## Concerns (owner)

- **C-0 (user): no credentials.** `ANTHROPIC_API_KEY` is not in `.env.local` (5 variables there:
  Supabase ×3, `MF_AUTHOR_EMAIL`, `MF_MAX_BATCH_USD`), not in the shell, and `ant` is not installed.
  Nothing paid can run until it is present.
- ~~C-1~~ resolved 2026-11-05 (user): measure on one domain, then run until November's spend reaches
  $100; the rest goes to reserved MF-0047.
- ~~C-2~~ resolved 2026-11-05 (user): any false alarm fails the eval; a 0-case flaw type is `untested`.
  Residual: golden sets stay small (1 case per card/diagram flaw); Coder F's ~30 golden questions do
  not exist yet. Accepted by the user with the bar above.
- ~~C-3~~ resolved 2026-11-05 (user): one `pnpm db:reset` at TEST is approved (SC-8).

## Out of Scope

- The MF-0033 grounding gate for questions/cards/diagrams. Cuckoo items. New play modes or item types.
- Approving drafts in-app. Hosted DB writes. `team-onboarding-sample`.

## Open questions

- (answered 2026-11-05) Who holds the key: the user, in `.env.local`.

## Iteration Log

- 2026-11-05 intake + design drafted; discovery read-only (corpus fetch to `.cache/` only).
- 2026-11-05 user resolved C-1..C-3; SC-2/SC-3 frozen RED (11/11); MF-0047 reserved for unrun batches.
- 2026-11-05 iteration 0 build (offline): fillPrompt + judgeEvalSet + injectionFindings, prompts v2 re-locked,
  `generate:eval`, questions `--domain`. Gate: typecheck ✓ lint ✓ test 123/542 ✓. Paused before T5 (paid):
  `.env.local` still has no ANTHROPIC_API_KEY.
