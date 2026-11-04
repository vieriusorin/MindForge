---
ticket_id: MF-0031
tier: normal                      # new pack files + (maybe) one optional item field; no migration expected: packs register via sync-question-keys
stage: handoff
branch: feat/MF-0016              # current worktree branch; move to feat/MF-0031 before BUILD
builds_on: [MF-0001, MF-0003, MF-0006, MF-0008, MF-0014]
last_iteration: 0
goal_status: complete-pending-manual-commit
---

> Claimed 2026-11-04 (`/gsd-goal-loop`, brief: add the course "Production-Grade Prompting, Agents & Tool use"
> as seed content, readable by juniors and seniors, with questions, cards, diagrams and a validation plan).

## Objective

**Today.** MindForge has one real pack (`ccdv-f`, exam) and a placeholder (`team-onboarding-sample`). The team is
taking the course *Production-Grade Prompting, Agents & Tool use* and has nothing to practise it with.

**End state.** A second real pack, `kind: course`, under `packs/<slug>/`:
1. A blueprint (`pack.yaml`): domains → skills with weights that follow the course's module structure, and per
   skill the public documentation pages it is grounded in (`sources`).
2. Seed items per skill, written so a developer at any level can learn from them:
   - **questions** (scenario MCQs with a rationale on every option, citing a source),
   - **nature cards** (simply / in nature / where it breaks / contrast),
   - **diagrams** (ADR 0003 graphs: direction, nodes, edges; drawn by React Flow + dagre) that connect the concepts.
3. The pack loads with zero code changes, is registered locally by `pnpm db:sync-keys`, its items appear in the
   review queue, and it is playable on the local stack.
4. A **validation plan**: how every item is proven correct before a learner trusts it (loader + citation gates,
   AI verifier pass, two human approvals + analogy owner, flag flow).

## Affected

- **Roles:** pack author (user), reviewers, analogy owner, learners.
- **Surfaces:** `packs/<slug>/{pack.yaml,questions,cards,diagrams}/**`; local DB registry via
  `scripts/sync-question-keys.mjs` (no schema change); possibly `src/engine/content/schema.ts` if items get a level
  (Open question Q-2).

## Constraints

- CONTEXT.md *Source*: **course content behind a login is never a source**; MINDFORGE.md §1: Skilljar is never
  scraped. Items cite public docs only, and every citation is one of its skill's `sources`.
- MINDFORGE.md principle 3: analogies are labelled, say where they break, and cite. A fun but wrong item is a bug.
- ADR 0001: items live in files; the DB holds keys + reviews. "Seed the database" = pack files + key sync.
- `origin: ai` for every item drafted in this ticket; `author` = the person who ran the drafting (an author's own
  approval never counts).
- UI rules: no new component types for content; diagrams render through `DiagramFigure` only.
- Local stack only.

## Out of Scope (proposed)

- Copying course text, slides or transcripts into the repo.
- New play modes or new item types (Cuckoo is MF-0016).
- Paid generation runs (MF-0022 owns the API key and real batches).
- Charts inside items (the item schema has none; dashboards already chart the forest per pack).

## Decided without a question (2026-11-04)

The user dismissed the intake question dialog and said "continue"; the recommended default was applied to each,
recorded here so any can be overridden at the checkpoint (all are reversible file edits).

- **Q-1 Source → public docs only.** No course text enters the repo (CONTEXT.md *Source*). The blueprint follows
  the course title's three themes (prompting, tool use, agents), and every skill's `sources` are public pages that
  are already in `.cache/corpus/` (fetched by MF-0008), so every item can be fact-checked offline against the exact
  text it cites. When the user adds the course outline, weights and skill names are re-mapped in a follow-up edit.
- **Q-2 Levels → optional `level` on every item type:** `foundation` (junior: what it is, when to use it),
  `practitioner` (mid: apply it to a scenario, pick between options), `expert` (senior: failure modes, trade-offs,
  production edge cases). Optional, so `ccdv-f` loads unchanged. Showing it in the UI is a follow-up ticket.
- **Q-3 Volume → starter set:** per skill 1 card, 1 diagram, 6 questions (2 per level). Topping up to the
  Covered-skill bar (15 questions) is the MF-0022 pipeline's job, which now has this pack's sources to fetch.
- **Q-4 Charts → the existing per-pack forest charts.** No chart item type.
- Slug `prod-prompting`, `kind: course`, no `exam:` block (course packs have no readiness weather).
- `author: sorin.vieriu@ddroidd.com` (the person who ran the drafting), `origin: ai`.

## Blueprint

| Domain | Weight | Skill | Weight | Sources (all in `.cache/corpus/`) |
|---|---|---|---|---|
| D1 Prompting for production | 34 | D1.S1 Clear, direct, structured prompts | 12 | prompting best practices |
| | | D1.S2 Examples, reasoning and effort | 11 | prompting best practices, effort |
| | | D1.S3 Structured outputs and success criteria | 11 | structured outputs, define success |
| D2 Tool use | 36 | D2.S1 Defining tools | 12 | tool use overview, define tools |
| | | D2.S2 The tool-use loop | 12 | tool use overview, handle tool calls |
| | | D2.S3 Tools at scale with MCP | 12 | MCP architecture, MCP server concepts |
| D3 Agents in production | 30 | D3.S1 Workflows vs agents | 10 | building effective agents |
| | | D3.S2 Context engineering | 10 | effective context engineering, context windows, prompt caching |
| | | D3.S3 Production hardening | 10 | errors, rate limits, mitigate jailbreaks |

## Success Criteria (drafted 2026-11-04; defaults applied, see above)

- [x] SC-1: `packs/prod-prompting/pack.yaml` loads via `loadPackFile`: slug `prod-prompting`, `kind: course`, the 3
  domains and 9 skills of the Blueprint with those codes and weights, every skill ≥ 1 https source.
  Proof: frozen acceptance test.
- [x] SC-2: questions, cards and diagrams accept an optional `level` of `foundation | practitioner | expert`, reject
  any other value, and items without `level` still load (`ccdv-f` unchanged). Proof: frozen acceptance test.
- [x] SC-3: the pack's content loads through `loadPackContent` with no issue, and every question `source.url` and
  every card/diagram source is one of its skill's `sources` (CONTEXT.md *Citation*). Proof: frozen acceptance test.
- [x] SC-4: every skill has ≥ 6 questions with ≥ 2 at each level, ≥ 1 card and ≥ 1 diagram; every card links a
  diagram of the same skill; every item is `origin: ai`, has the author above and a `level`.
  Proof: frozen acceptance test.
- [x] SC-5: every question has 4 options and `select: 1`, option texts are distinct, and no option letter is the key
  for more than 40% of the pack's questions (answer-position bias). Proof: frozen acceptance test.
- [x] SC-6: every diagram has ≥ 4 nodes and every node is on at least one edge (it connects concepts, not a list).
  Proof: frozen acceptance test.
- [x] SC-7: an independent fresh-context verifier checks every item against the cached text of the source it cites;
  each finding is fixed or answered, and the report sits in the evidence. Proof: report in `.planning/evidence/MF-0031.md`.
- [x] SC-8: `pnpm db:sync-keys` on the local stack registers `prod-prompting` and its 54 question keys; a second run
  changes nothing. Proof: DB read-back pasted in evidence.
- [~] SC-9 (partial: diagram drawing unverified in a browser): on :3001 a learner in a group on the new pack sees its items in the review queue and a diagram renders.
  Proof: browser check.
- [x] SC-10: `docs/plan/prod-prompting-validation.md` gives the per-item proof ladder (loader gates → verifier →
  2 approvals + analogy owner → flags) and who signs each step. Proof: the file.
- [x] SC-11: `pnpm typecheck && pnpm lint && pnpm test && pnpm build` exit 0. Proof: receipt in LOOP-VERIFY.md.

### Constraints → how met

- Login content never a source → SC-1/SC-3 restrict citations to the skill's public `sources`; SC-7 checks them
  against the cached public text.
- Analogies labelled + "where it breaks" → card schema already requires `whereItBreaks`; SC-7 checks each break.
- ADR 0001 → no table; SC-8 uses the existing sync.
- Diagrams via `DiagramFigure` only → SC-9 renders through the existing review UI; no new component.

### Riskiest step

Content correctness: 72 AI-drafted items that read plausibly can still state a wrong fact. Covered by SC-7
(fresh-context verifier against the exact cited text) and, after hand-off, by the review flow (2 approvals,
analogy owner for cards). Re-run state: `sync-question-keys` is idempotent and reviews are keyed by content hash;
an item edited after review resets its approvals by design (ADR 0001). No manifest or id is kept on disk.

### Concerns

- C-1 (owner: user): the blueprint is derived from the course title, not its syllabus. Re-map when the outline is
  added. Not blocking: the files are the contract and are cheap to edit before reviews start.
- C-2 (owner: user): branch. This worktree is on `feat/MF-0016` with MF-0016's GOAL modified; MF-0031 files are
  disjoint and listed separately in the hand-off.

## Out of Scope (decided)

- Copying course text, slides or transcripts. New play modes or item types. Paid generation runs (MF-0022).
- Showing `level` in the UI or filtering by it (follow-up ticket).
- Chart items.

## Iteration Log

- 2026-11-04 intake drafted; Q-1…Q-4 defaulted (user dismissed dialog, said continue); DESIGN written.
- 2026-11-04 iteration 0: built; 3 drafting forks + 3 fresh-context verifiers (19 FIX resolved); receipt DONE for MF-0031 scope; SC-9 diagram drawing unverified. Hand-off.
