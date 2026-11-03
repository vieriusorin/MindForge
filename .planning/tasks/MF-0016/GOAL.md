---
ticket_id: MF-0016
tier: normal                      # new item type + UI; grading reuses record_attempt
stage: design
branch: main
builds_on: []
last_iteration: 0
goal_status: reserved
track: G                          # seat Coder C
week: W4 (stretch: only if W3 is green; ahead of MF-0017)
depends_on: [MF-0006]
---

> Drafted 2026-11-03 from the planning grill (Q14). Stretch scope. SCs are proposals; the claimant
> confirms and freezes them.

## Objective

Security & Safety is 8.1% of the exam and is about spotting what's wrong in realistic text. No mode
trains that today.

End state: **Spot the Cuckoo.** The learner sees a short snippet (a prompt, a tool result, a config
or a hook), picks the line that holds the planted flaw (an injected instruction, a wrong claim, a bad
setting), and then sees why. It is a question variant: options are line numbers, graded by the DB.

## Affected

- **Roles:** learner, reviewers (new item type).
- **Surfaces:** cuckoo schema in `src/engine/content/`, `packs/ccdv-f/cuckoos/*.yaml`, key sync, `src/features/cuckoo/**`, route `/play/[packSlug]/cuckoo`.

## Constraints

- Same item rules: origin, author, content hash, review state, playable filter.
- The key (the flawed line) never reaches the browser before answering.
- Snippets are shown as inert text (code block), never rendered as HTML.

## Decided without a question

- Content: hand-written (H track) or a CuckooWriter prompt in the MF-0008 pipeline; at least 2 per skill in D7 and D6 to start.
- Attempts feed FSRS like any question.

## Success Criteria

- [ ] SC-1: Cuckoo schema: `snippet` (lines), `flawLine`, `flawKind`, `explanation`, sources; invalid line number fails. Proof: acceptance test.
- [ ] SC-2: Cuckoo keys sync and grade through `record_attempt`; no key in pre-answer HTML. Proof: DB test + browser.
- [ ] SC-3: A 5-cuckoo session is playable and grows trees. Proof: browser.
- [ ] SC-4: ≥ 10 cuckoos exist for D6/D7. Proof: loader count.
- [ ] SC-5: Component split, typecheck, lint, tests, build. Proof: receipt.

## Concerns

- none.

## Out of Scope

- Multi-flaw snippets, free-text explanations.

## Open questions

- none.

## Iteration Log

<!-- append-only -->
