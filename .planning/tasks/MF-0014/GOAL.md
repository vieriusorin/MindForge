---
ticket_id: MF-0014
tier: normal                      # offline script; no app runtime, no schema
stage: design
branch: main
builds_on: []
last_iteration: 0
goal_status: reserved
track: C                          # seat Coder B; analogy review by Coder F
week: W3
depends_on: [MF-0008]
---

> Drafted 2026-11-03 from the planning grill (Q7, Q13). SCs are proposals; the claimant confirms and freezes them.

## Objective

G3 needs an approved nature card and diagram for all 25 skills; hand-writing (H-2) will cover only a
few by W3.

End state: the MF-0008 pipeline also writes **nature cards** (with a real "where it breaks") and
**diagrams** (graph YAML: direction, nodes, edges — ADR 0003, decided 2026-11-04 in MF-0010) for every skill that lacks an approved one, verified and written as `origin: ai`
files for a PR, so reviewers and the analogy owner can approve them in the app.

## Affected

- **Roles:** content-pipeline owner, analogy owner (Coder F), reviewers.
- **Surfaces:** `scripts/generate/**`, `prompts/{nature-card,diagram,verifier}*`, `evals/golden/**`, `packs/ccdv-f/{cards,diagrams}/*.yaml`.

## Constraints

- Same rules as MF-0008: local only, cost guard, corpus as untrusted data, model + prompt version recorded, citations required.
- The seed nature library in `MINDFORGE.md` §2.4 is the starting point; the writer may propose others but must fill "where it breaks".
- Diagrams must parse (MF-0006 validator) and include a node list.

## Decided without a question

- One card per skill minimum (skills with a human card are skipped); one diagram per skill; cards may reference their diagram by id.
- The verifier checks: facts against the corpus, "where it breaks" names a real limit (not empty or generic), the diagram passes the graph schema (no edge to an unknown node).

## Success Criteria

- [ ] SC-1: `pnpm generate:cards` and `pnpm generate:diagrams` cover every skill without an existing card/diagram. Proof: run report.
- [ ] SC-2: Every output passes the pack loader; every card has ≥ 1 "where it breaks" entry and ≥ 1 source. Proof: loader test.
- [ ] SC-3: Golden set adds planted flaws (a card with an empty or generic "where it breaks", a factual error, a diagram with a wrong arrow); the verifier catches ≥ 80%, and 100% of empty "where it breaks". Proof: eval output.
- [ ] SC-4: Cost logged; guard respected. Proof: run log.

## Concerns

| # | Collision | Owner | Status |
|---|-----------|-------|--------|
| C-1 | ~25 cards land at once on the analogy owner; split the PR by domain and stagger. | Coder B + Coder F | open |

## Out of Scope

- Cuckoo writer (MF-0016), illustrated images, personal analogy themes.

## Open questions

- none.

## Iteration Log

<!-- append-only -->
