---
applied: 2026-11-05
ticket: MF-0026
outcome: pass
causes: missing-context, tooling
actions: memory-update
lesson_keys: tanstack-mutationfn-context-arg, local-port-3001-taken
---
## Numbers
(no `pnpm ticket:retro`; from the task files. Written inline: one iteration, normal tier, no review.)
- tier normal, 1 iteration, goal_status complete-pending-manual-commit
- freeze: 2 acceptance files (8 cases: 2 red, 6 green regression locks shown red against a never-release variant)
- concerns: C-1 (Seed Planting owner), C-2 (shared hook) resolved by the user at the checkpoint

## Went right
- The SC-3 release locks were proven non-vacuous by removing the release and watching all 6 fail. -- keep:
  already is: gsd-goal-loop Stage 2b (run a case against the opposite behaviour before trusting a green).
- The suspected Server Action break (TanStack's context argument) was checked in the browser instead of
  being "fixed" on a guess; it was a false alarm and stayed out of scope. -- keep: already is: Stage 3b
  "pre-existing breakage you trip over is noted, not fixed".

## Went wrong
- First acceptance draft used `toHaveBeenLastCalledWith(objectContaining(...))` on a mocked `mutationFn`;
  TanStack 5.105 passes a second context argument, so it could never match. Caught before the freeze
  (one extra RED run). cause: missing-context.
- Port 3001 served another app (Docmost), so the browser check needed a dev server on 3002 and the magic
  link's `redirect_to` rewritten to it. cause: tooling.

## Actions (at most two)
1. memory-update: `windows-dev-environment.md`: add the 3001-occupied fallback (dev on 3002, rewrite the
   Mailpit link's `redirect_to`, read the link via `http://127.0.0.1:54324/api/v1/message/<id>`) and the
   TanStack `mutationFn` second-argument test trap (assert `mock.lastCall?.[0]`).

## Not worth changing
- Wrote the shared hook and its test in one step rather than test-first; the hook is 10 lines and its test
  was run before any consumer used it.

## Applied
- 2026-11-05 memory-update applied (windows-dev-environment.md, two bullets).
- Held: nothing.
