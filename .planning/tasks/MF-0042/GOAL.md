---
ticket_id: MF-0042
tier: normal                      # new pack files only; no migration, no schema change (level exists since MF-0031)
stage: handoff
branch: feat/MF-0016              # shared worktree branch (other live sessions); move to feat/MF-0042 before commit
builds_on: [MF-0003, MF-0006, MF-0008, MF-0014, MF-0031, MF-0034, MF-0037, MF-0039, MF-0040]
last_iteration: 0
goal_status: complete-pending-manual-commit
---

> Claimed 2026-11-04 (`/gsd-goal-loop`, brief: add the course "Claude Code in Action" as a database seed,
> interpreted so every developer can learn it, juniors to seniors: questions, cards, examples, visuals, charts,
> React Flow diagrams that connect the concepts, plus a plan to validate it and use it as a tutorial).
> MF-0040 and MF-0041 were taken; MF-0042 was free on every branch and worktree.

## Objective

**Today.** The team is taking *Claude Code in Action* (`anthropic-partners.skilljar.com/claude-code-in-action`,
behind a login). The public landing page renders its outline client-side, so curl gets no lesson list, and no page
is saved in `~/Downloads`. MindForge has no pack for it.

**End state.** A new real pack, `kind: course`, slug `claude-code-in-action`, under `packs/claude-code-in-action/`:
1. A blueprint (`pack.yaml`) that follows the course's section order: what a coding assistant is → getting hands on
   (setup and context, making changes, controlling context, custom commands, MCP, GitHub) → hooks and the SDK →
   a capstone skill that puts one working session together. Every skill lists the public pages it is grounded in.
2. Seed items per skill, each with a `level` (foundation = junior, practitioner = mid, expert = senior): scenario
   questions with a rationale on every option, a nature card (simply / in nature / where it breaks / contrast) that
   works as the worked example, and a React Flow diagram that connects the concepts. One capstone diagram connects
   the whole working loop.
3. "Seed the database" = the pack files + `pnpm db:sync-keys` (keys, ADR 0001) + `pnpm dev:seed`, which since
   MF-0034 builds a demo group for every pack with questions.
4. A study-and-validation guide (`docs/plan/claude-code-in-action-validation.md`): the order a junior, a mid-level
   and a senior developer work through the pack, where the course has drifted from today's docs, and the proof
   ladder every item climbs before a learner trusts it.

## Affected

- **Roles:** pack author (user), reviewers, analogy owner, learners.
- **Surfaces:** `packs/claude-code-in-action/**` (new), `docs/plan/claude-code-in-action-validation.md` (new),
  `src/engine/content/__tests__/mf-0042-claude-code-in-action.acceptance.test.ts` (new), `.cache/corpus/` (local,
  not committed), the local DB via the existing sync + seed scripts. No `src/` production code, no migration.

## Constraints

- CONTEXT.md *Source* / MINDFORGE.md §1: course content behind a login is never a source and Skilljar is never
  scraped. Only the outline (section and lesson titles) shapes the blueprint. Items cite public pages only, and each
  citation is one of its skill's `sources`.
- Drift: where the course and today's docs disagree, items follow today's docs and the guide names the drift
  (MF-0039 precedent). Confirmed 2026-11-04 in the cached pages: `skills` says "Custom commands have been merged
  into skills" (`/docs/en/slash-commands` serves the skills page); `agent-sdk/overview` links a migration "from the
  Claude Code SDK packages to the Agent SDK".
- MINDFORGE.md principle 3: analogies are labelled, say where they break, and cite.
- ADR 0001: items live in files; the DB holds keys and reviews.
- ADR 0003 / ui-design.md: diagrams are graphs (direction, nodes, edges) drawn by `DiagramFigure` only.
- `origin: ai` on every item; `author: sorin.vieriu@ddroidd.com` (the person who ran the drafting).
- Local stack only. Other sessions are editing MF-0032/0036–0040 files in this worktree; this ticket touches none.

## Decided by the user (2026-11-04, checkpoint)

- **C-1 outline → use the drafted outline.** No page saved, so no SC-14.
- **C-3 charts → diagrams now, chart item later.** No reserved chart ticket.
- **C-2 `pnpm dev:seed` at TEST → approved, run once**, knowing it replaces the local demo world. SC-10's
  "not run if MF-0034 is red" clause still holds.
- **Checkpoint → blueprint and SC-1…SC-13 approved and frozen**; baseline reds in other sessions' files parked.

## Decided without a question (sources noted)

- **Source → outline + public docs.** Same request shape as MF-0037…MF-0040; the user chose this each time.
- **Charts → diagrams now, chart item later** (user, MF-0037). The pack is charted by the existing per-pack forest
  charts; a chart item type stays a follow-up ticket. *Re-raised at the checkpoint (C-3): the brief says "visuals
  charts" again, the fourth time today.*
- **Volume → starter set** (MF-0037…0040): per skill 1 card, 1 diagram, 6 questions (2 per level), plus the capstone
  diagram. The MF-0022 pipeline tops skills up to the Covered-skill bar later.
- **Tutorial → ordered pack + guide doc**: no new screen; a guided-lesson mode is a follow-up.
- **Expert angle → automation counterpart** (mirrors MF-0038/0040 "expert = programmatic counterpart"): every
  expert question in D2–D4 has a counterpart in settings, permissions, hooks, headless or the Agent SDK where one
  exists; SC-7 checks the D3 skills.
- Slug `claude-code-in-action`, name "Claude Code in Action", `kind: course`, no `exam:` block (MF-0031).
- Packs are independent: overlap with `ccdv-f` (Claude Code Operation, Claude Hooks) and `agent-skills` (skills) is
  allowed; items are not shared across packs (a pack is one curriculum, CONTEXT.md *Pack*).
- Weights are MindForge's (the course gives none). "Getting hands on" is the longest section (6 lessons with
  content), so it carries the most weight; the intro lesson is light.
- Sources: every URL in the Blueprint answered HTTP 200 on 2026-11-04 (`curl -L`, final URL). The engineering post
  `anthropic.com/engineering/claude-code-best-practices` redirects to `code.claude.com/docs/en/best-practices`, so
  that is the URL used. code.claude.com pages are server-rendered (228 kB–2.6 MB), so
  `pnpm generate:corpus --pack claude-code-in-action` can cache them (no API key, MF-0008).
- MF-0031 retro lessons in the drafting brief: every backticked token (command, flag, event name, file path) and
  absolute quantifier (`never`, `always`, `only`, `all`) must occur in the cited page; each diagram lists every
  branch the cited page documents. This matters more here than in any sibling: the pack is full of literal
  commands (`/compact`, `claude mcp add`, `PreToolUse`, exit code 2) that change between releases.
- Baseline preflight 2026-11-04: `pnpm typecheck` 0; `pnpm lint` 1 (format in MF-0032's
  `src/app/(app)/play/[packSlug]/walk/page.tsx` and `src/engine/content/check-question-answer.ts`); `pnpm test` 1
  (4 files / 14 tests: MF-0038 and MF-0039 frozen acceptance reds, `seed-checks.test.tsx` SC-4 and
  `walk-session.test.tsx` SC-5 from MF-0032). None is in this ticket's files. Proposed: **park, not fix**; SC-13
  attributes them against this baseline.
- Destructive proof commands: none needs `db:reset` / `supabase stop|start`. Only `pnpm dev:seed` touches shared
  local state (checkpoint question).
- Browser proof is "browser check, or HTTP render if the shared browser is held" (memory
  `feedback-browser-verification`).

## Blueprint

| Domain (course section) | W | Skill | W | Sources (code.claude.com/docs/en/…) |
|---|---|---|---|---|
| D1 What a coding assistant is | 8 | D1.S1 The agentic loop: gather context, act, verify, and why tools make it work | 8 | how-claude-code-works, overview |
| D2 Getting hands on | 54 | D2.S1 Setup and project context: install, `/init`, CLAUDE.md scopes, `@` mentions | 9 | setup, quickstart, memory |
| | | D2.S2 Making changes: screenshots, plan mode, thinking, permission modes | 9 | common-workflows, permissions, interactive-mode |
| | | D2.S3 Controlling context: interrupt, rewind, `/compact`, `/clear` | 9 | context-window, checkpointing, interactive-mode, costs |
| | | D2.S4 Custom commands, now skills: arguments, scopes, when to write one | 9 | skills, best-practices |
| | | D2.S5 MCP servers: adding a server, scopes, permissions, a browser server as the example | 9 | mcp, permissions |
| | | D2.S6 GitHub integration: the app, `@claude` mentions, PR review in Actions | 9 | github-actions, settings |
| D3 Hooks and the SDK | 27 | D3.S1 Hook anatomy: events, matchers, input on stdin, exit codes, where hooks live | 9 | hooks, hooks-guide, settings |
| | | D3.S2 Useful hooks and their gotchas: format, type-check feedback, protect files; paths, security, timeouts | 9 | hooks-guide, hooks |
| | | D3.S3 Headless mode and the Agent SDK (formerly the Claude Code SDK) | 9 | headless, agent-sdk/overview |
| D4 Putting it together | 11 | D4.S1 A working session end to end: explore → plan → code → verify → commit, and choosing CLAUDE.md vs skill vs hook vs MCP vs subagent | 11 | best-practices, common-workflows, sub-agents |

11 skills → ≥ 66 questions, 11 cards, 11 diagrams + the capstone requirement on D4.S1.

## Success Criteria

- [x] SC-1: `packs/claude-code-in-action/pack.yaml` loads via `loadPackFile`: slug `claude-code-in-action`,
  `kind: course`, no `exam`, the 4 domains and 11 skills of the Blueprint with those codes and weights (domains sum
  to 100; skills sum to their domain), every skill ≥ 1 https source. Proof: frozen acceptance test.
- [x] SC-2: the pack's content loads through `loadPackContent` with no issue, and every question `source.url` and
  every card/diagram source is one of its skill's `sources`. Proof: frozen acceptance test.
- [x] SC-3: every skill has ≥ 6 questions with ≥ 2 at each level, ≥ 1 card and ≥ 1 diagram; every card links a
  diagram of the same skill; every item is `origin: ai`, has the author above, a `level`, and an id prefixed
  `claude-code-in-action.<skill>.`. Proof: frozen acceptance test.
- [x] SC-4: ≥ 66 questions; each has options A–D, `select: 1`, distinct option texts; no key letter is the answer to
  more than 40% of the pack's questions. Proof: frozen acceptance test.
- [x] SC-5: every diagram has ≥ 4 nodes and every node is on at least one edge. Proof: frozen acceptance test.
- [x] SC-6: D4.S1 has a capstone diagram whose nodes include explore, plan, code (or implement), verify (or test)
  and commit, connected in that order by edges, with at least one edge back from verify to an earlier step (the fix
  loop). Proof: frozen acceptance test.
- [x] SC-7: D3.S1's diagram names `PreToolUse` and `PostToolUse` and a block outcome (a node label containing
  "exit code 2" or "block"); each of D3.S1, D3.S2, D3.S3 has ≥ 1 expert question. Proof: frozen acceptance test.
- [x] SC-8: an independent fresh-context verifier checks every item against the cached text of the source it cites
  (key, every rationale, every analogy break, backticked tokens and absolute quantifiers); each finding is fixed or
  answered. Proof: reports in `.planning/tasks/MF-0042/verify/`, summary in `.planning/evidence/MF-0042.md`.
- [x] SC-9: `pnpm db:sync-keys` on the local stack registers `claude-code-in-action` and its question keys (count =
  the pack's questions); a second run changes nothing. Proof: DB read-back pasted in evidence.
- [x] SC-10: `pnpm dev:seed --pack claude-code-in-action` creates the pack's demo group with attempts on the local
  stack. Proof: DB read-back. Not run if the other session's MF-0034 seed work is red at TEST; then unverified.
- [x] SC-11: on :3001 a learner in a group on the new pack sees its items in the review queue and a diagram renders.
  Proof: browser check, or HTTP render if the shared browser is held (drawing then marked unverified).
- [x] SC-12: `docs/plan/claude-code-in-action-validation.md` gives the study order per level (junior, mid, senior),
  the drift table (course term → today's term → cited page), the per-item proof ladder (loader + acceptance →
  grounding → verifier → 2 approvals + analogy owner → flags), who signs each rung, and the follow-ups. Proof: file.
- [x] SC-13: `pnpm typecheck && pnpm lint && pnpm test && pnpm build` exit 0, with reds attributed to the baseline
  above when they are in other sessions' files. Proof: receipt in LOOP-VERIFY.md.

No course text is copied, so the MF-0037 "no 12-word run from the saved page" check has nothing to run against
(no page saved). If the user saves a lesson page, that check is added as SC-14 (scratch, evidence only).

### Constraints → how met

- Login content never a source → SC-2 restricts citations to public `sources`; SC-8 checks claims against the
  cached public text.
- Drift → SC-8 checks every literal against today's page; SC-12 publishes the drift table.
- Analogies labelled + broken → card schema requires `whereItBreaks`; SC-8 checks each break.
- ADR 0001 → no table; SC-9 uses the existing sync; SC-10 the existing seed.
- Diagrams via `DiagramFigure` only → SC-11 renders through the existing review UI.

### Riskiest step

Literal correctness: ~66 AI-drafted items full of commands, flags, hook event names and file paths, where a
plausible but stale literal (an old flag, a removed shortcut, the SDK's old name) reads as true. Covered by the
backtick-token rule in the drafting brief and by SC-8.

Re-run state (skill rule, MF-0029/0034): this ticket writes no code that deletes. (a) No ids or manifests on disk
are written by this ticket; `dev:seed`'s manifest is MF-0034's and bound to the author email. (b) Review verdicts
are keyed by content hash; an edited item resets its approvals by design (ADR 0001). (c) `db:sync-keys` validates
every pack before writing (`validate-packs.mjs`), so an invalid new pack fails before any change. No regression
test is owed.

### Concerns

- C-1 (owner: user): no lesson page is saved and the public landing page renders its outline client-side. The
  blueprint's section order is from the course's public listing as known to the agent: Introduction (what is a
  coding assistant, Claude Code in action) → Getting hands on (setup, project setup, adding context, making
  changes, controlling context, custom commands, MCP servers, GitHub integration) → Hooks and the SDK (introducing,
  defining, implementing hooks, gotchas, useful hooks, the Claude Code SDK) → Wrapping up. Confirm, or save one
  lesson page so the sidebar can be checked.
- C-2 (owner: user): `pnpm dev:seed` replaces the local demo world (all packs' demo groups and seeded answers).
- C-3 (owner: user): "visuals charts" again. Keep diagrams-now/chart-later, or open the chart item ticket now.
- C-4 (owner: agent): branch `feat/MF-0016` is shared with live sessions; MF-0042's files are disjoint and listed
  separately in the hand-off.

## Out of Scope (decided)

- Copying course text, exercises, slides or the quiz. A chart item type (unless C-3 says otherwise, as its own
  ticket). A guided-lesson screen. Showing or filtering by `level` in the UI. Paid generation runs (MF-0022). The
  MF-0033 grounding gate.

## Iteration Log

- 2026-11-04 intake + design; checkpoint approved (all recommended options); dev:seed approved.
- 2026-11-04 build (4 drafting forks) → verify (2 verifiers, 32 FIX resolved) → TEST: receipt DONE, SC-11 PARTIAL (HTTP render; browser held). Hand-off.
