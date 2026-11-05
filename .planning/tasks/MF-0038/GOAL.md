---
ticket_id: MF-0038
tier: normal                      # new pack files only; no migration, no schema change (level exists since MF-0031)
stage: handoff
branch: feat/MF-0016              # current worktree branch (shared with other live sessions); move to feat/MF-0038 before commit
builds_on: [MF-0003, MF-0006, MF-0008, MF-0014, MF-0031, MF-0034, MF-0037]
last_iteration: 0
goal_status: complete-pending-manual-commit
---

> Claimed 2026-11-04 (`/gsd-goal-loop`, brief: add the course "Claude Platform & Model Foundations" as a database
> seed, interpreted so every developer can learn it, juniors to seniors: questions, cards, examples, visuals,
> React Flow diagrams that connect the concepts, plus a plan to validate it and use it as a tutorial).

## Objective

**Today.** The team is taking *Claude Platform & Model Foundations* (Anthropic Academy, Claude Associate path,
Module 1; saved locally as `~/Downloads/Claude Platform & Model Foundations.html` plus its `_files/` folder, behind
a login). MindForge has no pack for it.

**End state.** A fourth real pack, `kind: course`, slug `platform-foundations`, under `packs/platform-foundations/`:
1. A blueprint (`pack.yaml`) that follows the module's lesson order: how Claude behaves → entry points →
   capability layer → choosing a model → context and usage. Every skill lists the public pages it is grounded in.
2. Seed items per skill, each with a `level`:
   - `foundation` (junior): what the feature is and when to reach for it in claude.ai;
   - `practitioner` (mid): pick the configuration for a scenario, spot the wrong one;
   - `expert` (senior / developer): trade-offs, failure modes, and the **platform (API) counterpart** of the
     claude.ai feature (Projects ↔ system prompt + knowledge, Code Execution ↔ code execution tool, Memory ↔
     memory tool, Skills ↔ Agent Skills, context degradation ↔ context windows + compaction, tier choice ↔ pricing).
   Item kinds: scenario questions with a rationale on every option, a nature card (simply / in nature / where it
   breaks / contrast) that doubles as the worked example, and a React Flow diagram per skill. One **capstone
   diagram** connects the module's four decisions (entry point → capability layer → model → context strategy).
3. "Seed the database" = the pack files + `pnpm db:sync-keys` (keys, ADR 0001) + `pnpm dev:seed`, which since
   MF-0034 builds a demo group for every pack with questions.
4. A study-and-validation guide (`docs/plan/platform-foundations-validation.md`): the study order for a junior, a
   mid and a senior, the proof ladder every item climbs before a learner trusts it, and the course-vs-docs drift
   list (see C-1).

## Affected

- **Roles:** pack author (user), reviewers, analogy owner, learners.
- **Surfaces:** `packs/platform-foundations/**` (new), `docs/plan/platform-foundations-validation.md` (new),
  `src/engine/content/__tests__/mf-0038-platform-foundations.acceptance.test.ts` (new), `.cache/corpus/` (local,
  not committed), the local DB via the existing sync + seed scripts. No `src/` production code, no migration.

## Constraints

- CONTEXT.md *Source* / MINDFORGE.md §1: course content behind a login is never a source; Skilljar is never
  scraped (`src/content-pipeline/corpus.ts` refuses skilljar hosts). The saved page shapes the **outline only**
  (lesson order, topic names). No course text, quiz, exercise, scenario or quote enters the repo. Items cite
  public Anthropic pages only, each one of its skill's `sources`.
- MINDFORGE.md principle 3: analogies are labelled, say where they break, and cite.
- ADR 0001: items live in files; the DB holds keys and reviews. ADR 0003 / ui-design.md: diagrams are graphs
  drawn by `DiagramFigure` only.
- `origin: ai` on every item; `author: sorin.vieriu@ddroidd.com` (the person who ran the drafting).
- Local stack only. Other sessions are editing MF-0032/0034/0036/0037 files in this worktree; this ticket touches
  none of them.

## Decided by the user (2026-11-04, design checkpoint)

- **C-1 drift → docs win, skip disputes.** Items state only what today's cited page says; no question tests a
  point where the course and the docs disagree; the guide lists each drift.
- **Expert level → API counterpart.** Expert items map the claude.ai feature to its platform equivalent and cite a
  `platform.claude.com` page (SC-7). Following from this, three skills gained one platform source each before the
  freeze (D2.S1 web-search-tool, D2.S2 prompting best practices, D5.S2 rate-limits; all HTTP 200).
- **C-2 `pnpm dev:seed` at TEST → approved**, run once, after MF-0037's run if both are pending.
- **Checkpoint:** blueprint and SC-1…SC-14 approved; SCs frozen.

## Decided without a question (sources noted)

- **Source → outline + public docs.** Same request shape as MF-0037; the user chose this today for MF-0037
  (GOAL "Decided by the user", 2026-11-04). Applied unchanged.
- **Charts → diagrams now, chart item later** (MF-0037, user, 2026-11-04). The pack is charted by the existing
  per-pack forest charts; a chart item type stays a follow-up ticket (schema + renderer).
- **Volume → starter set** (MF-0037/MF-0031): per skill 1 card, 1 diagram, 6 questions (2 per level), plus the
  capstone diagram. The MF-0022 pipeline tops skills up to the Covered-skill bar (15) later.
- **Tutorial → ordered pack + guide doc** (MF-0037): no new screen; a guided-lesson mode is a follow-up.
- Slug `platform-foundations`, name "Claude Platform & Model Foundations", `kind: course`, no `exam:` block.
- Weights are MindForge's (the course gives none); they follow lesson length in the outline (capability layer is
  the longest lesson, so it carries the most).
- Sources: every URL in the Blueprint answered HTTP 200 on 2026-11-04 (`curl -L`, final URL after redirects
  recorded). Help Center pages return server-rendered text (checked: `what-are-projects`, 7.2 kB of text), so
  `pnpm generate:corpus --pack platform-foundations` can cache them (no API key, MF-0008).
- MF-0031 retro lessons in the drafting brief: every backticked token and absolute quantifier (`never`, `always`,
  `only`, `all`) must occur in the cited page (MF-0033 gate not built, so the verifier checks it); each diagram
  lists every branch the cited page documents.
- Baseline preflight 2026-11-04 16:39: `pnpm typecheck` 0, `pnpm lint` 0, `pnpm test` 1 (4 files / 19 tests red,
  all other sessions' frozen acceptance reds: `mf-0032-answer-hash.acceptance.test.{ts,tsx}` and
  `mf-0037-ai-capabilities.acceptance.test.ts`, plus one MF-0032 file). None is in MF-0038's scope; SC-14 attributes
  them against this baseline. No proof here needs `db:reset`/`supabase stop|start`; only `dev:seed` (C-2) touches
  shared state.
- Browser proof is "browser check, or HTTP render if the shared browser is held" (memory
  `feedback-browser-verification`).

## Blueprint

| Domain (module lesson) | W | Skill | W | Sources |
|---|---|---|---|---|
| D1 How Claude behaves | 10 | D1.S1 What to expect: variation, fluency ≠ accuracy, cutoff | 10 | incorrect-responses, models overview, web search |
| D2 Entry points | 22 | D2.S1 Chat, Projects, Artifacts, Research | 12 | projects, artifacts, research, web search, web-search-tool |
| | | D2.S2 Projects: instructions, knowledge, when one pays off | 10 | projects, prompting best practices (system prompts) |
| D3 Capability layer | 30 | D3.S1 Skills | 10 | what-are-skills, agent-skills overview |
| | | D3.S2 Code execution and file creation | 10 | create-and-edit-files, code-execution-tool |
| | | D3.S3 Memory, project scope and incognito | 10 | chat-search-and-memory, incognito, memory-tool |
| D4 Choosing a model | 16 | D4.S1 Model tiers: quality, speed, volume, cost | 16 | models overview, choosing-a-model, pricing |
| D5 Context and usage | 22 | D5.S1 Context budget: restart, summarize, persist | 12 | context-windows, compaction, chat-search-and-memory |
| | | D5.S2 Usage limits and planning long work | 10 | usage-and-length-limits, usage-limit-best-practices, rate-limits |

URLs (final, after redirects): `support.claude.com/en/articles/`
`{9517075-what-are-projects, 17153992-what-are-artifacts-and-how-do-i-use-them, 11088861-use-research-on-claude,`
`10684626-enable-and-use-web-search, 12512176-what-are-skills, 12111783-create-and-edit-files-with-claude,`
`11817273-use-claude-s-chat-search-and-memory-to-build-on-previous-context, 12260368-use-incognito-chats,`
`11647753-how-do-usage-and-length-limits-work, 9797557-usage-limit-best-practices,`
`8525154-claude-is-providing-incorrect-or-misleading-responses-what-s-going-on}`;
`platform.claude.com/docs/en/{models/overview, about-claude/models/choosing-a-model, about-claude/pricing,`
`build-with-claude/context-windows, build-with-claude/compaction, agents-and-tools/tool-use/code-execution-tool,`
`agents-and-tools/tool-use/memory-tool, agents-and-tools/agent-skills/overview, agents-and-tools/tool-use/web-search-tool,`
`build-with-claude/prompt-engineering/claude-prompting-best-practices, api/rate-limits}`. Every skill lists ≥ 1
`platform.claude.com` page, so SC-7 applies to all 9.

## Success Criteria (approved by the user 2026-11-04; frozen)

- [x] SC-1: `packs/platform-foundations/pack.yaml` loads via `loadPackFile`: slug `platform-foundations`,
  `kind: course`, no `exam`, the 5 domains and 9 skills of the Blueprint with those codes and weights (sum 100),
  every skill ≥ 1 https source. Proof: frozen acceptance test.
- [x] SC-2: the pack's content loads through `loadPackContent` with no issue, and every question `source.url` and
  every card/diagram source is one of its skill's `sources` (CONTEXT.md *Citation*). Proof: frozen acceptance test.
- [x] SC-3: every skill has ≥ 6 questions with ≥ 2 at each level, ≥ 1 card and ≥ 1 diagram; every card links a
  diagram of the same skill; every item is `origin: ai`, has the author above, a `level`, and an id prefixed
  `platform-foundations.<skill>.`. Proof: frozen acceptance test.
- [x] SC-4: ≥ 54 questions; each has options A–D, `select: 1`, distinct option texts; no key letter is the answer
  to more than 40% of the pack's questions. Proof: frozen acceptance test.
- [x] SC-5: every diagram has ≥ 4 nodes and every node is on at least one edge. Proof: frozen acceptance test.
- [x] SC-6: a capstone diagram (in D2.S1) has a node for each of the four decisions (labels contain "entry point",
  "capabilit", "model", "context"), connected in that order by edges, plus at least one edge back from "context"
  to an earlier decision (a restart re-enters the loop). Proof: frozen acceptance test.
- [x] SC-7: ≥ 1 expert question per skill whose source is a `platform.claude.com` page (the developer angle), for
  all 9 skills. Proof: frozen acceptance test.
- [x] SC-8: no item reproduces course text: no run of ≥ 12 consecutive words from the saved module page
  (`_files/Associate_M1_vF2.html`) appears in any pack file. Proof: scratch check in TEST, output pasted in
  evidence (the page is not committed, so not frozen).
- [x] SC-9: an independent fresh-context verifier checks every item against the cached text of the source it cites
  (key, every rationale, every analogy break, backticked tokens, absolute quantifiers, diagram branches); each
  finding is fixed or answered. Proof: reports in `.planning/tasks/MF-0038/verify/`, summary in
  `.planning/evidence/MF-0038.md`.
- [x] SC-10: `pnpm db:sync-keys` on the local stack registers `platform-foundations` and its question keys (count =
  the pack's questions); a second run changes nothing. Proof: DB read-back pasted in evidence.
- [x] SC-11: `pnpm dev:seed --pack platform-foundations` creates the pack's demo group with attempts on the local
  stack. Proof: DB read-back. Not run if the other session's MF-0034 seed work is red at TEST; then unverified.
- [~] SC-12 (partial: browser held; HTTP render shows the queue and a card, diagram drawing unverified): on :3001 a learner in a group on the new pack sees its items in the review queue and a diagram
  renders. Proof: browser check, or HTTP render if the shared browser is held (drawing then marked unverified).
- [x] SC-13: `docs/plan/platform-foundations-validation.md` gives the study order per level, the per-item proof
  ladder (loader + acceptance → grounding notes → verifier → 2 approvals + analogy owner → flags) with who signs
  each rung, the course-vs-docs drift list (C-1), and the follow-ups. Proof: the file.
- [x] SC-14: `pnpm typecheck && pnpm lint && pnpm test && pnpm build` exit 0, reds in other sessions' files
  attributed against the baseline. Proof: receipt in LOOP-VERIFY.md.

### Constraints → how met

- Login content never a source → SC-2 restricts citations; SC-8 proves no course text was copied; SC-9 checks
  claims against the cached public text.
- Analogies labelled + broken → card schema requires `whereItBreaks`; SC-9 checks each break.
- ADR 0001 → no table; SC-10 uses the existing sync, SC-11 the existing seed.
- Diagrams via `DiagramFigure` only → SC-12 renders through the existing review UI.

### Riskiest step

Content correctness on a **moving product surface**: claude.ai features (Projects, Memory, Skills, Research, plan
availability, usage windows, model lineup) change monthly, and the course was written against June 2026. Plausible
AI-drafted claims about plans and defaults are the likeliest error. Covered by SC-9 against today's cached text,
by the drift list (C-1), and by the human review rungs after hand-off. Items avoid plan-by-plan availability claims
unless the cited page states them.

Re-run state (skill rule, MF-0029/0034): this ticket writes no code that deletes. (a) No ids or manifests on disk
are written; `dev:seed`'s manifest is MF-0034's and bound to the author email. (b) Review verdicts are keyed by
content hash; an edited item resets its approvals by design (ADR 0001). (c) `db:sync-keys` validates every pack
before writing, so an invalid new pack fails before any change. No regression test is owed.

### Concerns

- **C-1 (resolved by the user: docs win) course vs current docs drift.** Found at intake: (a) the Help Center now describes a *new
  version of Projects* rolling out ("a project is one conversation … every thread starts with the project's
  files, repositories, instructions, and memory"), while the course says conversations in a Project don't share
  context; (b) the model lineup has a tier above Opus (the course itself notes this and pins the three-tier frame
  for the certification). Proposed default: **items state only what today's cited page says**; where course and
  docs disagree, no item tests the disputed point, and the drift goes in the guide's drift list.
- **C-2 (resolved: approved) `pnpm dev:seed` at TEST** replaces the local demo world (all packs' demo groups and seeded
  answers). MF-0037 has the same approval; run once, after MF-0037's run if both are pending.
- **C-3 (owner: user, not blocking) overlap with MF-0037** (`ai-capabilities` D2.S2 knowledge / D2.S3 working
  memory). Here D1.S1 and D5.S1 take the *product* angle (what to do in claude.ai), not the model-theory angle;
  question stems must not duplicate MF-0037's.
- C-4 (owner: agent): branch `feat/MF-0016` is shared; MF-0038's files are disjoint and listed separately.
- C-5 (owner: agent): full-suite baseline may be red from other sessions' uncommitted work; attributed, not fixed.

## Out of Scope (decided)

- Copying course text, quiz, exercise or scenarios. A chart item type. A guided-lesson screen. Showing or filtering
  by `level` in the UI. Paid generation runs (MF-0022). The MF-0033 grounding gate.
- Modules 2–8 of the Associate path (each is its own ticket when its page is saved).

## Iteration Log

- 2026-11-04 intake + design draft; course outline read from the saved page; sources probed (all 200); C-1 drift
  found. Waiting on the checkpoint.
- 2026-11-04 checkpoint: user approved SCs + recommended options for C-1, expert angle, dev:seed.
- 2026-11-04 iteration 0: 3 drafting agents + 3 fresh verifiers (8 FIX resolved, keys unchanged); D1.S1.q4 replaced to cover variation (new source increase-consistency); sync ×2 idempotent; dev:seed run once; receipt DONE (SC-12 partial). Hand-off.
