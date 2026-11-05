# Studying and validating the `claude-code-in-action` pack (MF-0042)

The pack *Claude Code in Action* (`packs/claude-code-in-action/`) is a course pack: 4 domains, 11 skills, and per
skill 6 questions, 1 nature card and 1 diagram. Every item starts life as `origin: ai`. This page covers three
things: how developers at each level study the pack, where the course and today's docs disagree, and the proof
ladder an item climbs before a learner should trust it.

Rule zero: the course is behind a login, so it is **never a source** (CONTEXT.md *Source*). Its outline (section
and lesson order) shaped the blueprint and nothing more. Every item cites one of its skill's public `sources` in
`pack.yaml` (all on `code.claude.com/docs/en/`), and every claim must be checkable against that page.

## The map

The pack follows the course order. D2 is the daily-use toolkit, D3 is automation, and D4 ties the loop together.

| Domain | Skill | The question it answers for a developer |
|---|---|---|
| D1 What a coding assistant is | D1.S1 The agentic loop | How does a language model end up reading files and running my tests? |
| D2 Getting hands on | D2.S1 Setup and project context | How do I give Claude the project knowledge it needs every session? |
| | D2.S2 Making changes | How do I get the change I want, and decide what Claude may do without asking? |
| | D2.S3 Controlling context | How do I stop, undo, and keep a long session focused and cheap? |
| | D2.S4 Custom commands, now skills | How do I turn a prompt I keep retyping into a reusable command? |
| | D2.S5 MCP servers | How do I give Claude tools it doesn't ship with, and keep them safe? |
| | D2.S6 GitHub integration | How do I use Claude on issues and pull requests, in CI? |
| D3 Hooks and the SDK | D3.S1 Hook anatomy | When exactly does my code run, what does it see, and how does it block an action? |
| | D3.S2 Useful hooks and their gotchas | Which hooks pay off, and what bites you when you write one? |
| | D3.S3 Headless mode and the Agent SDK | How do I run Claude from a script, a pipeline, or my own program? |
| D4 Putting it together | D4.S1 A working session end to end | Explore → plan → implement → verify → commit, and which extension fits which need |

The D4.S1 diagram is the capstone: the whole working loop, with the fix loop from verify back to an earlier step.

## Study paths

Every item carries a `level`:

| Level | Reader | The item asks |
|---|---|---|
| `foundation` | junior, or new to Claude Code | What is it? Which command or file? (cards, q1–q2) |
| `practitioner` | mid-level, uses it daily | Given this situation, what is the right move? (diagrams, q3–q4) |
| `expert` | senior, sets it up for a team | How do I configure, automate or secure it, and what fails at the edges? (q5–q6) |

**Junior (first week with Claude Code).** Go in pack order, D1 → D2 → D3 → D4. For each skill, read the card
(the *simply* paragraph is a worked developer example), then its diagram, then answer q1–q2. Run each command
from the card in a scratch repo as you go: the pack is about a tool, and typing `/compact` once beats reading about
it twice. Leave D3's expert questions until D2 is green.

**Mid-level (uses it daily).** Skim D1, start at D2.S2. For each skill answer q3–q4 first and read the card only
for misses. Spend the most time on D2.S3 (context) and D3.S1 (hook anatomy): these are where daily sessions go
wrong. Finish with the D4.S1 diagram and check your own habit against it.

**Senior (sets it up for the team).** Answer q5–q6 for every skill cold and open the source link for every miss.
Expert questions are about the shared setup: settings scopes, permission rules, MCP scopes, hook exit codes and
JSON output, headless runs in CI. Then review: you are the best-placed reviewer for the expert items and for any
literal (command, flag, event name) that may have changed since the item was written. Use D4.S1's capstone to
onboard the team.

**A group** can split one skill by level, so juniors and seniors play the same skill on the same day, and the
forest shows where the group's gaps are. The UI does not filter by `level` yet (follow-up).

## Where the course has drifted

The course was recorded against an earlier Claude Code. Items follow **today's** docs; this table is what to tell
a learner who has just watched the video.

| The course says | Today | Cited page |
|---|---|---|
| Custom commands in `.claude/commands/` | Custom commands have been merged into skills. A command file still works; a skill adds supporting files and lets Claude load it when relevant | `skills` |
| The Claude Code SDK | The Agent SDK (the docs carry a migration guide from the Claude Code SDK packages) | `agent-sdk/overview` |
| `#` to add a memory | Not documented today. Ask Claude to remember (auto memory), or edit CLAUDE.md through `/memory` | `memory` |
| "think hard", "think harder" | Ordinary prompt text now; only `ultrathink` is still a keyword. Thinking is toggled per session, and current models always think | `best-practices` (keyword), `interactive-mode` (toggle) |
| Permission modes: normal, auto-accept, plan | The Shift+Tab cycle includes `auto`; `default` is labelled Manual | `permissions`, `interactive-mode` |
| `claude -p` for scripts | Still `-p`, but scripted runs should add `--bare`: without it a `-p` run loads the project's hooks and `.mcp.json` servers with no trust dialog | `headless` |
| GitHub integration | Claude Code GitHub Actions; automatic PR review without a workflow file is a separate product, Code Review | `github-actions` |
| Hooks are shell commands on PreToolUse / PostToolUse | Many more events, and `http`, `mcp_tool`, `prompt` and `agent` hook types besides `command`. Items teach the course's events plus `Stop`, `SessionStart` and `Notification` | `hooks` |
| Explore, plan, code, commit | Today's best-practices page has no named recipe; the capstone grounds each step separately and adds the verify step | `best-practices`, `common-workflows` |
| A browser MCP server as the example | Today's MCP page shows no Playwright example; the permissions page's MCP rule example uses a `puppeteer` server. (The course's own example is unconfirmed: no lesson page was saved) | `mcp`, `permissions` |

The drafters list any further drift they found per item in `.planning/tasks/MF-0042/grounding/G*.md`. When the docs
change again, a flagged item is fixed in a PR and its approvals reset (ADR 0001).

## The proof ladder

| # | Rung | What it proves | How | Signed by |
|---|---|---|---|---|
| 1 | Schema + loader | The file is well formed: ids, 4 options, one key, a rationale on every option, a "where it breaks" on every card, a drawable graph | `loadPackContent`, run by `pnpm test` and again by `pnpm db:sync-keys`, which refuses an invalid pack | the toolchain |
| 2 | Pack contract | Blueprint, citations are the skill's own sources, ≥ 2 questions per level, key letters spread (no letter > 40%), every diagram node connected, the hook diagram names `PreToolUse`/`PostToolUse` and the block outcome, the capstone runs explore → plan → implement → verify → commit with a fix loop | `mf-0042-claude-code-in-action.acceptance.test.ts` (frozen) | the toolchain |
| 3 | Grounding notes | Each item names the passage that supports its key, and any drift | `.planning/tasks/MF-0042/grounding/G<n>.md` | the drafter |
| 4 | Independent verifier | A reader who did not write the item checks the key, every rationale, every analogy break, every backticked token and every absolute quantifier against the cited page's text | fresh-context agent per skill group (MF-0042 SC-8, reports in `.planning/tasks/MF-0042/verify/`); later the MF-0022 model verifier | the verifier; findings fixed before hand-off |
| 5 | Human review | Two reviewers who are not the author approve the exact content hash | in-app review queue (MF-0007); editing an item resets its approvals | 2 reviewers in a group on the pack |
| 6 | Analogy owner | The nature analogy teaches, and its breaks are honest | review queue, cards only | the pack's analogy owner (any content maintainer after 48 h) |
| 7 | Flags in play | Learners catch what reviewers missed, including docs that changed after review | a flag hides the item until a content maintainer fixes it in a PR or dismisses it | content maintainers |

Until rung 5, items are `unreviewed`: practice serves them with a badge, and storms use them only to fill a short
domain. Rejected items are never served and are removed from the file in a later PR.

## Review checklist (rung 5)

This topic invites stale literals. Watch for:
- **Commands, flags and paths.** Every backticked token must appear on the cited page today. Open the link and
  search for it. A renamed flag is the most likely error in this pack.
- **Absolutes.** "Claude always asks…", "hooks never…". The cited page has to say it too.
- **Defaults vs configuration.** Many answers depend on a permission mode or a settings scope. The stem must
  state the setup if the answer changes with it.
- **Security claims.** Hooks and MCP servers run with real permissions. An item that makes a hook or a server
  sound sandboxed when the page says otherwise is wrong.

For a **question**:
- The key is right according to the cited page *today*.
- Each distractor is wrong for the reason its rationale gives, not just "less good".
- The stem has one defensible answer for the stated level.
- No trick wording, and the correct option is not the longest by habit.

For a **nature card**:
- "Simply" is correct without the analogy, and its developer example is realistic.
- Every "where it breaks" names a real difference, not a nitpick.
- It links the skill's diagram, and the diagram tells the same story.

For a **diagram**:
- Every arrow is true as a sentence ("A leads to B when …").
- Decision branches are labelled and cover the cases the source documents (for hooks: every exit-code branch).

## Getting it into the app (local)

1. `pnpm generate:corpus --pack claude-code-in-action` caches the sources (no key needed) for verifiers and the
   pipeline.
2. `pnpm db:sync-keys` registers the pack and its question keys (idempotent).
3. `MF_AUTHOR_EMAIL=<you> pnpm dev:seed --pack claude-code-in-action` builds a demo group with answers. It replaces
   the whole local demo world (MF-0034).
4. Or create a real group on the pack, open the review queue and play.

A `pnpm dev` server that was already running when the pack was added still returns 404 on
`/review/claude-code-in-action` and the play pages: `listPacks()` is `"use cache"` with `cacheLife("days")`, so its
pack list was cached before the pack existed. Restart the dev server (a deploy rebuilds the cache anyway). Found
during MF-0042's render check.

## Follow-ups (not in MF-0042)

- **Chart item type.** A data chart as an item, with schema, loader and a shadcn `Chart` renderer. It needs its own
  ticket (user decision, MF-0037 and again in MF-0042). Today's charts are the per-pack forest charts.
- **Guided-lesson screen.** Walk a learner through one skill: card → diagram → questions by level, with the
  "try it" commands from the card.
- **Level filter** in practice and the review queue.
- **Top-up to the Covered-skill bar** (15 approved questions per skill) through the MF-0008/MF-0022 pipeline. The
  sources are already set for it.
- **Docs-drift watch.** Re-run the corpus fetch on a schedule and flag items whose cited page changed, so stale
  literals reach a reviewer before a learner. Pairs with the MF-0033 grounding gate.
