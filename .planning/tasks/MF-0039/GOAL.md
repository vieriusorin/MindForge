---
ticket_id: MF-0039
tier: normal                      # new pack files only; no migration, no schema change (level exists since MF-0031)
stage: handoff
branch: feat/MF-0016              # current worktree branch (shared with other live sessions); move to feat/MF-0039 before commit
builds_on: [MF-0003, MF-0006, MF-0008, MF-0014, MF-0031, MF-0034, MF-0036, MF-0037, MF-0038]
last_iteration: 0
goal_status: complete-pending-manual-commit
---

> Claimed 2026-11-04 (`/gsd-goal-loop`, brief: add the course "Introduction to agent skills" as a database seed,
> interpreted so every developer can learn it, juniors to seniors: questions, cards, examples, visuals, charts,
> React Flow diagrams that connect the concepts, plus a plan to validate it and use it as a tutorial).

## Objective

**Today.** The team is taking *Introduction to agent skills* (Anthropic Academy on Skilljar, Claude Developer path,
behind a login). The user saved its first lesson (`~/Downloads/What are skills_.html`). MindForge has no pack for it.

**End state.** A new real pack, `kind: course`, slug `agent-skills`, under `packs/agent-skills/`:
1. A blueprint (`pack.yaml`) that follows the course's lesson order from the saved page's sidebar: what skills are →
   creating your first skill → configuration and multi-file skills → skills vs other Claude Code features →
   sharing skills → troubleshooting skills. Every skill lists the public pages it is grounded in.
2. Seed items per skill, each with a `level`:
   - `foundation` (junior): what a skill is, where it lives, when to write one;
   - `practitioner` (mid): write and place one for a scenario, pick the right frontmatter, spot the broken one;
   - `expert` (senior): progressive-disclosure and context-budget trade-offs, invocation control on side-effecting
     workflows, subagent execution, tool pre-approval and its security, team distribution, and the API / Agent
     Skills standard counterpart.
   Item kinds: scenario questions with a rationale on every option, a nature card (simply / in nature / where it
   breaks / contrast) that doubles as the worked example, and a React Flow diagram per skill. One **capstone
   diagram** follows a skill from disk to action (metadata → match → body → supporting files).
3. "Seed the database" = the pack files + `pnpm db:sync-keys` (keys, ADR 0001) + `pnpm dev:seed`, which since
   MF-0034 builds a demo group for every pack with questions.
4. A study-and-validation guide (`docs/plan/agent-skills-validation.md`): the study order for a junior, a mid and a
   senior, a hands-on exercise per level (write a real skill in a scratch repo), the proof ladder every item climbs
   before a learner trusts it, and the course-vs-docs drift list (C-1).

## Affected

- **Roles:** pack author (user), reviewers, analogy owner, learners.
- **Surfaces:** `packs/agent-skills/**` (new), `docs/plan/agent-skills-validation.md` (new),
  `src/engine/content/__tests__/mf-0039-agent-skills.acceptance.test.ts` (new), `.cache/corpus/` (local, not
  committed), the local DB via the existing sync + seed scripts. No `src/` production code, no migration.

## Constraints

- CONTEXT.md *Source* / MINDFORGE.md §1: course content behind a login is never a source; Skilljar is never scraped
  (`src/content-pipeline/corpus.ts` refuses skilljar hosts). The saved page shapes the **outline only** (lesson
  order, topic names). No course text, reflection prompt, example or quote enters the repo. Items cite public
  Anthropic pages only, each one of its skill's `sources`.
- MINDFORGE.md principle 3: analogies are labelled, say where they break, and cite.
- ADR 0001: items live in files; the DB holds keys and reviews. ADR 0003 / ui-design.md: diagrams are graphs drawn
  by `DiagramFigure` only.
- `origin: ai` on every item; `author: sorin.vieriu@ddroidd.com` (the person who ran the drafting).
- Local stack only. Other sessions are editing MF-0032/0034/0036/0037/0038 files in this worktree; this ticket
  touches none of them.

## Decided by the user (2026-11-04, design checkpoint)

- **C-1 → follow today's docs.** Items state only what the cited page says now; the course's skills-vs-slash-commands
  contrast is taught as "who invokes and when it loads", and the drift is listed in the guide.
- **C-2 → `pnpm dev:seed` approved once** at TEST, knowing it replaces the local demo world; after MF-0037/0038's
  runs if those are pending.
- **Checkpoint:** blueprint and SC-1…SC-14 approved; SCs frozen.

## Decided without a question (sources noted)

- **Source → outline + public docs** (user, MF-0037, 2026-11-04; applied in MF-0038). Applied unchanged.
- **Charts → diagrams now, chart item later** (user, MF-0037). The pack is charted by the existing per-pack forest
  charts (stage bars + donut); a chart item type stays a follow-up ticket (schema + renderer).
- **Volume → starter set** (user, MF-0037): per skill 1 card, 1 diagram, 6 questions (2 per level), plus the
  capstone diagram. The MF-0022 pipeline tops skills up to the Covered-skill bar (15) later.
- **Tutorial → ordered pack + guide doc** (user, MF-0037): no new screen; a guided-lesson mode is a follow-up.
- Slug `agent-skills`, name "Introduction to Agent Skills", `kind: course`, no `exam:` block (MF-0031).
- Weights are MindForge's (the course gives none); they follow how much each lesson's public docs cover.
- Sources: every URL in the Blueprint answered HTTP 200 on 2026-11-04 (`curl -L`, final URL recorded; the
  engineering post redirects `/engineering/…` → `/research/…`, the final URL is used). `code.claude.com` and
  `platform.claude.com` serve `.md` text; `pnpm generate:corpus --pack agent-skills` caches them (no API key).
  `code.claude.com/docs/en/slash-commands` serves the skills page (commands were merged into skills), so it is
  not listed separately.
- MF-0031 retro lessons in the drafting brief: every backticked token and absolute quantifier (`never`, `always`,
  `only`, `all`) must occur in the cited page; each diagram lists every branch the cited page documents.
- `pnpm check:packs` (MF-0036, `testing.md` "Before hand-off") runs at TEST; it covers cuckoos, and this pack
  ships none, so it must simply stay green.
- Baseline preflight 2026-11-04 ~16:50: `pnpm typecheck` 0, `pnpm lint` 0 (a first run of each exited 2 while
  another session was mid-edit; the re-run was clean), `pnpm test` 1: 4 files / 16 tests red, all other sessions'
  frozen acceptance reds (`mf-0032-answer-hash.acceptance.test.{ts,tsx}`, `mf-0032-changed-message.acceptance.test.ts`,
  `mf-0037-ai-capabilities.acceptance.test.ts`). None is in MF-0039's scope; SC-14 attributes them against this
  baseline. No proof here needs `db:reset` / `supabase stop|start`; only `dev:seed` (C-2) touches shared state.
- Browser proof is "browser check, or HTTP render if the shared browser is held" (memory
  `feedback-browser-verification`).

## Blueprint

| Domain (course lesson) | W | Skill | W | Sources |
|---|---|---|---|---|
| D1 What skills are | 12 | D1.S1 What a skill is, where it lives, when to write one | 12 | cc-skills, api-overview, eng-post |
| D2 Creating your first skill | 22 | D2.S1 Anatomy of `SKILL.md`: frontmatter, description, instructions | 11 | cc-skills, best-practices, spec |
| | | D2.S2 Discovery and loading: metadata → match → body → files | 11 | cc-skills, api-overview, eng-post |
| D3 Configuration and multi-file skills | 22 | D3.S1 Frontmatter controls: invocation, tools, arguments, subagent | 11 | cc-skills |
| | | D3.S2 Multi-file skills: supporting files, scripts, progressive disclosure | 11 | cc-skills, best-practices, api-overview |
| D4 Skills vs other Claude Code features | 16 | D4.S1 Choosing: CLAUDE.md, skills, subagents, hooks, MCP | 16 | cc-skills, cc-memory, cc-sub-agents, cc-hooks, cc-mcp |
| D5 Sharing skills | 10 | D5.S1 Scopes and distribution: project, plugin, managed; trusting others' skills | 10 | cc-skills, cc-plugins, api-overview |
| D6 Troubleshooting skills | 18 | D6.S1 Not triggering, over-triggering, ignored, truncated | 9 | cc-skills, best-practices |
| | | D6.S2 Evaluate and iterate: evals, conciseness, degrees of freedom | 9 | best-practices, cc-skills |

URLs (final): `code.claude.com/docs/en/{skills, memory, sub-agents, hooks-guide, mcp, plugins}`,
`platform.claude.com/docs/en/agents-and-tools/agent-skills/{overview, best-practices}`,
`www.anthropic.com/research/equipping-agents-for-the-real-world-with-agent-skills`, `agentskills.io/specification`.

## Success Criteria (frozen 2026-11-04)

- [x] SC-1: `packs/agent-skills/pack.yaml` loads via `loadPackFile`: slug `agent-skills`, `kind: course`, no `exam`,
  the 6 domains and 9 skills of the Blueprint with those codes and weights (sum 100), every skill ≥ 1 https source.
  Proof: frozen acceptance test.
- [x] SC-2: the pack's content loads through `loadPackContent` with no issue, and every question `source.url` and
  every card/diagram source is one of its skill's `sources` (CONTEXT.md *Citation*). Proof: frozen acceptance test.
- [x] SC-3: every skill has ≥ 6 questions with ≥ 2 at each level, ≥ 1 card and ≥ 1 diagram; every card links a
  diagram of the same skill; every item is `origin: ai`, has the author above, a `level`, and an id prefixed
  `agent-skills.<skill>.`. Proof: frozen acceptance test.
- [x] SC-4: ≥ 54 questions; each has options A–D, `select: 1`, distinct option texts; no key letter is the answer to
  more than 40% of the pack's questions. Proof: frozen acceptance test.
- [x] SC-5: every diagram has ≥ 4 nodes and every node is on at least one edge. Proof: frozen acceptance test.
- [x] SC-6: a capstone diagram in D2.S2 has a node for each loading stage (labels contain "description",
  "match", "SKILL.md", "supporting"), connected in that order by edges, and a branch for "no match" (the body never
  loads). Proof: frozen acceptance test.
- [x] SC-7: D4.S1's diagram has a node for each of CLAUDE.md, skill, subagent, hook and MCP. Proof: frozen
  acceptance test.
- [x] SC-8: no item reproduces course text: no run of ≥ 12 consecutive words from the saved lesson page appears in any
  pack file. Proof: scratch check in TEST, output pasted in evidence (the page is not committed, so not frozen).
- [x] SC-9: an independent fresh-context verifier checks every item against the cached text of the source it cites
  (key, every rationale, every analogy break, backticked tokens, absolute quantifiers, frontmatter field names and
  paths, diagram branches); each finding is fixed or answered. Proof: reports in `.planning/tasks/MF-0039/verify/`,
  summary in `.planning/evidence/MF-0039.md`.
- [x] SC-10: `pnpm db:sync-keys` on the local stack registers `agent-skills` and its question keys (count = the pack's
  questions); a second run changes nothing. Proof: DB read-back pasted in evidence.
- [x] SC-11: `pnpm dev:seed --pack agent-skills` creates the pack's demo group with attempts on the local stack.
  Proof: DB read-back. Not run if the other session's MF-0034 seed work is red at TEST; then unverified.
- [x] SC-12: on :3001 a learner in a group on the new pack sees its items in the review queue and a diagram renders.
  Proof: browser check, or HTTP render if the shared browser is held (drawing then marked unverified).
- [x] SC-13: `docs/plan/agent-skills-validation.md` gives the study order per level, one hands-on exercise per level,
  the per-item proof ladder (loader + acceptance → grounding notes → verifier → 2 approvals + analogy owner → flags)
  with who signs each rung, the course-vs-docs drift list (C-1), and the follow-ups. Proof: the file.
- [x] SC-14: `pnpm typecheck && pnpm lint && pnpm test && pnpm check:packs && pnpm build` exit 0, reds in other
  sessions' files attributed against the baseline. Proof: receipt in LOOP-VERIFY.md.

### Constraints → how met

- Login content never a source → SC-2 restricts citations; SC-8 proves no course text was copied; SC-9 checks claims
  against the cached public text.
- Analogies labelled + broken → card schema requires `whereItBreaks`; SC-9 checks each break.
- ADR 0001 → no table; SC-10 uses the existing sync, SC-11 the existing seed.
- Diagrams via `DiagramFigure` only → SC-12 renders through the existing review UI.

### Riskiest step

Content correctness on a **fast-moving tool**: Claude Code's skills page changes often (commands merged into skills,
new frontmatter fields, synced claude.ai skills, reserved names). AI-drafted items are most likely wrong on exact
field names, paths, defaults and "which loads when". Covered by SC-9 against today's cached text, the drift list
(C-1), and the human review rungs after hand-off. Items avoid version-specific limits unless the cited page states them.

Re-run state (skill rule, MF-0029/0034): this ticket writes no code that deletes. (a) No ids or manifests on disk are
written; `dev:seed`'s manifest is MF-0034's and bound to the author email. (b) Review verdicts are keyed by content
hash; an edited item resets its approvals by design (ADR 0001). (c) `db:sync-keys` validates every pack before
writing, so an invalid new pack fails before any change. No regression test is owed.

### Concerns

- **C-1 (owner: user) course vs current docs drift.** Found at intake: the saved lesson contrasts skills with slash
  commands ("you type a slash command; a skill activates on its own"). Today's Claude Code docs say **custom commands
  have been merged into skills**: every skill can also be typed as `/skill-name`, and `disable-model-invocation` /
  `user-invocable` decide who may invoke it. Proposed default: **items state only what today's cited page says**; the
  old three-way contrast is taught as "who invokes and when it loads" (CLAUDE.md always loaded; skill description
  always, body on demand; `disable-model-invocation` = only you), and the drift goes in the guide.
- **C-2 (owner: user) `pnpm dev:seed` at TEST** replaces the local demo world (all packs' demo groups and seeded
  answers). Same approval as MF-0037/0038; run once, after theirs if pending.
- **C-3 (owner: user, not blocking) overlap with MF-0038** (`platform-foundations` D3.S1 Skills, claude.ai angle).
  Here every skill takes the Claude Code / developer angle; question stems must not duplicate MF-0038's.
- C-4 (owner: agent): branch `feat/MF-0016` is shared; MF-0039's files are disjoint and listed separately.
- C-5 (owner: agent): full-suite baseline is red from other sessions' uncommitted work; attributed, not fixed.

## Out of Scope (decided)

- Copying course text, reflection prompts, examples or scenarios. A chart item type. A guided-lesson screen. Showing
  or filtering by `level` in the UI. Paid generation runs (MF-0022). Shipping real skills into `.claude/skills/` of
  this repo.

## Iteration Log

- 2026-11-04 intake + design draft; outline read from the saved lesson (sidebar lists 7 lessons); sources probed
  (all 200); C-1 drift found.
- 2026-11-04 checkpoint: C-1 follow docs, dev:seed approved once, SCs approved and frozen.
- 2026-11-04 build + test (iteration 0): 3 drafters (by domain) → 3 fresh-context verifiers (0 wrong, 1 unsupported,
  12 misleading, all fixed). sync-keys ×2 idempotent; dev:seed with no --pack refused before any delete on another
  session's pack, so it was run once with `--pack agent-skills --pack ccdv-f --pack ai-capabilities`. HTTP render as a
  learner (shared browser held). Receipt DONE for MF-0039's files; the tree's reds are MF-0038/0040/0042's.
  Note: the checkpoint question said "10 diagrams incl. a capstone"; the capstone IS D2.S2's diagram, so the pack
  has 9 diagrams (SC-3/SC-6 are met as written).
