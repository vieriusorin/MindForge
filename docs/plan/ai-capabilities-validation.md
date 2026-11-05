# Studying and validating the `ai-capabilities` pack (MF-0037)

The pack *AI Capabilities and Limitations* (`packs/ai-capabilities/`) is a course pack: 3 domains, 8 skills, and
per skill 6 questions, 1 nature card and 1 diagram. Every item starts life as `origin: ai`. This page covers two
things: how developers at each level study the pack, and the proof ladder an item climbs before a learner should
trust it.

Rule zero: the course is behind a login, so it is **never a source** (CONTEXT.md *Source*). Its outline (section
order and the four property names) shaped the blueprint and nothing more. Every item cites one of its skill's
public `sources` in `pack.yaml`, and every claim must be checkable against that page.

## The map

The pack follows the course order. Each property is a reason a model can surprise you, and D3 is where they meet.

| Domain | Skill | The question it answers for a developer |
|---|---|---|
| D1 What AI is and how it is made | D1.S1 Generative AI and language models | What is the thing I am calling? |
| | D1.S2 How training gives a model its character | Why does it behave the way it does by default? |
| D2 The four properties | D2.S1 Next token prediction | Why is fluent output not the same as checked output? |
| | D2.S2 Knowledge | What does it know, as of when, and how do I ground it? |
| | D2.S3 Working memory | What can it see right now, and what happens as that fills up? |
| | D2.S4 Steerability | How do I move its behaviour, and keep it consistent? |
| D3 Putting it together | D3.S1 When properties collide | Which two properties caused this failure, and what is the fix? |
| | D3.S2 Using AI safely and effectively | How do I decide what to trust, verify and guard? |

The D3.S1 diagram is the capstone: it connects all four properties to the failures they cause together and the
mitigation for each.

## Study paths

Every item carries a `level`:

| Level | Reader | The item asks |
|---|---|---|
| `foundation` | junior, or new to LLM apps | What is it? Why does it matter? (cards, q1–q2) |
| `practitioner` | mid-level, ships features | Given this scenario, what is the right move? (diagrams, q3–q4) |
| `expert` | senior, owns production | What fails, what is the trade-off, what is the edge case? (q5–q6) |

**Junior (first week with LLMs).** Go in pack order, D1 → D2 → D3. For each skill, read the card (the *simply*
paragraph has a developer example), then its diagram, then answer q1–q2. Use the card's *where it breaks* lines
as the list of things to remember. Leave the expert questions until the whole of D2 is green.

**Mid-level (ships LLM features).** Skim the D1 cards and start at D2. For each property, answer q3–q4 first and
read the card only for the ones you miss. Then do D3.S1 in full: it is the diagnosis practice the job needs.

**Senior (owns production, reviews others).** Answer q5–q6 for every skill cold, and open the source link for every
miss. Then review: you are the best-placed reviewer for the expert items and for the analogy breaks (see the
ladder). Use D3.S1's capstone diagram to teach the team.

**A group** can split one skill by level, so juniors and seniors play the same skill on the same day, and the
forest shows where the group's gaps are. The UI does not filter by `level` yet (follow-up).

## The proof ladder

| # | Rung | What it proves | How | Signed by |
|---|---|---|---|---|
| 1 | Schema + loader | The file is well formed: ids, 4 options, one key, a rationale on every option, a "where it breaks" on every card, a drawable graph | `loadPackContent`, run by `pnpm test` and again by `pnpm db:sync-keys`, which refuses an invalid pack | the toolchain |
| 2 | Pack contract | Blueprint, citations are the skill's own sources, ≥ 2 questions per level, key letters spread (no letter > 40%), every diagram node connected, the capstone links all four properties | `mf-0037-ai-capabilities.acceptance.test.ts` (frozen) | the toolchain |
| 3 | No course text | No 12-word run from the saved course page appears in the pack | scratch check at hand-off (MF-0037 SC-7); re-run if the course page is saved again | the drafter |
| 4 | Grounding notes | Each item names the passage that supports its key | `.planning/tasks/MF-0037/grounding/D<n>.md` | the drafter |
| 5 | Independent verifier | A reader who did not write the item checks the key, every rationale, every analogy break, every backticked token and every absolute quantifier against the cited page's text | fresh-context agent per domain (MF-0037 SC-8, reports in `.planning/tasks/MF-0037/verify/`); later the MF-0022 model verifier | the verifier; findings fixed before hand-off |
| 6 | Human review | Two reviewers who are not the author approve the exact content hash | in-app review queue (MF-0007); editing an item resets its approvals | 2 reviewers in a group on the pack |
| 7 | Analogy owner | The nature analogy teaches, and its breaks are honest | review queue, cards only | the pack's analogy owner (any content maintainer after 48 h) |
| 8 | Flags in play | Learners catch what reviewers missed | a flag hides the item until a content maintainer fixes it in a PR or dismisses it | content maintainers |

Until rung 6, items are `unreviewed`: practice serves them with a badge, and storms use them only to fill a short
domain. Rejected items are never served and are removed from the file in a later PR.

## Review checklist (rung 6)

This topic invites overclaims. Watch for:
- **Absolutes.** "The model always…", "never knows…". The cited page has to say it too.
- **Anthropomorphism stated as fact.** "Thinks", "knows" and "remembers" are fine as plain words; a claim about
  what happens inside the model must come from the interpretability source, not intuition.
- **Stale numbers.** Context sizes and training cutoffs change per model. An item may name where to look them up;
  it should not depend on today's figure.
- **Fine-tuning vs knowledge.** Training shapes behaviour and character; supplying documents or search results is
  how you give a model fresh facts. An item that blurs these is wrong.

For a **question**:
- The key is right according to the cited page *today*. Open the source link.
- Each distractor is wrong for the reason its rationale gives, not just "less good".
- The stem has one defensible answer for the stated level.
- No trick wording, and the correct option is not the longest by habit.

For a **nature card**:
- "Simply" is correct without the analogy, and its developer example is realistic.
- Every "where it breaks" names a real difference, not a nitpick.
- It links the skill's diagram, and the diagram tells the same story.

For a **diagram**:
- Every arrow is true as a sentence ("A leads to B when …").
- Decision branches are labelled and cover the cases the source documents.

## Getting it into the app (local)

1. `pnpm generate:corpus --pack ai-capabilities` caches the sources (no key needed) for verifiers and the pipeline.
2. `pnpm db:sync-keys` registers the pack and its question keys (idempotent).
3. `MF_AUTHOR_EMAIL=<you> pnpm dev:seed --pack ai-capabilities` builds a demo group with answers. It replaces the
   whole local demo world (MF-0034).
4. Or create a real group on the pack, open the review queue and play.

## Follow-ups (not in MF-0037)

- **Chart item type.** A data chart as an item (for example, recall against context fill), with schema, loader
  and a shadcn `Chart` renderer. It needs its own ticket. Today's charts are the per-pack forest charts.
- **Guided-lesson screen.** Walk a learner through one skill: card → diagram → questions by level.
- **Level filter** in practice and the review queue.
- **Top-up to the Covered-skill bar** (15 approved questions per skill) through the MF-0008/MF-0022 pipeline. The
  sources are already set for it.
- **MF-0033 grounding gate.** It would automate rung 5's token and quantifier checks.
