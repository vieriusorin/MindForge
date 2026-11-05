# Studying and validating the `subagents` pack (MF-0040)

The pack *Introduction to Subagents* (`packs/subagents/`) is a course pack: 4 domains, 8 skills, and per skill
6 questions, 1 nature card and 1 diagram, plus a capstone diagram of the delegation loop. Every item starts life
as `origin: ai`. This page covers two things: how developers at each level study the pack, and the proof ladder
an item climbs before a learner should trust it.

Rule zero: the course is behind a login, so it is **never a source** (CONTEXT.md *Source*). Its outline (the four
lesson titles and the topics it promises) shaped the blueprint and nothing more. Every item cites one of its
skill's public `sources` in `pack.yaml` (the Claude Code docs, the Agent SDK docs and three Anthropic engineering
posts), and every claim must be checkable against that page.

## The map

The pack follows the course's four lessons. D1 is the mental model, D2 the mechanics, D3 the design, D4 the
judgement.

| Domain | Skill | The question it answers for a developer |
|---|---|---|
| D1 What subagents are | D1.S1 Own context window, summary back | What does a subagent see, and what comes back to me? |
| | D1.S2 Built-in subagents and automatic delegation | Which subagents exist already, and how does Claude pick one? |
| D2 Creating a subagent | D2.S1 `/agents`, scopes and subagent files | How do I make one (ask Claude or write the file), where does it live, and which wins on a clash? |
| | D2.S2 Model, effort, skills, memory and isolation | Which knobs set its cost, quality, knowledge and blast radius? |
| D3 Designing effective subagents | D3.S1 The brief and the return contract | What must the task and the answer look like so it finishes and reports clearly? |
| | D3.S2 Least-privilege tools, permission modes and hooks | What is it allowed to do, and how do I enforce that? |
| D4 Using subagents effectively | D4.S1 When delegation pays off | Is this task worth a separate context, and what does it cost? |
| | D4.S2 Anti-patterns and the alternatives | Would the main conversation, a skill, a fork or an agent team be better? |

**Capstone (D1.S1):** the delegation loop. Main conversation → Claude matches the task to a subagent's
description → the subagent works in its own context window with its own tools → only a summary returns to the
main conversation. Every other diagram is a zoom into one arrow of this loop: D1.S2 and D3.S1 zoom into the match,
D2 and D3.S2 into the subagent's box, D3.S1 into the summary, D4 into whether to enter the loop at all.

## Study paths

Every item carries a `level`:

| Level | Reader | The item asks |
|---|---|---|
| `foundation` | junior, or new to Claude Code | What is it? What does it see and return? (cards, q1–q2) |
| `practitioner` | mid-level, uses Claude Code daily | Given this repo and task, which configuration is right? (diagrams, q3–q4) |
| `expert` | senior / architect | What fails, what does it cost, how does it look in the Agent SDK or a multi-agent system? (q5–q6) |

**Junior.** Go in pack order, D1 → D4. Start with the capstone diagram, then for each skill read the card (the
*simply* paragraph is a worked Claude Code example), its diagram, and answer q1–q2. Then do it for real: ask Claude to
create a read-only reviewer subagent in `.claude/agents/` (or write the file by hand), and ask Claude to use it on
a small diff. Leave the expert
questions until D1 and D2 are green.

**Mid-level.** Skim D1, start at D2. Answer q3–q4 first and read the card only for the ones you miss. Then write
two subagents for your own repo (a test runner that returns only failures, a read-only reviewer) and check them
against the D3 diagrams: is the description specific enough to be matched, is the tool list the smallest that
works, does the brief say what to return?

**Senior / architect.** Answer q5–q6 for every skill cold and open the source link for every miss. Read the
multi-agent research post end to end: it is the architecture behind D3.S1 and D4.S1 (briefing, parallelism,
token cost). Then review: you are the best-placed reviewer for the expert items and the analogy breaks (see the
ladder), and you own the team's shared subagent files.

**A group** can split one skill by level, so juniors and seniors play the same skill on the same day, and the
forest shows where the group's gaps are. The UI does not filter by `level` yet (follow-up).

## The proof ladder

| # | Rung | What it proves | How | Signed by |
|---|---|---|---|---|
| 1 | Schema + loader | The file is well formed: ids, 4 options, one key, a rationale on every option, a "where it breaks" on every card, a drawable graph | `loadPackContent`, run by `pnpm test` and again by `pnpm db:sync-keys`, which refuses an invalid pack | the toolchain |
| 2 | Pack contract | Blueprint, citations are the skill's own sources, ≥ 2 questions per level, key letters spread (no letter > 40%), every diagram node connected, the capstone links the delegation loop, every skill has a senior-angle question | `mf-0040-subagents.acceptance.test.ts` (frozen) | the toolchain |
| 3 | No course text | No 12-word run from the saved course page appears in the pack | scratch check at hand-off (MF-0040 SC-8); re-run if the course page is saved again | the drafter |
| 4 | Grounding notes | Each item names the passage that supports its key | `.planning/tasks/MF-0040/grounding/D<n>.md` | the drafter |
| 5 | Independent verifier | A reader who did not write the item checks the key, every rationale, every analogy break, every backticked token, frontmatter field name and default, and every absolute quantifier against the cited page's text | fresh-context agents (MF-0040 SC-9, reports in `.planning/tasks/MF-0040/verify/`); later the MF-0022 model verifier | the verifier; findings fixed before hand-off |
| 6 | Human review | Two reviewers who are not the author approve the exact content hash | in-app review queue (MF-0007); editing an item resets its approvals | 2 reviewers in a group on the pack |
| 7 | Analogy owner | The nature analogy teaches, and its breaks are honest | review queue, cards only | the pack's analogy owner (any content maintainer after 48 h) |
| 8 | Flags in play | Learners catch what reviewers missed | a flag hides the item until a content maintainer fixes it in a PR or dismisses it | content maintainers |
| 9 | Hands-on check (optional, per reviewer) | The configuration an item teaches behaves as stated in today's Claude Code | create the subagent file from the card or question in a scratch repo and run it | the reviewer who approves |

Until rung 6, items are `unreviewed`: practice serves them with a badge, and storms use them only to fill a short
domain. Rejected items are never served and are removed from the file in a later PR.

## Review checklist (rung 6)

This topic invites stale and exact-name errors. Watch for:
- **Field names.** Frontmatter fields are camelCase (`disallowedTools`, `permissionMode`, `maxTurns`), and Claude
  Code ignores an unrecognised field without an error. A misspelt field in an item teaches a silent bug.
- **Defaults and versions.** Which model a built-in subagent uses, whether a subagent starts in the background,
  and some return behaviour depend on the provider or the Claude Code version. Items should not depend on a
  version number; check every default against the page today.
- **Absolutes.** "A subagent never sees…", "always returns…". The cited page has to say it too.
- **Subagent vs alternative.** A subagent is not a skill, a fork or an agent team. An item that blurs which one
  keeps its own context, which shares it, and which can talk to peers is wrong.
- **Cost claims.** Token multipliers come from the multi-agent research post and are quoted exactly, with what
  they compare.

For a **question**:
- The key is right according to the cited page *today*. Open the source link.
- Each distractor is wrong for the reason its rationale gives, not just "less good".
- The stem has one defensible answer for the stated level.
- No trick wording, and the correct option is not the longest by habit.

For a **nature card**:
- "Simply" is correct without the analogy, and its Claude Code example would work if you typed it.
- Every "where it breaks" names a real difference, not a nitpick.
- It links the skill's diagram, and the diagram tells the same story.

For a **diagram**:
- Every arrow is true as a sentence ("A leads to B when …").
- Decision branches are labelled and cover the cases the source documents (for example, every scope in the
  priority order).

## Course vs docs drift (C-1, the user chose: docs win)

Items state only what today's cited page says. Where the course's framing has no public counterpart, no item
tests the course's wording:

| Course topic | Public grounding today | How the pack teaches it |
|---|---|---|
| "Obstacle reporting" as a design pattern | No public page uses the term. The multi-agent research post says each subagent needs an objective, an output format, guidance on tools and sources, and clear task boundaries; `sub-agents` documents `maxTurns` returning output marked as partial | D3.S1 teaches the brief + return contract and partial output, never the course term |
| "Create a subagent with the `/agents` command" | `sub-agents` today: running `/agents` prints a reminder to ask Claude or edit `.claude/agents/` and `~/.claude/agents/` directly; the interactive wizard is documented only for older versions | D2.S1 teaches asking Claude or writing the file, and the scope table; no item depends on the wizard |
| "Structured output formats" | The research post's "output format" in the brief; the Agent SDK page for programmatic agents | D3.S1, grounded in those pages only |

Re-check this table when the course page is saved again or the `sub-agents` page changes (it documents
version-gated behaviour and changes often).

## Getting it into the app (local)

1. `pnpm generate:corpus --pack subagents` caches the 13 sources (no key needed) for verifiers and the pipeline.
2. `pnpm db:sync-keys` registers the pack and its question keys (idempotent).
3. `pnpm dev:seed` builds a demo group per pack with answers. It replaces the whole local demo world (MF-0034).
4. Or create a real group on the pack, open the review queue and play.

A dev server started **before** `packs/subagents/` existed 404s on `/review/subagents`: `listPacks()` is a
`"use cache"` read with `cacheLife("days")`, so it keeps the old pack list. Restart `pnpm dev` after adding a pack.

## Follow-ups (not in MF-0040)

- **Chart item type** (user decision C-3). A data chart as an item, for example tokens used by a single agent vs a
  multi-agent run, with schema, loader and a shadcn `Chart` renderer. Its own ticket. Today's charts are the
  per-pack forest charts.
- **Guided-lesson screen.** Walk a learner through one skill: card → diagram → questions by level.
- **Level filter** in practice and the review queue.
- **Top-up to the Covered-skill bar** (15 approved questions per skill) through the MF-0008/MF-0022 pipeline. The
  sources are already set for it.
- **MF-0033 grounding gate.** It would automate rung 5's token, field-name and quantifier checks.
- **Pack list cache in dev.** `listPacks()` caches for days, so a new pack is invisible to a running server
  until a restart (found at MF-0040 TEST). A `cacheTag` invalidated by `db:sync-keys`, or a shorter dev
  `cacheLife`, would fix it. Production is unaffected: a deploy rebuilds.
- **Hands-on lab items.** A "write this subagent file" exercise checked by parsing the frontmatter. It needs a new
  item type.
