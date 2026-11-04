---
ticket_id: MF-0008
tier: normal                      # offline script; no app runtime, no schema. Handles untrusted input.
stage: plan
branch: feat/MF-0008
builds_on: []
last_iteration: 0
goal_status: in-progress
track: C                          # seat Coder B (golden set: Coder F)
week: W1–W2
depends_on: [MF-0006]            # the API key (ROADMAP D-2) now gates only MF-0020 (real runs)
---

> Drafted 2026-11-03 from the planning grill (Q3). Load the `claude-api` skill before choosing model
> ids or batch/caching syntax. SCs are proposals; the claimant confirms and freezes them.

## Objective

Today there are ~2 questions per skill; G3 needs ≥ 15 approved, so ~20 drafts per skill (some will be
rejected). Writing 500 questions by hand is not possible in the time.

End state: a local script fetches the official docs for each skill, asks Claude (Batch API, cached
doc prefix) to draft exam-style questions grounded in them, has a second model verify every draft,
and writes the survivors as `origin: ai` YAML into `packs/ccdv-f/questions/` for a PR. A golden set
proves the verifier catches wrong answer keys.

## Affected

- **Roles:** content-pipeline owner (runs it), reviewers (receive drafts).
- **Surfaces:** `scripts/generate/**`, `prompts/**` (version header), `evals/golden/**`, `.cache/corpus/` (git-ignored), `packs/ccdv-f/pack.yaml` (`sources` per skill), `packs/ccdv-f/questions/*.yaml`.

## Constraints

- Runs locally only; key in `.env.local`; never in CI or Vercel (ROADMAP D-2).
- Hard Console cap $100/month + a script-side guard that refuses a batch over `MF_MAX_BATCH_USD` (default 25) and logs real cost from usage → SC-6.
- Fetched pages are untrusted data: kept apart from instructions, delimited, never able to change output schema or origin → SC-7.
- Every item records model + prompt version and cites a corpus URL; output must pass the MF-0006 schema → SC-3, SC-5.
- Skilljar content is never fetched (MINDFORGE §1.3).

## Decided without a question

- Writer = current Sonnet, verifier = current Opus (MINDFORGE §2.8); exact ids from the `claude-api` skill.
- Target 20 drafts per skill after verification; author = the runner's email; questions are single- and multi-select like the official samples.
- Items that fail verification are dropped and listed in a run report, not written.
- Model ids from the `claude-api` skill (2026-11-03): writer `claude-sonnet-5-5`, verifier `claude-opus-5-5`. Batch API = 50% of list price. Server-side refusal `fallbacks` is rejected on Batches, so a refused or errored request is dropped and listed in the report. Forced `tool_choice` returns 400 on these models, so drafts come back through `output_config.format` (JSON schema), not a forced tool.
- `@anthropic-ai/sdk` + `tsx` as devDependencies: offline tooling only, never imported by the app. Logic and tests live in `src/content-pipeline/**` (the only place Vitest picks up tests); `scripts/generate/*.ts` are thin CLIs run with `tsx` (plain Node can't resolve the repo's extensionless / `@/` imports).
- Ownership: seat Coder B, taken by the user in this session (2026-11-03). The ~30 hand-written golden questions stay with Coder F; this ticket ships the harness and the planted variants of the 3 official samples.

## Scope split (2026-11-03)

No Claude API key exists yet (checked: no `ANTHROPIC_API_KEY` in `.env.local` or the environment). Per the
loop's infra rule, every proof that needs a paid model call moves to **MF-0020** (reserved, owned by the
user): the real Batch run, the verifier eval over the golden set, and the injection eval against the
model. This ticket builds and proves everything else offline, with the Claude client injected and mocked.

### Resumed 2026-11-04

- **Ticket for the paid runs = MF-0020**, not MF-0019: MF-0019 was claimed in the meantime by MF-0005's
  CI live proofs (`grep -rn MF-0019 .planning`). MF-0020..MF-0024 are free.
- Still no key: `ANTHROPIC_API_KEY` is not set in the environment (`.env.local` not read: guarded secret file).
- `packs/ccdv-f/pack.yaml` has no `sources` yet (0 entries). Questions cite 1-3 distinct URLs per skill.
- MF-0007 (merged): reviews bind to the item's content hash, so drafts written by this pipeline enter the
  review queue as `unreviewed` with no extra wiring. Every field in the YAML item is in the hash.
- MF-0007 retro DESIGN rule (judgements about synced content name the version read): MF-0008 records no
  judgement in the DB. Verifier verdicts live inside one run and decide only which drafts are written. Not applicable.
- Preflight (2026-11-04, `main` 8b4ecd5): `pnpm typecheck` clean, `pnpm lint` 298 files clean,
  `pnpm test` 166/166. No proof needs `db:reset` or a stack restart (all offline, mocked client).

## Success Criteria (offline; draft 2026-11-03)

- [ ] SC-1: `pnpm generate:corpus` fetches each skill's `sources` into `.cache/corpus/` with URL, fetched-at and hash; a second run with unchanged pages refetches nothing (conditional request / hash compare); a non-https URL or any `skilljar` host is refused before any request. Proof: run log on the real docs (no key needed) + unit test with a mocked fetch.
- [ ] SC-2: `buildWriterBatch(skill, corpus, n)` produces one Batch request set per skill: model `claude-sonnet-5-5`, the skill's corpus as a `cache_control` prefix identical across requests, `output_config.format` = the draft JSON schema, `custom_id` = `<skill with "." → "_">-<i>` (e.g. `D2_S1-3`; must match the Batches pattern `^[a-zA-Z0-9_-]{1,64}$`) and maps back to its skill; the request count is computed by code: `need = max(0, 20 − existing questions of the skill)` (override `--count`), asking `ceil(need × 1.25)` drafts so that `need` survive verification, and 0 requests when `need` is 0; `pnpm generate:questions --pack ccdv-f [--skill D2.S1] --dry-run` prints the plan and estimated cost without calling the API. Proof: unit test + dry-run log.
- [ ] SC-3: `writeDrafts(verified)` writes YAML that passes the MF-0006 pack loader; every question cites a corpus URL of its skill, has a rationale per option, `select` = number of correct options, `origin: ai`, `author` = `MF_AUTHOR_EMAIL` (the runner's sign-in email; the script refuses to run without it), and records `generatedBy: { model, prompt }`; at most `need` items per skill are written. Proof: loader test over fixture output.
- [ ] SC-4: The verifier harness: `buildVerifierBatch` (model `claude-opus-5-5`) and `scoreEval(cases, verdicts)` report catch rates per flaw type; the golden fixtures include the 3 official samples and a planted variant of each (wrong key, missing rationale, citation to the wrong page). With mocked verdicts, the scorer reports 100% / the right rates and fails the eval below 100% wrong-key or 80% other. Proof: unit test.
- [ ] SC-5: Prompts live in `prompts/` with a version header; changing a prompt's body without bumping its version fails a check. Proof: unit test.
- [ ] SC-6: The cost guard refuses a batch whose estimated cost exceeds `MF_MAX_BATCH_USD` (default 25) **before** submitting; cost is computed from usage (input, cache write, cache read, output) at Batch prices; each run appends tokens and cost to the run log. Proof: test with a tiny cap and a spy client that must not be called.
- [ ] SC-8: The question schema accepts an optional `generatedBy: { model, prompt }` (both non-empty strings, nothing else) and still rejects unknown keys; `generatedBy` on an `official` or `human` question is a validation error; the 53 existing questions still load; `toPlayableQuestion` never returns `generatedBy` (nor `author`). Proof: unit test.
- [ ] SC-9: Every skill in `packs/ccdv-f/pack.yaml` has at least one `sources` URL, and every question's `source.url` is listed in its skill's `sources` (seeded from the existing citations). Proof: unit test over the real pack files.
- [ ] SC-10: The writer prompt receives the skill's existing stems as "do not repeat"; code drops a draft whose normalized stem (lower-case, punctuation and whitespace removed) equals an existing question's or an earlier draft's, and lists it in the run report. Proof: unit test.
- [ ] SC-7: Structural injection defences: corpus text is wrapped in delimiters with any delimiter inside it escaped; `origin`, `author`, `generatedBy` and `skill` are set by code, never read from model output; a parsed draft with extra fields or a non-schema shape is dropped; a batch whose correct answers fall ≥ 80% on one letter is flagged in the report. Proof: unit test with the injection fixture page.

## Concerns

| # | Collision | Owner | Status |
|---|-----------|-------|--------|
| C-1 | Which official doc pages map to which skill: start from the exam guide's skill descriptions; the owner reviews the `sources` list before the first full run. | Coder B + Owner | moved 2026-11-04: the review is a prerequisite of MF-0020's first real run; this ticket only seeds the list (C-4) |
| C-2 | A PR with ~500 questions is unreadable; split by domain (8 PRs), reviewed in-app via MF-0007 rather than line by line. | Coder B | moved 2026-11-04 to MF-0020 (output of real runs); MF-0007's queue now exists for the in-app review |
| C-3 | "Records model + prompt version" (SC-3) has no field: the MF-0006 question schema is strict. Needs an optional `generatedBy: { model, prompt }` on questions (never sent to the browser). | user | resolved 2026-11-04 (user): optional `generatedBy: { model, prompt }`, written on every pipeline item, never sent to the browser → SC-8 |
| C-4 | `sources` per skill don't exist yet (C-1). Seed them from the official URLs the 53 existing questions already cite, per skill, for the owner to review? | user | resolved 2026-11-04 (user): seed from the existing citations; the Owner reviews and extends before MF-0020's first run → SC-9 |

## Decided by the user (2026-11-04)

- C-3: optional `generatedBy` on questions (SC-8). C-4: `sources` seeded from current citations (SC-9).
- The paid runs move to **MF-0020** (reserved, owner: user): the real Batch run, the verifier eval on the
  golden set with the real model, the injection eval against the model, the Owner's `sources` review (C-1)
  and the per-domain PR split (C-2). Created `.planning/tasks/MF-0020/GOAL.md`.
- No proof command wipes or restarts the local stack (all offline), so no approval was needed for one.
- Grill (2026-11-04): **Source** / **Citation** added to CONTEXT.md (a question's citation must be one of its
  skill's sources). Author = required `MF_AUTHOR_EMAIL`, the runner's sign-in email (SC-3). Target is 20
  questions per skill **in total** (`need = 20 − existing`, SC-2). Duplicates: existing stems in the prompt +
  normalized-stem drop in code (SC-10); semantic duplicates are left to review (MF-0007).

## Decided without a question (2026-11-04)

- `generatedBy` only on `ai` items (CONTEXT.md Origin: who wrote it is fixed; a model id on a human item is wrong) → SC-8.
- The fetcher refuses non-https and any `skilljar` host (MINDFORGE §1.3, constraint "Skilljar content is never fetched") → SC-1.
- Over-generation factor 1.25 so that `need` survive verification; extra survivors are not written → SC-2, SC-3.
- `docs/design/ai-services.md` (MINDFORGE §planning prompt) is not owned by any ticket and is out of scope here.

## Out of Scope

- Card and diagram writers (MF-0014), weekly re-fetch automation, NotesMapper.

## Open questions

- none.

## Iteration Log

<!-- append-only -->


- 2026-11-03 · design · On hold by the user (switched to MF-0007). Draft: offline scope split, SCs rewritten for mocked-client proofs, paid runs proposed for MF-0020. Open: C-3 (generatedBy field), C-4 (seed sources from question citations), creating MF-0020. Nothing frozen, no code.
- 2026-11-04 · design (resumed) · Stash applied on `feat/MF-0008` (from `main` 8b4ecd5). MF-0019 taken (CI), so the
  paid runs go to MF-0020 (created, reserved). User: C-3 optional `generatedBy` (SC-8), C-4 seed `sources`
  from citations (SC-9). C-1/C-2 moved to MF-0020. Baseline clean (166/166). Next: grill, then freeze.
- 2026-11-04 · design · Grill against CONTEXT.md / MINDFORGE / ADRs: Source + Citation terms added to
  CONTEXT.md; user chose required MF_AUTHOR_EMAIL, a 20-in-total target, prompt + code dedupe (SC-10).
  All concerns resolved or moved to MF-0020. Waiting for the user to confirm the SCs before freezing.
- 2026-11-04 · design · SC change (user-approved, before freeze): SC-2 `custom_id` was `<skill>.<i>`; the live Batches API reference requires `^[a-zA-Z0-9_-]{1,64}$`, so it is now `D2_S1-3` (dot → underscore, index after a hyphen).
- 2026-11-04 · design → plan · User confirmed the SCs. Froze 2 files, 10 tests red at runtime (FROZEN.json,
  LOOP-VERIFY.md); typecheck + lint green with typed stubs. Tier normal: PLAN proceeds without approval.
