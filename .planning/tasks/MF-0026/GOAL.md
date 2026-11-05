---
ticket_id: MF-0026
tier: normal                      # client guard on two practice modes; no schema, no figures
stage: handoff
branch: feat/MF-0026
builds_on: [MF-0009, MF-0010, MF-0012]
last_iteration: 1
goal_status: complete-pending-manual-commit
---

> Renumbered MF-0022 → MF-0026 on 2026-11-04 by MF-0014 (user decision C-2: a merge had concatenated this file with MF-0022's original ticket). Drafted 2026-11-04 by MF-0012 (user decision C-1).
> Claimed 2026-11-05 on `feat/MF-0026` from `main` @ 5ca20b7. Baseline: `pnpm typecheck` 0, `pnpm lint` 0
> (574 files), `pnpm test` 130 files / 592 tests; `main` CI `success` on 5ca20b7.

## Objective

**Today.** The Walk (`use-walk-session.ts`) and Seed Planting (`use-seed-checks.ts`) guard "Check answer"
only with `mutation.isPending`. TanStack notifies observers on a later tick, so two clicks before the
re-render both call the action and record two attempts. MF-0012 closed this for the Duel with an
`isInFlight` ref (`use-duel-session.ts:48`, proven by `mf-0012-duel.acceptance.test.tsx` SC-1); the
Cuckoo copies the same ref (`use-cuckoo-session.ts:47`).

**End state.** Every practice mode that records an attempt per "Check answer" records exactly one per
double click, and a failed answer can still be retried.

## Affected

- **Roles:** learners playing The Walk and Seed Planting.
- **Surfaces:** `src/features/walk/components/walk-session/hooks/use-walk-session.ts`,
  `src/features/seed-planting/components/seed-checks/hooks/use-seed-checks.ts`; with C-2, a shared hook
  and the Duel and Cuckoo hooks.

## Constraints

- No server, schema or action change (the client guard is the scope; server idempotency is not).
- react-client-patterns: the guard lives in the hook, not the view; hoist on the second consumer (rule 9).
- Frozen tests stay unedited: MF-0012 (Duel) and the Cuckoo acceptance stay green.

## Constraints → how met

- Client only → the guard is a ref set synchronously in `submit` and released in `onSettled`.
- Rule 9 → C-2 (the user picks: copy the ref, or hoist one hook used by all four modes).
- Frozen tests → run unchanged in SC-4.

## Decided without a question

- Storm is out: `answer_storm_question` stores the learner's current choice per storm question and the
  attempt is made at finish (MF-0013), so a double click does not add an attempt.
- Release on `onSettled` (success, `ok: false` and network error alike), as in the Duel, so a failed
  answer can be retried (SC-3).
- Toggling an option stays guarded by `isPending` (a toggle records nothing).

## Success Criteria (frozen 2026-11-05)

- [x] SC-1: The Walk: two `submit()` calls in one act (before a re-render) call `answerWalkQuestion` once,
  and the verdict shows. Proof: acceptance test (hook, `renderHookWithProviders`).
- [x] SC-2: Seed Planting: the same for `answerSeedCheck`. Proof: acceptance test.
- [x] SC-3: In both modes, after an answer settles with `ok: false` or a network error, the next
  `submit()` calls the action again; after "Next", the next question's `submit()` calls it again.
  Proof: acceptance test.
- [x] SC-4: The Duel and Cuckoo frozen acceptance files pass unedited; `pnpm typecheck`, `pnpm lint`,
  `pnpm test` exit 0. Proof: receipt.

## Concerns

| # | Collision | Owner | Status |
|---|-----------|-------|--------|
| C-1 | Seed Planting is the Coder D seat's (MF-0010 `track: G`); the draft says coordinate before touching it. | user | resolved 2026-11-05: include Seed Planting |
| C-2 | Rule 9 says hoist on the second consumer; Walk + Seed make four copies of the same ref. Hoisting means also editing the Duel and Cuckoo hooks (their frozen tests prove no regression). | user | resolved 2026-11-05: one shared hook for all four |

## Out of Scope

- Server-side de-duplication of attempts; Storm; the toggle guard.

## Decided by the user

- 2026-11-05: C-1 → Seed Planting included. C-2 → one shared hook in `src/lib` (unit-tested), used by
  the Walk, Seed Planting, Duel and Cuckoo hooks. SCs frozen as drafted.

## Open questions

- none.

## Iteration Log

<!-- append-only -->
- 2026-11-05 it-1: claimed on `feat/MF-0026`; DESIGN drafted; baseline green.
- 2026-11-05 it-1: acceptance frozen (SC-1/SC-2 red, SC-3 locks shown red vs never-release); BUILD
  useSingleFlight + 4 hooks; SC-1..SC-4 PASS, browser Walk 1 POST per double click; receipt DONE (b63a9071…). Hand-off.
