---
ticket_id: MF-0037
tier: normal                      # new pack files only; no migration, no schema change (level exists since MF-0031)
stage: handoff
branch: feat/MF-0016              # current worktree branch (shared with another session); move to feat/MF-0037 before commit
builds_on: [MF-0003, MF-0006, MF-0008, MF-0014, MF-0031, MF-0034]
last_iteration: 0
goal_status: complete-pending-manual-commit
---

> Claimed 2026-11-04 (`/gsd-goal-loop`, brief: add the course "AI Capabilities and Limitations" as a database
> seed, interpreted so every developer can learn it, juniors to seniors: questions, cards, examples, visuals,
> React Flow diagrams that connect the concepts, plus a plan to validate it and use it as a tutorial).

## Objective

**Today.** The team is taking the Skilljar course *AI Capabilities and Limitations* (Claude Developer path) and has
no MindForge pack for it. The user saved one page of it
(`~/Downloads/Intro to AI Capabilities and Limitations.html`, from `anthropic-partners.skilljar.com`, behind a login).

**End state.** A third real pack, `kind: course`, slug `ai-capabilities`, under `packs/ai-capabilities/`:
1. A blueprint (`pack.yaml`) that follows the course's lesson order: what generative AI is → how training gives it
   character → the four properties (next token prediction, knowledge, working memory, steerability) → when
   properties collide → using AI safely and effectively. Every skill lists the public pages it is grounded in.
2. Seed items per skill, each with a `level` (foundation = junior, practitioner = mid, expert = senior):
   scenario questions with a rationale on every option, a nature card (simply / in nature / where it breaks /
   contrast) that works as the worked example, and a React Flow diagram that connects the concepts. One capstone
   diagram connects all four properties.
3. "Seed the database" = the pack files + `pnpm db:sync-keys` (keys, ADR 0001) + `pnpm dev:seed`, which since
   MF-0034 builds a demo group for every pack with questions.
4. A study-and-validation guide (`docs/plan/ai-capabilities-validation.md`): the order a junior and a senior work
   through the pack, and the proof ladder every item climbs before a learner trusts it.

## Affected

- **Roles:** pack author (user), reviewers, analogy owner, learners.
- **Surfaces:** `packs/ai-capabilities/**` (new), `docs/plan/ai-capabilities-validation.md` (new),
  `src/engine/content/__tests__/mf-0037-ai-capabilities.acceptance.test.ts` (new), `.cache/corpus/` (local, not
  committed), the local DB via the existing sync + seed scripts. No `src/` production code, no migration.

## Constraints

- CONTEXT.md *Source* / MINDFORGE.md §1: course content behind a login is never a source and Skilljar is never
  scraped. **Decided by the user (2026-11-04):** the saved page is used only for its outline (lesson titles and the
  four property names) to shape domains and skills. No course text, exercise or quote goes into the repo. Items
  cite public Anthropic pages only, and each citation is one of its skill's `sources`.
- MINDFORGE.md principle 3: analogies are labelled, say where they break, and cite.
- ADR 0001: items live in files; the DB holds keys and reviews.
- ADR 0003 / ui-design.md: diagrams are graphs (direction, nodes, edges) drawn by `DiagramFigure` only.
- `origin: ai` on every item; `author: sorin.vieriu@ddroidd.com` (the person who ran the drafting).
- Local stack only. Another session is editing MF-0032/0034/0036 and `src/dev-seed/**` in this worktree; this
  ticket touches none of their files.

## Decided by the user (2026-11-04, intake dialog)

- **Source → outline + public docs.** (Above.) The CC BY-NC-SA 4.0 notice on the page does not change CONTEXT.md.
- **Charts → diagrams now, chart item later.** This ticket ships React Flow diagrams and relies on the existing
  per-pack forest charts. A chart item type is a follow-up ticket (schema + renderer).
- **Volume → starter set.** Per skill: 1 nature card, 1 diagram, 6 questions (2 per level). The MF-0022 pipeline
  tops skills up to the Covered-skill bar later; this ticket adds the sources it needs.
- **Tutorial → ordered pack + guide doc.** No new screen; a guided-lesson mode is a follow-up ticket.
- **Checkpoint (design):** blueprint and SC-1…SC-13 approved; SCs frozen.
- **`pnpm dev:seed` at TEST → approved**, knowing it replaces the local demo world (all packs' demo groups and
  previously seeded answers). It is run once. SC-10's "not run if MF-0034 is red" clause still holds.
- Baseline preflight 2026-11-04: `pnpm typecheck` 0, `pnpm lint` 0, `pnpm test` 0 (83 files, 337 tests).

## Decided without a question

- Slug `ai-capabilities`, name "AI Capabilities and Limitations", `kind: course`, no `exam:` block (course packs
  have no readiness weather; MF-0031 precedent).
- Domain and skill weights are MindForge's: the course gives none. The four properties carry the most weight
  because four of the course's six sections are about them.
- `level` is already optional on every item type (MF-0031 SC-2), so this ticket needs no schema change.
- Sources: every URL below answered HTTP 200 on 2026-11-04 (`curl -L`). The two prompt-engineering URLs that
  redirect to an anchor (`system-prompts`, `long-context-tips`) are replaced by the page they redirect to.
  `pnpm generate:corpus --pack ai-capabilities` caches them (no API key; MF-0008).
- MF-0031 retro lessons applied in the drafting brief: every backticked token and every absolute quantifier
  (`never`, `always`, `only`, `all`) must occur in the cited page (MF-0033 gate not built yet, so the verifier
  checks it), and each diagram lists every branch the cited page documents.
- The browser proof is "browser check, or HTTP render if the shared browser is held" (memory
  `feedback-browser-verification`).

## Blueprint

| Domain (course section) | W | Skill | W | Sources |
|---|---|---|---|---|
| D1 What AI is and how it is made | 22 | D1.S1 Generative AI and language models | 11 | glossary |
| | | D1.S2 How training gives a model its character | 11 | glossary, Claude's character, Claude's constitution |
| D2 The four properties | 52 | D2.S1 Next token prediction | 13 | glossary, tracing the thoughts of an LLM, extended thinking |
| | | D2.S2 Knowledge: what the model knows and doesn't | 13 | models overview, reduce hallucinations, web search tool, citations |
| | | D2.S3 Working memory: the context window | 13 | context windows, effective context engineering, token counting |
| | | D2.S4 Steerability: prompts, roles and consistency | 13 | prompting best practices, increase consistency, glossary |
| D3 Putting it together | 26 | D3.S1 When properties collide | 13 | reduce hallucinations, effective context engineering, prompting best practices |
| | | D3.S2 Using AI safely and effectively | 13 | mitigate jailbreaks, define success, reduce hallucinations |

URLs: `platform.claude.com/docs/en/about-claude/glossary`, `…/about-claude/models/overview`,
`…/build-with-claude/{context-windows,extended-thinking,citations,token-counting}`,
`…/build-with-claude/prompt-engineering/claude-prompting-best-practices`,
`…/agents-and-tools/tool-use/web-search-tool`,
`…/test-and-evaluate/strengthen-guardrails/{reduce-hallucinations,increase-consistency,mitigate-jailbreaks}`,
`…/test-and-evaluate/define-success`, `www.anthropic.com/research/{claude-character,tracing-thoughts-language-model}`,
`www.anthropic.com/news/claudes-constitution`, `www.anthropic.com/engineering/effective-context-engineering-for-ai-agents`.

## Success Criteria

- [x] SC-1: `packs/ai-capabilities/pack.yaml` loads via `loadPackFile`: slug `ai-capabilities`, `kind: course`, no
  `exam`, the 3 domains and 8 skills of the Blueprint with those codes and weights, every skill ≥ 1 https source.
  Proof: frozen acceptance test.
- [x] SC-2: the pack's content loads through `loadPackContent` with no issue, and every question `source.url` and
  every card/diagram source is one of its skill's `sources` (CONTEXT.md *Citation*). Proof: frozen acceptance test.
- [x] SC-3: every skill has ≥ 6 questions with ≥ 2 at each level, ≥ 1 card and ≥ 1 diagram; every card links a
  diagram of the same skill; every item is `origin: ai`, has the author above, a `level`, and an id prefixed
  `ai-capabilities.<skill>.`. Proof: frozen acceptance test.
- [x] SC-4: ≥ 48 questions; each has options A–D, `select: 1`, distinct option texts; no key letter is the answer
  to more than 40% of the pack's questions. Proof: frozen acceptance test.
- [x] SC-5: every diagram has ≥ 4 nodes and every node is on at least one edge. Proof: frozen acceptance test.
- [x] SC-6: D3.S1 has a capstone diagram with a node for each of the four properties (labels contain "next token",
  "knowledge", "working memory"/"context", "steerab"), and each of those nodes is on an edge to another of them or
  to a shared outcome node. Proof: frozen acceptance test.
- [x] SC-7: no item reproduces course text: no string of ≥ 12 consecutive words from the saved course page appears
  in any pack file. Proof: a scratch check run in TEST, output pasted in evidence (the page is not committed, so
  this is not a frozen test).
- [x] SC-8: an independent fresh-context verifier checks every item against the cached text of the source it
  cites (key, every rationale, every analogy break, backticked tokens and absolute quantifiers); each finding is
  fixed or answered. Proof: reports in `.planning/tasks/MF-0037/verify/`, summary in `.planning/evidence/MF-0037.md`.
- [x] SC-9: `pnpm db:sync-keys` on the local stack registers `ai-capabilities` and its question keys (count = the
  pack's questions); a second run changes nothing. Proof: DB read-back pasted in evidence.
- [x] SC-10: `pnpm dev:seed --pack ai-capabilities` creates the pack's demo group with attempts on the local stack.
  Proof: DB read-back. **Not run if the other session's MF-0034 seed work is red at TEST**; then recorded unverified.
- [~] SC-11 (partial: diagram drawing unverified, browser held): on :3001 a learner in a group on the new pack sees its items in the review queue and a diagram
  renders. Proof: browser check, or HTTP render if the shared browser is held (drawing then marked unverified).
- [x] SC-12: `docs/plan/ai-capabilities-validation.md` gives the study order per level (junior, mid, senior), the
  per-item proof ladder (loader + acceptance → grounding notes → verifier → 2 approvals + analogy owner → flags),
  who signs each rung, and the follow-ups (chart item, guided-lesson screen, top-up to 15 questions). Proof: the file.
- [x] SC-13: `pnpm typecheck && pnpm lint && pnpm test && pnpm build` exit 0, with reds attributed if they belong
  to the other session's files (baseline). Proof: receipt in LOOP-VERIFY.md.

### Constraints → how met

- Login content never a source → SC-2 restricts citations to public `sources`; SC-7 proves no course text was
  copied; SC-8 checks claims against the cached public text.
- Analogies labelled + broken → card schema requires `whereItBreaks`; SC-8 checks each break.
- ADR 0001 → no table; SC-9 uses the existing sync; SC-10 the existing seed.
- Diagrams via `DiagramFigure` only → SC-11 renders through the existing review UI.

### Riskiest step

Content correctness: ~64 AI-drafted items on a conceptual topic (what models "know", how training shapes them),
where plausible overclaims are easy ("the model always…", "fine-tuning adds knowledge"). Covered by SC-8 and by
the human review rungs after hand-off.

Re-run state (skill rule, MF-0029/0034): this ticket writes no code that deletes. (a) No ids or manifests on disk
are written by this ticket; `dev:seed`'s manifest is MF-0034's and is bound to the author email. (b) Review
verdicts are keyed by content hash; an edited item resets its approvals by design (ADR 0001). (c) `db:sync-keys`
validates every pack before writing (`validate-packs.mjs`), so an invalid new pack fails before any change. No
regression test is owed by this ticket.

### Concerns

- C-1 (owner: user, not blocking): only the Intro lesson's text was saved; the blueprint is built from the outline.
  The four property names come from the course, the explanations from public docs.
- C-2 (owner: user, not blocking): branch `feat/MF-0016` is shared with another live session; MF-0037's files are
  disjoint and listed separately in the hand-off.
- C-3 (owner: agent): the full-suite baseline may be red from the other session's uncommitted MF-0034 work; reds
  in their files are attributed, not fixed.

## Out of Scope (decided)

- Copying course text, exercises, slides or the framework PDF. A chart item type. A guided-lesson screen. Showing
  or filtering by `level` in the UI. Paid generation runs (MF-0022). The MF-0033 grounding gate.

## Iteration Log

- 2026-11-04 intake + design; four intake questions answered by the user (all recommended options); checkpoint approved, dev:seed approved.
- 2026-11-04 iteration 0: 3 drafting forks + 3 fresh-context verifiers (22 FIX resolved, 0 wrong keys); sync ×2 idempotent; dev:seed run; SC-11 partial (browser held); receipt DONE for MF-0037 scope. Hand-off.
