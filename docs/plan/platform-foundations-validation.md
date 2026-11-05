# Studying and validating the `platform-foundations` pack (MF-0038)

*Claude Platform & Model Foundations* (`packs/platform-foundations/`) is a course pack: 5 domains, 9 skills, and
per skill 6 questions, 1 nature card and 1 diagram, plus a capstone diagram that joins the module's four decisions.
Every item starts as `origin: ai`. This page has two parts. **Study** is how a junior, a mid-level and a senior
developer work through the pack. **Validate** is the proof ladder an item climbs before a learner should trust it,
and who signs each rung.

Rule zero: the course (Anthropic Academy, Claude Associate path, Module 1) is behind a login, so it is **never a
source** (CONTEXT.md *Source*). Its lesson order shaped the domains; every item cites one of its skill's public
`sources` in `pack.yaml` (Claude Help Center or Claude Platform docs), and every claim must be checkable against
that page. No course text, quiz or scenario is in the repo (MF-0038 SC-8 checks for 12-word overlaps).

## The map: four decisions before the first prompt

| Order | Decision | Skills | Platform (API) counterpart taught at `expert` level |
|---|---|---|---|
| 0 | Know how Claude behaves | D1.S1 | model cutoffs in the models overview; web search to reach past them |
| 1 | Entry point | D2.S1, D2.S2 | system prompts (standing instructions), the web search tool |
| 2 | Capability layer | D3.S1, D3.S2, D3.S3 | Agent Skills, the code execution tool, the memory tool |
| 3 | Model | D4.S1 | model choice and per-token pricing |
| 4 | Context strategy | D5.S1, D5.S2 | context windows and compaction, API rate limits |

The capstone diagram (`platform-foundations.D2.S1.diagram-four-decisions`) draws this chain, including the loop
back when a session's context degrades. Start there.

## Study

Every item carries a `level`:

| Level | Reader | The item asks |
|---|---|---|
| `foundation` | junior, or new to Claude | What is this feature? When do I reach for it? |
| `practitioner` | mid-level, uses Claude daily on a team | Given this scenario, which configuration fits, and which is wrong? |
| `expert` | senior, or a developer building on the API | What is the trade-off or failure mode, and what is the API counterpart? |

**Junior path (about 45 min).** Capstone diagram → for D1.S1, D2.S1, D3.S2, D4.S1, D5.S1 in that order: the nature
card, then the skill's diagram, then its two `foundation` questions. Then the rest of the skills the same way.

**Mid-level path (about 40 min).** Capstone diagram → every skill's diagram → all `practitioner` questions, domain by
domain. Re-read a card only for a skill where a question was missed.

**Senior / developer path (about 30 min).** All `expert` questions first, cold. For each miss, read the card's
"where it breaks" lines and the platform source the question cites. Seniors are the right reviewers for rung 5.

**As a group.** Put the group on the pack, split skills by level in the review queue, and use a Duel on one domain
at a time. The forest charts per pack show which skills the group has grown. The UI does not filter by `level` yet
(follow-up).

## Validate: the proof ladder

| # | Rung | What it proves | How | Signed by |
|---|---|---|---|---|
| 1 | Schema + loader | Well formed: ids, 4 options, one key, a rationale on every option, "where it breaks" on every card, a drawable graph | `loadPackContent`, run by `pnpm test` and again by `pnpm db:sync-keys` (refuses an invalid pack) | the toolchain |
| 2 | Pack contract | Citations are the skill's own sources; 6 questions per skill, 2 per level; key letters spread (≤ 40%); every diagram node connected; the capstone chain; ≥ 1 expert question per skill citing a platform page | `mf-0038-platform-foundations.acceptance.test.ts` (frozen) | the toolchain |
| 3 | Grounding notes | Each item names the passage that supports its key and rationales | `.planning/tasks/MF-0038/grounding/G<n>.md` | the drafter |
| 4 | Independent verifier | A reader who did not write the item checks key, every rationale, every analogy break, backticked tokens, absolute words and diagram branches against the cached page | fresh-context agent per group (MF-0038 SC-9), reports in `.planning/tasks/MF-0038/verify/` | the verifier; findings fixed before hand-off |
| 5 | Human review | Two reviewers who are not the author approve the exact content hash | in-app review queue (MF-0007); editing an item resets its approvals | 2 reviewers in a group on the pack |
| 6 | Analogy owner | The nature analogy teaches and its breaks are honest | review queue, cards only | the pack's analogy owner |
| 7 | Flags in play | Learners catch what reviewers missed | a flag hides the item until a maintainer fixes or dismisses it | content maintainers |
| 8 | Freshness | The product surface moved | re-run `pnpm generate:corpus --pack platform-foundations` monthly; a changed page means re-checking its items (rung 4) | content maintainers |

Rung 8 matters more here than for other packs: claude.ai features, plan availability and the model lineup change
month to month. Until rung 5, items are `unreviewed`: practice serves them with a badge.

### Review checklist (rung 5)

- **Question:** the key is right per the cited page *today* (open it). Each distractor is wrong for the reason its
  rationale gives, not merely worse. No claim about a plan, default or limit that the page doesn't state.
- **Nature card:** "simply" is correct without the analogy; every "where it breaks" names a real difference.
- **Diagram:** every arrow reads as a true sentence; decision branches are labelled and cover the page's cases.

## Course vs docs drift (MF-0038 C-1)

The course was written against claude.ai as of June 2026. Where today's public docs say something different, the
items follow the docs and **no question tests the disputed point**. Known on 2026-11-04:

| Topic | Course says | Docs say (2026-11-04) | In the pack |
|---|---|---|---|
| Projects | Chats in a Project share instructions and knowledge but not context with each other | A new version of projects is rolling out: a project is one conversation whose parallel threads each start with the project's files, instructions and memory | Items teach instructions + knowledge base; nothing tests whether chats share context |
| Model tiers | Three tiers, Haiku / Sonnet / Opus (the course notes a tier above Opus and pins three for the exam) | The models overview lists the current lineup, including a tier above Opus | No item calls Opus the top tier; tier items test fit for the task |
| Default / starting model | Sonnet is the right starting point for most work | The choosing-a-model page and models overview suggest starting most workloads with Opus 5.5; the pricing page's cost tips name Sonnet for most production workloads | No item tests which model to start with |

Some public pages also disagree **with each other**. No item tests these either:

| Topic | Page A | Page B |
|---|---|---|
| Who can use custom Skills | Help Center *What are Skills*: Free through Enterprise | Platform *Agent Skills overview*: Pro, Max, Ultra, Team, Enterprise |
| Admin-provisioned Skills | Help Center: Team/Enterprise owners can provision skills for everyone | Agent Skills overview: claude.ai custom skills cannot be centrally managed by admins |
| Code execution network default | *Create and edit files*, Availability list: disabled by default | Same page, configuration section: package managers only (default) |
| Memory behaviour | New memory experience (account + project memory toggles) | Same page: some Team/Enterprise orgs are still on the legacy experience, which works differently (D3.S3 q1, q3, q4 now say "on the current memory experience") |
| Memory by plan | *Usage limit best practices*: memory is a paid-plan feature | *Chat search and memory*: memory is on by default for Free |
| Skills on the API | Help Center: in beta | Agent Skills overview: stable |
| Default model | Choosing-a-model / models overview: start most workloads with Opus 5.5 | Pricing cost tips: Sonnet for most production workloads |
| Prefill | *Increase output consistency* lists prefill as a technique | Same page's note: prefill is not supported on Claude 4.6 and later (D1.S1 q4 does not use prefill) |

Recent product changes a reviewer should know about: artifacts made in a chat before 16 September 2026 are now
"legacy"; incognito chats in the new Claude experience cannot create files or run code; the new Claude experience
has no web search toggle.

### What the independent verifiers found (2026-11-04)

| Group | Skills | Items | OK | NOTE | FIX |
|---|---|---|---|---|---|
| G1 | D1.S1, D2.S1, D2.S2 | 25 | 16 | 7 | 2 |
| G2 | D3.S1, D3.S2, D3.S3 | 24 | 14 | 8 | 2 |
| G3 | D4.S1, D5.S1, D5.S2 | 24 | 12 | 6 | 4 |

All 8 FIX items were rewritten with the same key letter. FIX patterns, for the next pack: a distractor that a
careful reader could defend (D2.S2.q2, D3.S3.q3), a fact taken from a page other than the one cited (D3.S3.q5,
D5.S2.q5/q6 claude.ai framing on an API page), and diagram labels that merge or over-generalise branches
(D1.S1 CHECK node, D5.S1 compaction branches, D5.S2 "every 400 is a spend limit"). Remaining NOTEs are in
`.planning/tasks/MF-0038/verify/G*.md` for rung-5 reviewers.

Add a row whenever the verifier or a reviewer finds another one.

## Getting it into the app (local)

1. `pnpm generate:corpus --pack platform-foundations` caches the 22 sources (no API key).
2. `pnpm db:sync-keys` registers the pack and its 54 question keys (idempotent).
3. `MF_AUTHOR_EMAIL=<you> pnpm dev:seed` builds a demo group with attempts for every pack. With
   `--pack platform-foundations` only this pack gets a demo group: a run replaces the whole local demo world.
4. Open the review queue on :3001 and play.

## Follow-ups (not in MF-0038)

- A chart item type (schema + renderer) for "visual" items beyond diagrams.
- A guided-lesson screen that walks a learner through the study path above.
- Showing and filtering by `level` in the UI.
- Topping each skill up to the Covered-skill bar (15 approved questions) with the MF-0022 pipeline.
- Packs for Associate modules 2–8, one ticket each when the page is saved.
