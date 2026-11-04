---
ticket_id: MF-0022
tier: normal
stage: intake
builds_on: [MF-0009, MF-0010, MF-0012]
last_iteration: 0
goal_status: reserved
---

> Drafted 2026-11-04 by MF-0012 (user decision C-1). Not started.

## Objective

**Today.** The Walk (`use-walk-session.ts`) and Seed Planting guard "Check answer" only with
`mutation.isPending`. TanStack notifies observers on a later tick, so two clicks before the re-render
both call the action and record two attempts. MF-0012 closed this for the Duel with an `isInFlight`
ref (`src/features/duel/components/duel-session/hooks/use-duel-session.ts`), proven by
`mf-0012-duel.acceptance.test.tsx` SC-1.

**End state.** Every practice mode records one attempt per double click. Consider hoisting the guard
into a shared hook once the third consumer exists (react-client-patterns rule 9).

## Open questions

- Seed Planting is Coder D's (KICKOFF): coordinate ownership before touching it.
