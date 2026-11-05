---
ticket_id: MF-0040
tier: normal                      # new pack files only; no migration, no schema change (level exists since MF-0031)
stage: handoff
branch: feat/MF-0016              # shared worktree branch (other live sessions); move to feat/MF-0040 before commit
builds_on: [MF-0003, MF-0006, MF-0008, MF-0014, MF-0031, MF-0034, MF-0037, MF-0038]
last_iteration: 0
goal_status: complete-pending-manual-commit
---

> Claimed 2026-11-04 (`/gsd-goal-loop`, brief: add the course "Introduction to subagents" as a database seed,
> interpreted so every developer can learn it, juniors to seniors: questions, cards, examples, visuals, charts,
> React Flow diagrams that connect the concepts, plus a plan to validate it and use it as a tutorial).
> MF-0039 was an empty folder claimed by another session at 16:41; this ticket took the next free number.

## Objective

**Today.** The team is taking *Introduction to subagents* (Anthropic Academy, Claude Code; saved locally as
`~/Downloads/Introduction to subagents.html`, behind a Skilljar login). MindForge has no pack for it, and nothing
in the existing packs teaches Claude Code subagents.

**End state.** A new real pack, `kind: course`, slug `subagents`, under `packs/subagents/`:
1. A blueprint (`pack.yaml`) that follows the course's four lessons: what subagents are → creating one →
   designing effective ones → using them effectively. Every skill lists the public pages it is grounded in.
2. Seed items per skill, each with a `level`:
   - `foundation` (junior): what a subagent is, what it sees, what comes back, how to make one with `/agents`;
   - `practitioner` (mid): pick the configuration for a scenario (tools, model, scope, description), spot the
     wrong one, read a subagent file;
   - `expert` (senior / architect): trade-offs and failure modes, cost and parallelism, the **programmatic
     counterpart** (Agent SDK `agents`) and the multi-agent architecture behind it.
   Item kinds: scenario questions with a rationale on every option, a nature card (simply / in nature / where it
   breaks / contrast) that is the worked example, and a React Flow diagram per skill. One **capstone diagram**
   connects the delegation loop (main conversation → description match → subagent in its own context → summary
   back to the main conversation).
3. "Seed the database" = the pack files + `pnpm db:sync-keys` (keys, ADR 0001) + `pnpm dev:seed`, which since
   MF-0034 builds a demo group for every pack with questions.
4. A study-and-validation guide (`docs/plan/subagents-validation.md`): the study order for a junior, a mid and a
   senior, the proof ladder every item climbs before a learner trusts it, and the course-vs-docs drift list.

## Affected

- **Roles:** pack author (user), reviewers, analogy owner, learners.
- **Surfaces:** `packs/subagents/**` (new), `docs/plan/subagents-validation.md` (new),
  `src/engine/content/__tests__/mf-0040-subagents.acceptance.test.ts` (new), `.cache/corpus/` (local, not
  committed), the local DB via the existing sync + seed scripts. No `src/` production code, no migration.

## Constraints

- CONTEXT.md *Source* / MINDFORGE.md §1: course content behind a login is never a source; Skilljar is never
  scraped (`src/content-pipeline/corpus.ts` refuses skilljar hosts). The saved page shapes the **outline only**
  (the four lesson titles and the "you'll learn" topics). No course text, video, quiz or quote enters the repo.
  Items cite public pages only, each one of its skill's `sources`.
- MINDFORGE.md principle 3: analogies are labelled, say where they break, and cite.
- ADR 0001: items live in files; the DB holds keys and reviews. ADR 0003 / ui-design.md: diagrams are graphs
  drawn by `DiagramFigure` only.
- `origin: ai` on every item; `author: sorin.vieriu@ddroidd.com` (the person who ran the drafting).
- Local stack only. Other sessions are editing MF-0032/0034/0036/0037/0038 files in this worktree; this ticket
  touches none of them.
- testing.md: `pnpm check:packs` runs when `packs/**` changes (MF-0036, cuckoo grounding). This pack ships no
  cuckoos, so it must pass trivially.

## Decided by the user (2026-11-04, design checkpoint)

- **C-3 charts → diagrams now.** 8 React Flow diagrams + capstone; the existing forest charts chart the pack; a
  chart item type is a follow-up ticket.
- **C-1 drift → docs win.** "Obstacle reporting" is taught only through grounded pieces (objective, output format,
  boundaries; `maxTurns` partial output); the gap goes in the guide's drift list.
- **C-2 `pnpm dev:seed` at TEST → approved**, run once, after MF-0037/0038's runs if pending.
- **C-4 baseline red → park**, attributed in SC-14, not fixed.
- **Checkpoint:** blueprint and SC-1…SC-14 approved; SCs frozen.

## Decided without a question (sources noted)

- **Source → outline + public docs.** Same request shape as MF-0037/MF-0038; the user chose this for both today.
- **Charts → diagrams now, chart item later** (user, MF-0037, 2026-11-04). The pack is charted by the existing
  per-pack forest charts (growth donut, stage bars); a chart item type stays a follow-up ticket (schema + renderer).
  *Re-raised at the checkpoint because this brief says "visuals charts" again.*
- **Volume → starter set** (MF-0037/0038): per skill 1 card, 1 diagram, 6 questions (2 per level), plus the
  capstone diagram. The MF-0022 pipeline tops skills up to the Covered-skill bar later.
- **Tutorial → ordered pack + guide doc** (MF-0037/0038): no new screen; a guided-lesson mode is a follow-up.
- **Expert angle → programmatic + architecture counterpart** (mirrors MF-0038's user decision "expert = API
  counterpart"): every skill lists the Agent SDK subagents page or an Anthropic engineering post, and SC-7 holds.
- Slug `subagents`, name "Introduction to Subagents", `kind: course`, no `exam:` block (MF-0031 precedent).
- Weights are MindForge's (the course gives none). The four lessons weigh about the same; "Designing effective
  subagents" carries a little more because two of the course's four "you'll learn" topics are design patterns.
- Sources: every URL in the Blueprint answered HTTP 200 on 2026-11-04 (`curl -L`, final URL after redirects:
  `platform.claude.com/docs/en/agent-sdk/subagents` → `code.claude.com/…`, `anthropic.com/engineering/*` →
  `anthropic.com/research/*`). code.claude.com pages are server-rendered (sub-agents: 450 kB of text), so
  `pnpm generate:corpus --pack subagents` can cache them (no API key, MF-0008).
- MF-0031 retro lessons in the drafting brief: every backticked token and absolute quantifier (`never`, `always`,
  `only`, `all`) must occur in the cited page; each diagram lists every branch the cited page documents.
- Baseline preflight 2026-11-04 16:44: `pnpm typecheck` 2 (3 errors in `src/app/(app)/play/**` from MF-0032's
  in-flight `toPlayableQuestion(question, contentHash)` change), `pnpm lint` 1 (format in MF-0032's
  `src/engine/content/check-question-answer.ts`), `pnpm test` 1 (4 files / 10 tests: MF-0037 and MF-0038 frozen
  acceptance reds, `seed-checks.test.tsx` SC-4 and `walk-session.test.tsx` SC-5 from MF-0032's work). None is in
  this ticket's files; SC-13 attributes them against this baseline. Proposed: **park, not fix** (they are live
  work in other sessions; editing them would collide).
- Destructive proof commands: none needs `db:reset` / `supabase stop|start`. Only `pnpm dev:seed` touches shared
  local state (C-2).
- Browser proof is "browser check, or HTTP render if the shared browser is held" (memory
  `feedback-browser-verification`).

## Blueprint

| Domain (course lesson) | W | Skill | W | Sources |
|---|---|---|---|---|
| D1 What are subagents? | 24 | D1.S1 Own context window, summary back | 12 | sub-agents, context-window, effective-context-engineering |
| | | D1.S2 Built-in subagents and automatic delegation | 12 | sub-agents, agents (overview), agent-sdk/subagents |
| D2 Creating a subagent | 24 | D2.S1 `/agents`, scopes and subagent files | 12 | sub-agents, agent-sdk/subagents |
| | | D2.S2 Model, effort, skills, memory and isolation | 12 | sub-agents, costs, worktrees, agent-sdk/subagents |
| D3 Designing effective subagents | 28 | D3.S1 The brief and the return contract: objective, output format, boundaries, finishing | 14 | sub-agents, multi-agent-research-system, effective-context-engineering |
| | | D3.S2 Least-privilege tools, permission modes and hooks | 14 | sub-agents, permissions, hooks, agent-sdk/subagents |
| D4 Using subagents effectively | 24 | D4.S1 When delegation pays off: high-volume work, parallel research, chaining | 12 | sub-agents, costs, multi-agent-research-system |
| | | D4.S2 Anti-patterns and the alternatives: main conversation, skills, forks, agent teams | 12 | sub-agents, agent-teams, skills, building-effective-agents |

URLs (final): `code.claude.com/docs/en/{sub-agents, agents, context-window, costs, worktrees, permissions, hooks,`
`skills, agent-teams, agent-sdk/subagents}`; `www.anthropic.com/research/{effective-context-engineering-for-ai-agents,`
`multi-agent-research-system, building-effective-agents}`.

## Success Criteria (approved by the user 2026-11-04; frozen)

- [x] SC-1: `packs/subagents/pack.yaml` loads via `loadPackFile`: slug `subagents`, `kind: course`, no `exam`, the
  4 domains and 8 skills of the Blueprint with those codes and weights (sum 100), every skill ≥ 1 https source.
  Proof: frozen acceptance test.
- [x] SC-2: the pack's content loads through `loadPackContent` with no issue, and every question `source.url` and
  every card/diagram source is one of its skill's `sources` (CONTEXT.md *Citation*). Proof: frozen acceptance test.
- [x] SC-3: every skill has ≥ 6 questions with ≥ 2 at each level, ≥ 1 card and ≥ 1 diagram; every card links a
  diagram of the same skill; every item is `origin: ai`, has the author above, a `level`, and an id prefixed
  `subagents.<skill>.`. Proof: frozen acceptance test.
- [x] SC-4: ≥ 48 questions; each has options A–D, `select: 1`, distinct option texts; no key letter is the answer
  to more than 40% of the pack's questions. Proof: frozen acceptance test.
- [x] SC-5: every diagram has ≥ 4 nodes and every node is on at least one edge. Proof: frozen acceptance test.
- [x] SC-6: a capstone diagram (in D1.S1) has nodes whose labels contain "main conversation", "description",
  "own context" and "summary", connected in that order by edges, plus an edge from the "summary" node back to the
  "main conversation" node. Proof: frozen acceptance test.
- [x] SC-7: every skill has ≥ 1 expert question whose source is `code.claude.com/docs/en/agent-sdk/subagents` or a
  `www.anthropic.com/research/` page (the senior angle). Proof: frozen acceptance test.
- [x] SC-8: no item reproduces course text: no run of ≥ 12 consecutive words from the saved course page appears in
  any pack file. Proof: scratch check in TEST, output pasted in evidence (the page is not committed, so not frozen).
- [x] SC-9: an independent fresh-context verifier checks every item against the cached text of the source it cites
  (key, every rationale, every analogy break, backticked tokens, absolute quantifiers, frontmatter field names,
  diagram branches); each finding is fixed or answered. Proof: reports in `.planning/tasks/MF-0040/verify/`,
  summary in `.planning/evidence/MF-0040.md`.
- [x] SC-10: `pnpm db:sync-keys` on the local stack registers `subagents` and its question keys (count = the pack's
  questions); a second run changes nothing. Proof: DB read-back pasted in evidence.
- [x] SC-11: `pnpm dev:seed` creates the pack's demo group with attempts on the local stack. Proof: DB read-back.
  Not run if MF-0034's seed work is red at TEST; then unverified.
- [~] SC-12 (partial: HTTP render, drawing unverified): on :3001 a learner in a group on the new pack sees its items in the review queue and a diagram
  renders. Proof: browser check, or HTTP render if the shared browser is held (drawing then marked unverified).
- [x] SC-13: `docs/plan/subagents-validation.md` gives the study order per level, the per-item proof ladder
  (loader + acceptance → grounding notes → verifier → 2 approvals + analogy owner → flags) with who signs each
  rung, the course-vs-docs drift list (C-1), and the follow-ups. Proof: the file.
- [x] SC-14: `pnpm typecheck && pnpm lint && pnpm test && pnpm check:packs && pnpm build`: no failure that is not
  in the baseline above; reds in other sessions' files attributed. Proof: receipt in LOOP-VERIFY.md.

### Constraints → how met

- Login content never a source → SC-2 restricts citations; SC-8 proves no course text was copied; SC-9 checks
  claims against the cached public text.
- Analogies labelled + broken → card schema requires `whereItBreaks`; SC-9 checks each break.
- ADR 0001 → no table; SC-10 uses the existing sync, SC-11 the existing seed.
- Diagrams via `DiagramFigure` only → SC-12 renders through the existing review UI.

### Riskiest step

Content correctness on a **fast-moving reference page**. `sub-agents` documents version-gated behaviour
("requires Claude Code v2.1.x or later"), defaults that differ by provider (Explore's model on Bedrock/Vertex),
and 16 frontmatter fields where an unknown name is ignored silently. AI-drafted items are likeliest to be wrong on
exact field names, defaults and version-specific behaviour. Mitigation: items avoid version numbers and
provider-specific defaults; SC-9 checks every field name and default against the cached page; the drift list
records course claims the docs no longer make.

Re-run state (skill rule, MF-0029/0034): this ticket writes no code that deletes. (a) No ids or manifests on disk;
`dev:seed`'s manifest is MF-0034's, bound to the author email. (b) Review verdicts are keyed by content hash; an
edited item resets its approvals by design (ADR 0001). (c) `db:sync-keys` validates every pack before writing, so
an invalid new pack fails before any change. No regression test is owed.

### Concerns

- **C-1 (resolved: docs win) course vs docs drift.** Found at intake: the course names "obstacle reporting" as a design
  pattern; no public page uses that term. The nearest public grounding is the multi-agent research post (each
  subagent needs "an objective, an output format, guidance on the tools and sources to use, and clear task
  boundaries") and `maxTurns` returning output "marked as partial". Proposed default: **docs win**: teach the
  pattern only through those grounded pieces, never as a quoted course term; list the gap in the guide.
- **C-2 (resolved: approved) `pnpm dev:seed` at TEST** replaces the local demo world (all packs' demo groups and seeded
  answers). Same approval shape as MF-0037/0038; run once, after theirs if pending.
- **C-3 (resolved: diagrams now) charts.** Your brief asks for "visuals charts". Default: as decided for MF-0037, React Flow
  diagrams + the existing forest charts now, a chart item type as a follow-up ticket. Say so if you want the chart
  item type in this ticket instead; that makes it high-risk (schema + renderer).
- **C-4 (resolved: park) baseline red** (typecheck/lint/test, all MF-0032/0037/0038 in-flight work). Default: park,
  attribute in SC-14, do not fix here.
- C-5 (owner: agent): overlap with MF-0037 D2.S3 (context window): here the angle is Claude Code delegation, not
  model theory; question stems must not duplicate MF-0037's.
- C-6 (owner: agent): branch `feat/MF-0016` is shared; MF-0040's files are disjoint and listed separately.

## Out of Scope (decided)

- Copying course text, video transcript or quiz. A chart item type (C-3). A guided-lesson screen. Showing or
  filtering by `level` in the UI. Paid generation runs (MF-0022). The MF-0033 grounding gate. Cuckoo items.

## Iteration Log

- 2026-11-04 intake + design draft; course outline read from the saved page (4 lessons); 13 sources probed (all
  200); C-1 drift found; baseline red attributed. Waiting on the checkpoint.
- 2026-11-04 checkpoint: user approved SCs + recommended options for C-1…C-4.
- 2026-11-04 build: 4 drafting forks (one per domain), 2 fresh-context verifiers (28 FIX / 65, 0 wrong keys, all
  applied), drift found: `/agents` no longer creates subagents. Test: receipt DONE (LOOP-VERIFY), SC-12 partial.
  Found `listPacks()` days-long cache hides a new pack from a running dev server (follow-up in the guide).
