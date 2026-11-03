---
ticket_id: MF-0013
tier: high-risk                   # schema + server-side deadline + changes what "Tree" means
stage: design
branch: main
builds_on: []
last_iteration: 0
goal_status: reserved
track: E + G                      # seat Coder D (helped by Coder F)
week: W3
depends_on: [MF-0006]             # review state via the getReviewContext seam; empty = all unreviewed
blocks: []                        # MF-0015 consumes StormDomainScore; the second to merge wires them
---

> Drafted 2026-11-03 from the planning grill (Q8, Q10). SCs are proposals; the claimant confirms and freezes them.

## Objective

Today nobody can practise under exam conditions, and with Feynman cut no tree can grow past Sapling
(`src/engine/forest/tree-stage.ts` needs `feynmanPassed`).

End state: **Full Storm** (53 questions, 120 minutes, blueprint-weighted) and **Boss Storm** (one
domain, 12 questions, ~27 minutes) run with a server-side deadline and no feedback until the end,
then a per-domain and per-skill report and a full review. Storm answers are normal attempts. A skill
**proven in a storm** can reach Tree; Full-Storm-proven can reach Ancient.

## Affected

- **Roles:** learner.
- **Surfaces:** new table `storms` (+ `attempts.mode`, `attempts.storm_id`), storm RPCs in `private`; `src/engine/storm/**` (composition, scoring, report); `src/engine/forest/tree-stage.ts`; `src/features/storm/**`; routes `/play/[packSlug]/storm/{full,boss/[domain]}`, `/storms/[id]`.

## Constraints

- Terms: Storm, Storm-proven skill, Survived domain (CONTEXT.md).
- The deadline is enforced by the DB (`ends_at`); answers after it are refused; unanswered = wrong.
- One running storm per learner. Key never reaches the browser before the storm ends.
- Revoke-all-first, `auth.uid()` checks, grants gate green; migrations follow the parallel rule (ROADMAP §4).
- The report exports per-domain results as MF-0015's `StormDomainScore[]` (`{ domainCode, percent, finishedAt }`).
- Report figures come from `src/engine/storm/` only.

## Decided without a question

- Full Storm split: largest-remainder by domain weight, then by skill weight inside a domain.
- Boss Storm: 12 questions (or all playable if fewer), 120/53 min per question.
- Question choice: approved first; unreviewed only to fill a short domain, labelled in the report; avoid questions the learner spoiled; prefer questions not seen in an earlier storm.
- Skip and return allowed; no pause; closing the tab doesn't stop the clock; unlimited storms.
- Tree = stability ≥ 14 d and (Feynman passed or storm-proven); Ancient = stability ≥ 45 d and Full-Storm-proven. The MF-0001 stage test is re-frozen here, approved 2026-11-03.

## Success Criteria

- [ ] SC-1: `composeFullStorm(pack, pool, learner)` returns 53 questions whose per-domain counts equal the largest-remainder split of the blueprint (expected counts derived by hand from `pack.yaml` in the test). Proof: engine acceptance test.
- [ ] SC-2: A short domain is filled from unreviewed and those items are marked; spoiled questions are excluded. Proof: engine test.
- [ ] SC-3: An answer submitted after `ends_at` is refused; a second concurrent storm is refused; another user can't read or answer my storm. Proof: DB acceptance test with real tokens.
- [ ] SC-4: No answer key or rationale is in the HTML or RPC responses until the storm is finished. Proof: DB test + browser check.
- [ ] SC-5: The report gives per-domain % and survived (≥ 72%) and per-skill proven/not; the storm's answers appear as attempts with `mode = storm`. Proof: engine test + DB test.
- [ ] SC-6: Tree/Ancient rules as decided; a fixture with stability 20 d and storm-proven is a Tree; without it, a Sapling. Proof: re-frozen stage acceptance test.
- [ ] SC-7: A full 53-question storm is playable end to end on the local stack, with a visible countdown that matches the server deadline. Proof: browser (clock shortened via a test-only setting, documented).
- [ ] SC-8: Advisors clean, grants gate, component split, typecheck, lint, build. Proof: receipt.

## Concerns

| # | Collision | Owner | Status |
|---|-----------|-------|--------|
| C-1 | D3 and D4 have 1 skill each and ~3% weight; their "proven" needs ≥ 2 questions, which a Full Storm gives them only rarely. Accept: Boss Storms are the way to prove them. | Coder D | open |
| C-2 | An approved pool may be thin in W3; the fill-from-unreviewed rule keeps storms playable. Watch H-3 progress. | Owner | open |

## Out of Scope

- Readiness weather (MF-0015), group storms, timed leaderboards.

## Open questions

- none.

## Iteration Log

<!-- append-only -->
