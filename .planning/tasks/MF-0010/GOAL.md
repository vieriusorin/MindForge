---
ticket_id: MF-0010
tier: normal                      # UI + read of file content; no schema
stage: design
branch: main
builds_on: []
last_iteration: 0
goal_status: reserved
track: G                          # seat Coder D
week: W2
depends_on: [MF-0006]
---

> Drafted 2026-11-03 from the planning grill (Q7, Q11). Needed for the Nov 15 release gate.
> SCs are proposals; the claimant confirms and freezes them.

## Objective

Today a new skill is met cold, with an exam question. The product promise is "associate before you
memorise": a nature card, a diagram, then a few quick checks.

End state: **Seed Planting.** From a seed tile ("Plant this seed") or the walk's new-skill slot, the
learner sees the skill's best nature card (approved first, then unreviewed), its diagram rendered
from Mermaid, then 3 quick-check questions from that skill. A correct check gives the first sprout.

## Affected

- **Roles:** learner.
- **Surfaces:** `src/features/seed-planting/**` (shared component, embedded by MF-0009), `src/components/` diagram renderer (`*-lazy.tsx` wrapper), `src/app/(app)/play/[packSlug]/plant/[skill]/page.tsx`, forest seed tiles.

## Constraints

- shadcn + tokens only; the diagram follows the theme (light and dark) without per-component `dark:` overrides.
- Mermaid is loaded lazily on the client (`*-lazy.tsx` exemption), never in the initial bundle.
- A diagram always has a text alternative (its node list / title) for screen readers (ui-design §5).
- "Where it breaks" is always visible, never collapsed (accuracy over entertainment).
- Quick checks are normal attempts via `record_attempt`.

## Decided without a question

- Card choice per skill: approved first, then unreviewed, then by item id; flagged/rejected never shown (CONTEXT.md Playable).
- A skill without any card skips straight to its diagram, or to the checks if it has neither.
- 3 checks, approved questions first.

## Success Criteria

- [ ] SC-1: For D5.S1 the page shows the Temperature card (simply, in nature, where it breaks, contrast, sources) and its diagram. Proof: browser.
- [ ] SC-2: Mermaid renders client-side, readable in light and dark; the initial JS of `/today` doesn't include Mermaid. Proof: browser in both themes + build output.
- [ ] SC-3: The diagram exposes its title and nodes to assistive tech. Proof: a11y snapshot.
- [ ] SC-4: Answering 3 checks with ≥ 1 correct turns the seed into a sprout on the forest. Proof: browser on local stack.
- [ ] SC-5: Release gate (ROADMAP §4): a colleague who has never seen the app joins from an invite on the hosted URL, plants 3 seeds, wins a Duel, sees trees grow. Proof: browser on production (needs MF-0004).
- [ ] SC-6: Card selection is a pure function with a unit test (approved > unreviewed > none). Proof: utils test.
- [ ] SC-7: Component-split gate, typecheck, lint, tests, build pass. Proof: receipt.

## Concerns

| # | Collision | Owner | Status |
|---|-----------|-------|--------|
| C-1 | Only 1–3 skills have cards before MF-0014 / H-2; the gate needs 3 planted seeds, so H-2 must deliver ≥ 3 cards by Nov 13. | Coder F | open |

## Out of Scope

- Diagram Builder (after Dec 7), illustrated scenes, animations.

## Open questions

- none.

## Iteration Log

<!-- append-only -->
