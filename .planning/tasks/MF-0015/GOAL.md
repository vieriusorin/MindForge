---
ticket_id: MF-0015
tier: normal                      # pure engine + dashboard UI; no schema
stage: design
branch: main
builds_on: []
last_iteration: 0
goal_status: reserved
track: E + G                      # seat Owner (Sorin)
week: W3–W4
depends_on: [MF-0006]             # exam.date; storms arrive as an input type, empty until MF-0013
---

> Drafted 2026-11-03 from the planning grill (Q9). SCs are proposals; the claimant confirms and freezes them.

## Objective

Today the dashboard shows tree stages but doesn't answer the question a learner has five weeks out:
"Where will I be weak on exam day?"

End state: per domain, the **memory forecast** (skill-weighted retrievability projected to the exam
date) and the **last storm score**, combined into **readiness weather** (sunny / cloudy / rain / fog)
from the lower of the two, and an overall line against a 72% "pass mark (approx.)" reference. No
estimated scaled score is ever shown.

## Affected

- **Roles:** learner.
- **Surfaces:** `src/engine/readiness/**`, dashboard cards in `src/features/dashboard/**`.

## Constraints

- Terms: Memory forecast, Readiness weather (CONTEXT.md). Exam packs only; other packs show the forecast alone.
- Every figure from `src/engine/readiness/`; no arithmetic in components.
- Weather shows words + icon, never colour alone; charts follow ui-design §1 (shadcn Chart, chart tokens).

## Decided without a question

- Thresholds: sunny ≥ 85%, cloudy 72–85%, rain < 72%, fog = no data. Overall = blueprint-weighted mean of domains.
- Defines `StormDomainScore = { domainCode, percent, finishedAt }` in `src/engine/readiness/types.ts`; the server passes `[]` until MF-0013 merges, and whichever ticket merges second wires the real storm results (a few lines).
- Forecast uses FSRS retrievability at `exam.date` from each skill's current state (no future reviews assumed).

## Success Criteria

- [ ] SC-1: `readiness(pack, memory, storms, now)` with fixtures returns per-domain forecast, last storm %, weather and overall; values hand-computed in the test. Proof: engine acceptance test, fixed clock.
- [ ] SC-2: A domain with no storm and no memory is "fog"; with memory but no storm it uses the forecast and says "no storm yet". Proof: engine test.
- [ ] SC-3: The dashboard shows weather per region with words, icon and both numbers, and the 72% reference labelled "approx.". Proof: browser, both themes.
- [ ] SC-4: The non-exam sample pack shows no weather. Proof: browser or loader-level test.
- [ ] SC-5: Component split, typecheck, lint, tests, build. Proof: receipt.

## Concerns

- none.

## Out of Scope

- Scaled-score estimates, group readiness, post-exam calibration (retro after Dec 7).

## Open questions

- none.

## Iteration Log

<!-- append-only -->
