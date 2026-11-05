---
applied: 2026-11-05
ticket: MF-0023
outcome: pass
causes: tooling
actions: memory-update
lesson_keys: windows-hook-spawn
---
## Numbers
(no `pnpm ticket:retro` script; taken from the task files. Written inline, not by a fresh `retro` agent:
a 6-file tooling ticket with one iteration and no review findings.)
- tier normal, 1 iteration, goal_status complete-pending-manual-commit
- freeze: 1 acceptance file (12 cases), no re-freeze
- review: none (normal tier); receipt DONE for tree 83680c8f…
- concerns: C-1 (include check-hooks) resolved by the user at the checkpoint

## Went right
- The minimal fix had already shipped with MF-0017 (2c98a53); this ticket only extracted the decision into
  a pure function and froze its behaviour, so no runtime behaviour changed. -- keep: already is: the
  functional-core rule (engineering-principles §1).
- SC-1/SC-2 were proven by feeding the real hooks Claude Code's stdin JSON from a small driver, not by
  waiting for a live turn. -- keep: the driver shape is in LOOP-VERIFY; no new rule needed.

## Went wrong
- `check-hooks.mjs` (CI's hook check) had been broken on Windows since MF-0001 and was only listed in
  memory as "do not rely on it". cause: tooling.

## Actions (at most two)
1. memory-update: `windows-dev-environment.md`: the stop-hook bullet now says both fixes are on `main`
   (stop gate 2c98a53, check-hooks via MF-0023) and that `node scripts/check-hooks.mjs` is usable on Windows.

## Not worth changing
- First SC-1 run picked a file whose acceptance test does not match the co-located naming, so no tests ran;
  rerun with a file that has `__tests__/<name>.test.ts`. Proof-selection slip, caught before recording.

## Applied
- 2026-11-05 memory-update applied (windows-dev-environment.md stop-hook bullet rewritten).
- Held: nothing.
