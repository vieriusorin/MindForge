# Validating the `prod-prompting` pack (MF-0031)

The pack *Production-Grade Prompting, Agents & Tool use* (`packs/prod-prompting/`) is a course pack: 3 domains, 9
skills, and per skill 6 questions, 1 nature card and 1 diagram. Every item starts life as `origin: ai`. This page is
the proof ladder an item climbs before a learner should trust it, and who signs each rung.

Rule zero: the course is behind a login, so it is **never a source** (CONTEXT.md *Source*). Every item cites one of
its skill's public `sources` in `pack.yaml`, and every claim must be checkable against that page.

## Who the items are for

Every item carries a `level`:

| Level | Reader | The item asks |
|---|---|---|
| `foundation` | junior, or new to LLM apps | What is it? When do I use it? (cards, q1–q2) |
| `practitioner` | mid-level, ships features | Given this scenario, what is the right move? (diagrams, q3–q4) |
| `expert` | senior, owns production | What fails, what is the trade-off, what is the edge case? (q5–q6) |

A learner can study one skill bottom-up (card → diagram → questions by level), and a group can split the same skill
by level. The UI does not filter by `level` yet; that is a follow-up ticket.

## The proof ladder

| # | Rung | What it proves | How | Signed by |
|---|---|---|---|---|
| 1 | Schema + loader | The file is well formed: ids, 4 options, one key, a rationale on every option, a "where it breaks" on every card, a drawable graph | `loadPackContent` (the app's loader), run by `pnpm test` and again by `pnpm db:sync-keys`, which refuses to sync an invalid pack | the toolchain |
| 2 | Pack contract | Citations are the skill's own sources, ≥ 2 questions per level, key letters spread (no letter > 40%), every diagram node connected | `mf-0031-prod-prompting.acceptance.test.ts` (frozen) | the toolchain |
| 3 | Grounding notes | Each item names the passage that supports its key | `.planning/tasks/MF-0031/grounding/D<n>.md` | the drafter |
| 4 | Independent verifier | A reader who did not write the item checks the key, every rationale and every analogy break against the cited page's text | fresh-context agent per domain (MF-0031 SC-7); later the MF-0022 model verifier when its key exists | the verifier; findings fixed before hand-off |
| 5 | Human review | Two reviewers who are not the author approve the exact content hash | in-app review queue (MF-0007); editing an item resets its approvals | 2 reviewers in a group on the pack |
| 6 | Analogy owner | The nature analogy teaches, and its breaks are honest | review queue, cards only | the pack's analogy owner (any content maintainer after 48 h) |
| 7 | Flags in play | Learners catch what reviewers missed | a flag hides the item until a content maintainer fixes it in a PR or dismisses it | content maintainers |

Until rung 5, items are `unreviewed`: practice serves them with a badge, and storms use them only to fill a short
domain. Rejected items are never served and are removed from the file in a later PR.

## Review checklist (rung 5)

For a **question**:
- The key is right according to the cited page *today*. Open the source link.
- Each distractor is wrong for the reason its rationale gives, not just "less good".
- The stem has one defensible answer for the stated level. An expert question still has one key.
- No trick wording; the stem doesn't give the answer away.

For a **nature card**:
- "Simply" is correct without the analogy.
- Every "where it breaks" names a real difference, not a nitpick.
- It links the skill's diagram, and the diagram tells the same story.

For a **diagram**:
- Every arrow is true as a sentence ("A leads to B when …").
- Decision branches are labelled and cover the cases.

## Getting it into the app (local)

1. `pnpm db:sync-keys` registers the pack and its 54 question keys (idempotent; it refuses a remote DB unless
   you're on an up-to-date `main`, see `docs/runbook/deploy.md`).
2. Create a group on the pack, then open the review queue and play.
3. To reach the *Covered skill* bar (15 approved questions per skill), run the MF-0008 question pipeline for
   `prod-prompting` once MF-0022 has its key. The pack's `sources` are already set for it.

## When the course outline arrives

Re-map skill names and weights in `pack.yaml` (MF-0031 C-1). Item ids keep their skill code. If a skill moves,
its items move with it in one PR, and the move resets their approvals because the content hash changes.
