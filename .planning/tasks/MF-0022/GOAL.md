---
ticket_id: MF-0022
tier: normal                      # paid model runs + content PRs; no app code
stage: intake
branch: main
builds_on: [MF-0008, MF-0014]
last_iteration: 0
goal_status: reserved             # owner: user (needs an Anthropic API key and the Owner's review)
track: C
week: W2
depends_on: [MF-0008]
---

> Split out of MF-0008 in DESIGN on 2026-11-04 (user decision): every proof that needs a paid Claude
> call. No `ANTHROPIC_API_KEY` exists yet. MF-0008 builds and proves the pipeline offline with a
> mocked client; this ticket runs it for real. The deliverable from MF-0008 is its runbook.

## Objective

MF-0008 ships `pnpm generate:corpus`, `pnpm generate:questions` and the verifier harness, proven
offline. This ticket puts a key in place, runs them against the real docs and models, proves the
verifier on the golden set, and lands the drafts as reviewable PRs.

## Success Criteria (draft)

- [ ] SC-1: The Owner has reviewed and extended `packs/ccdv-f/pack.yaml` `sources` per skill (MF-0008 C-1) before the first full run. Proof: the review PR.
- [ ] SC-2: The verifier eval over the golden set with the real model catches 100% of planted wrong keys and ≥ 80% of the other planted flaws. Proof: run report.
- [ ] SC-3: The injection fixture run against the real writer produces no draft whose schema, `origin`, `author` or `generatedBy` came from page text. Proof: run report.
- [ ] SC-4: One real Batch run per domain stays under `MF_MAX_BATCH_USD`, logs its real cost from usage, and its survivors land as one PR per domain (MF-0008 C-2), reviewed in-app through MF-0007. Proof: run logs + PR links.
- [ ] SC-5 (from MF-0014, user decision 2026-11-04): `pnpm generate:diagrams` then `pnpm generate:cards` run for real cover every skill without a diagram / card in the files (today 23 / 24), each batch under `MF_MAX_BATCH_USD`, real cost in `.cache/runs/runs.log`; every written file passes the pack loader. Proof: run report + logs.
- [ ] SC-6 (from MF-0014): the card and diagram golden sets with the real verifier catch 100% of empty "where it breaks" and ≥ 80% of every other planted flaw type. Proof: eval output.
- [ ] SC-7 (MF-0014 C-1): AI cards land as one PR per domain, staggered so the analogy owner (Coder F) is not handed ~25 cards at once. Proof: PR links.

## Constraints

- Key in `.env.local` only; never in CI or Vercel (ROADMAP D-2). Console cap $100/month.
- Skilljar content is never fetched (MINDFORGE §1.3).

## Open questions

- Who holds the key, and the monthly cap per person.
