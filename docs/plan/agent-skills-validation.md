# Studying and validating the `agent-skills` pack (MF-0039)

The pack *Introduction to Agent Skills* (`packs/agent-skills/`) is a course pack with 6 domains and 9 skills. Each
skill has 6 questions, 1 nature card and 1 diagram, and every item starts as `origin: ai`. This page covers three
things: how developers at each level study the pack, the hands-on exercise that turns the pack into a tutorial, and
the proof ladder an item climbs before a learner should trust it.

Rule zero: the course is behind a login, so it is **never a source** (CONTEXT.md *Source*). Its outline (the six
lesson titles) shaped the blueprint and nothing more. Every item cites one of its skill's public `sources` in
`pack.yaml`, and every claim must be checkable against that page.

## The map

The pack follows the course's lesson order. Read it as one journey: a skill on disk, then a skill in context, then
a skill in a team.

| Domain (lesson) | Skill | The question it answers for a developer |
|---|---|---|
| D1 What skills are | D1.S1 What a skill is, where it lives, when to write one | When is this worth a skill, and where do I put it? |
| D2 Creating your first skill | D2.S1 Anatomy of `SKILL.md` | What goes in the frontmatter and what goes in the body? |
| | D2.S2 Discovery and loading | What does Claude see before, during and after a match? |
| D3 Configuration and multi-file skills | D3.S1 Frontmatter controls | Who may invoke it, with which tools, in which context? |
| | D3.S2 Multi-file skills | How do I keep `SKILL.md` small and still ship the detail? |
| D4 Skills vs other features | D4.S1 CLAUDE.md, skills, subagents, hooks, MCP | Which tool is right for this need? |
| D5 Sharing skills | D5.S1 Scopes and distribution | How does my team get it, and should I trust someone else's? |
| D6 Troubleshooting skills | D6.S1 Not triggering, over-triggering, ignored, truncated | Why isn't my skill behaving? |
| | D6.S2 Evaluate and iterate | How do I know the skill helps, and keep it helping? |

Two diagrams carry the pack:
- **The D2.S2 capstone** follows a skill from disk to action. Names and descriptions sit in context, a request
  matches one (or nothing does), the `SKILL.md` body loads, and supporting files load only when needed.
- **The D4.S1 map** answers "which customization do I need?" across CLAUDE.md, skills, subagents, hooks and MCP.

## Study paths

| Level | Reader | The item asks |
|---|---|---|
| `foundation` | junior, or new to Claude Code | What is it, where does it live, when do I use it? |
| `practitioner` | mid-level, writes skills for themselves | In this scenario, which file, field or placement is right? |
| `expert` | senior, owns the team's setup | What does it cost in context, what can go wrong, and how do I control it? |

**Junior.** Work in pack order, D1 → D6. For each skill, read the card, whose *simply* paragraph is the worked
example. Then follow its diagram and answer the foundation questions. Learn the *where it breaks* lines. Do the
junior exercise below after D2.

**Mid-level.** Start at D2.S2 (the capstone), then D3 and D6.S1. Answer the practitioner questions first, and read a
card only after you miss its questions. Do the mid exercise after D3.

**Senior.** Answer the expert questions cold for every skill and open the source on every miss. Then do the senior
exercise. You are also the best reviewer for the expert items and the D4.S1 map (see the ladder).

**A group** can play one skill on the same day across levels, and the forest shows where the gaps are. The UI does
not filter by `level` yet (follow-up).

## Hands-on exercises (the tutorial half)

Do these in a scratch repository, not in this one. Each exercise checks the skills it names against the real tool.

| Level | Exercise | Done when | Skills |
|---|---|---|---|
| Junior | Write a personal skill under `~/.claude/skills/<name>/SKILL.md` for a task you keep explaining (a commit-message format, say). Trigger it twice: once by describing the task in plain words, once by typing `/<name>`. | Both ways load it, and you can say which part of the file Claude matched on. | D1.S1, D2.S1, D2.S2 |
| Mid | Turn it into a project skill. Move the long reference into a supporting file the body links to, then add a side-effecting skill (a fake deploy) that only you can invoke. | Claude does not run the deploy skill on its own, and the reference file is read only when the task needs it. | D3.S1, D3.S2, D5.S1 |
| Senior | Write three evaluation prompts for the skill, two that should trigger it and one that should not, and run them with and without the skill. Then break the description on purpose and fix it from the troubleshooting guidance. Finally, write one paragraph on why this need is a skill and not a CLAUDE.md line, a hook or a subagent. | The evals show the skill helps, the broken description is diagnosed from its symptom, and the paragraph survives a peer's review. | D4.S1, D6.S1, D6.S2 |

## The proof ladder

| # | Rung | What it proves | How | Signed by |
|---|---|---|---|---|
| 1 | Schema + loader | The file is well formed: ids, 4 options, one key, a rationale on every option, a "where it breaks" on every card, a drawable graph | `loadPackContent`, run by `pnpm test` and again by `pnpm db:sync-keys`, which refuses an invalid pack | the toolchain |
| 2 | Pack contract | Blueprint and weights; citations are the skill's own sources; ≥ 2 questions per level; key letters spread (no letter > 40%); every diagram node connected; the capstone's order and no-match branch; the D4.S1 map names all five features | `mf-0039-agent-skills.acceptance.test.ts` (frozen) | the toolchain |
| 3 | No course text | No run of 12 consecutive words from the saved lesson page appears in the pack | scratch check at hand-off (MF-0039 SC-8). Re-run it whenever another lesson page is saved | the drafter |
| 4 | Independent verifier | A reader who did not write the item checks the key, every rationale, every analogy break, and every backticked field name, path and absolute quantifier against the cited page's cached text | fresh-context agents (MF-0039 SC-9, reports in `.planning/tasks/MF-0039/verify/`); later the MF-0022 model verifier and the MF-0033 grounding gate | the verifier; findings are fixed before hand-off |
| 5 | Human review | Two reviewers who are not the author approve the exact content hash | in-app review queue (MF-0007). Editing an item resets its approvals | 2 reviewers in a group on the pack |
| 6 | Analogy owner | The nature analogy teaches, and its breaks are honest | review queue, cards only | the pack's analogy owner (any content maintainer after 48 h) |
| 7 | Hands-on check | The behaviour an item describes is what the tool does today | a reviewer runs the matching exercise above on the current Claude Code release | any senior reviewer, once per Claude Code release that changes the skills page |
| 8 | Flags in play | Learners catch what reviewers missed | a flag hides the item until a content maintainer fixes it in a PR or dismisses it | content maintainers |

Until rung 5, items are `unreviewed`: practice serves them with a badge, and storms use them only to fill a short
domain.

## Review checklist (rung 5)

This topic moves fast, so watch for these:
- **Field names and paths.** `disable-model-invocation`, `user-invocable`, `allowed-tools`, `context: fork`,
  `~/.claude/skills/`, `.claude/skills/`. Each must be spelled exactly as on the cited page today.
- **Who invokes, and what loads when.** By default both you and Claude can invoke a skill. Its description stays in
  context and the body loads on use. The invocation fields change this, and an item has to match the page's table.
- **Commands vs skills.** Custom commands have been merged into skills (see the drift list). An item that teaches
  them as two mechanisms is out of date.
- **Numbers.** Description length budgets and limits change. Name where to find them; don't build a key on today's
  figure unless the cited page states it.
- **Security.** Third-party skills can run code and tools. The expert items have to keep the documented caution
  and not soften it.

For a **question**, check that the key is right per the cited page *today*. Each distractor should be wrong for the
reason its rationale gives, the stem should have one defensible answer at its level, and the correct option should
not be the longest out of habit. For a **card**, *simply* has to be correct without the analogy, and every break
has to name a real difference. For a **diagram**, every arrow reads as a true sentence and every branch the source
documents is present.

## Course vs current docs: drift list

| # | The course lesson says | Today's public docs say | Pack choice (user, 2026-11-04) |
|---|---|---|---|
| 1 | Slash commands must be typed; skills activate automatically, so the two are different mechanisms. | "Custom commands have been merged into skills." A `.claude/commands/x.md` file and a `.claude/skills/x/SKILL.md` both create `/x`. Any skill can be typed as `/name`, and `disable-model-invocation` / `user-invocable` decide who may invoke it. | Items follow the docs. The contrast is taught as *who invokes it and what loads when*. |
| 2 | Skills live in personal (`~/.claude/skills`) or project (`.claude/skills`) directories. | Those two, plus enterprise (managed settings), nested subdirectory, `--add-dir`, plugin and claude.ai-synced locations. | Items cover all the documented locations. Personal vs project stays the junior core. |

Re-check this list whenever a new lesson page is saved, and whenever the skills page changes (rung 7).

## Getting it into the app (local)

1. `pnpm generate:corpus --pack agent-skills` caches the sources (no key needed).
2. `pnpm db:sync-keys` registers the pack and its question keys (idempotent).
3. `MF_AUTHOR_EMAIL=<you> pnpm dev:seed --pack agent-skills` builds a demo group with answers. It replaces the whole
   local demo world (MF-0034).
4. Or create a real group on the pack, open the review queue and play.

## Follow-ups (not in MF-0039)

- **Chart item type.** A data chart as an item, for example the context cost of skill metadata vs loaded bodies.
  It needs a schema, a loader and a shadcn `Chart` renderer, so it is its own ticket. Today's charts are the
  per-pack forest charts.
- **Guided-lesson screen.** Walk one skill as card → diagram → questions by level → exercise.
- **Level filter** in practice and the review queue.
- **Top-up to the Covered-skill bar** (15 approved questions per skill) through the MF-0008/MF-0022 pipeline.
- **Remaining lessons.** Only the first lesson page was saved. Saving the others lets rung 3 cover them and may add
  rows to the drift list.
