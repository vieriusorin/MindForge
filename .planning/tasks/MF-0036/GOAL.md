---
ticket_id: MF-0036
tier: normal                      # dev tooling: an offline content check; no app code, no DB
stage: intake
goal_status: reserved             # created by the MF-0016 retro (gate action); never built automatically
builds_on: [MF-0016, MF-0033]
---

> Reserved 2026-11-04 by the MF-0016 retro (Action 2). Not built until the user picks it up. Build
> after (or together with) MF-0033, which owns `scripts/check-pack-grounding.mjs`.

## Objective

**Today.** A cuckoo must hold exactly one false line, but nothing checks that the OTHER lines are true.
MF-0016's first review found `packs/ccdv-f/cuckoos/D7.S2.yaml` line 3 ("… so keys never enter the
context") false per its cited permissions page, which made a second flaw that would have graded an
informed learner wrong. This is the MF-0031 lesson `ai-content-claims-outrun-source` on a new item kind.

**End state.** `pnpm check:packs` (MF-0033) gains a cuckoo rule: for every `packs/*/cuckoos/*.yaml` item,
each entry of `lines` except `lines[flawLine - 1]` fails when it contains an absolute quantifier
(`never`, `always`, `only`, `all`, `every`, `cannot`, `guarantee`, `no … can`) absent from the cached text
of one of the item's `sources` (`.cache/corpus/<sha256(url)>.json`), unless the item carries
`# grounded: <word>`; a non-flaw line whose backticked token is absent from the cited text also fails.
Skips with a message when `.cache/corpus/` is absent. `.claude/rules/testing.md` "Before hand-off" lists
`pnpm check:packs` for tickets touching `packs/**` (guarded file: ask the user).

## Proof cases

- RED on the pre-fix text of D7.S2 line 3: `"- We deny Read(./.env) so keys never enter the context."`
- GREEN on the shipped 14 cuckoos (or each hit justified with `# grounded:`).

## Open questions

- Is the quantifier list too noisy for prose explanations? (Scope is `lines` only, not `explanation`.)
