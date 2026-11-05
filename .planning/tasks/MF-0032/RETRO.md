---
ticket: MF-0032
outcome: pass
causes: wrong-test, known-trap-repeated
actions: skill-edit, gate
applied: 2026-11-04
lesson_keys: concurrency-test-needs-ordering-witness, frozen-shape-collision-grep-in-plan, shared-devtools-browser, parallel-session-coordination
---
## Numbers
(No `ticket:retro` script exists; counts taken by hand from the ticket files.)
- Iterations: 1 (`last_iteration: 0` in GOAL, `iteration: 1` in LOOP-VERIFY). Verdict DONE at tree `4ac92f74`.
- Freeze: 4 MF-0032 acceptance files, 1 user-approved re-freeze (SC-2 DB case). Plus re-freezes of MF-0003, MF-0012, MF-0008 (C-2, found at DESIGN: 2; MF-0008 `:70` found at PLAN: 1).
- Review: 2 passes. First `changes-requested` (1 blocking: vacuous SC-2 case, tree `b350c8d0`), delta re-review `approve` @ `4ac92f74`.
- Receipt: typecheck/lint green; `pnpm test` 390 passed, 12 failed in other tickets' files (MF-0038/0039, untracked, appeared mid-run); `test:db` 55/55; build green.
- SC-8 PARTIAL: browser click-through not run (shared devtools browser held); HTTP-render substitute used.

## Went right
- The fresh-context diff review caught the vacuous SC-2 test that the builder, the freeze RED check and VERIFY all passed. The delta re-review was bound to a recomputed tree hash and scoped to the single changed case. — already is: SKILL.md "review-fix-delta-reread" (MF-0034 retro) and the `reviewed_hash` binding.
- The shared-browser fallback worked as written: at first refusal the SC was marked partial, the HTTP-render substitute ran, and the unseen part was recorded under "Not verified" instead of being promoted to pass. — already is: memory `feedback-browser-verification.md` (last bullet).
- DESIGN's "Decided without a question" and "Edge inputs" tables took the optional-hash choice from the `review_item` precedent and listed the break to the frozen MF-0003/0016/0029 DB tests up front, so the only checkpoint questions were C-1 and C-2. — already is: SKILL.md Stage 1 (edge-input table).
- A baseline preflight recorded the 2 MF-0034 reds before any change, so SC-8 was written as "no NEW failures". The parallel-session reds that showed up mid-run (MF-0038/0039) were attributed in one line instead of being investigated. — already is: SKILL.md Stage 1 baseline rule.

## Went wrong
- The SC-2 DB acceptance test was frozen vacuous. `supabase.rpc()` returns a lazy `PostgrestBuilder` that only sends on `.then`, so the "concurrent" call ran after COMMIT and could not fail for the property it named. The freeze RED check passed it because the function did not exist (`PGRST202`), which is a red for the wrong reason. Evidence: FROZEN.json `history[0].reason`, REVIEW.md first finding. It cost one blocking review, a user-approved re-freeze, a second test:db run and a delta re-review. Cause: wrong-test. The freeze step only asks that a test is red "for the expected reason"; it has no rule for tests that assert an interleaving, where the red-before and green-after are both satisfiable without the interleaving ever happening.
- The MF-0008 `toPlayableQuestion(q)` one-argument call (`mf-0008-schema.acceptance.test.ts:70`) was missed at the DESIGN checkpoint and found at PLAN, which needed a third frozen-file batch. SKILL.md "grep the shape, not the table" was run, but it greps the shape's key names and type name, not the call sites of a function whose signature changes. Same lesson key as MF-0016 (`frozen-shape-collision-grep-in-plan`, collisions found "one per stage"). Cause: known-trap-repeated (rule written, scoped to shape not to signature, and run at the wrong stage for a signature).

## Actions (at most two)
1. skill-edit: `/Users/sorinvieriu/Projects/mind-forge/.claude/skills/gsd-goal-loop/SKILL.md`, Stage 2b — append this paragraph directly after the paragraph that ends "...a second run that fails on leftovers is a fixture defect, not the SC's red.":
   "A test that proves an interleaving (concurrent call, lock wait, torn read, 'before COMMIT') must carry an ordering witness: record where the observed call was answered relative to the other side (for example `isCommittedAtResponse`) and assert it. Awaiting alone is not enough: `supabase.rpc(...)` and `.from(...)` return lazy builders that send nothing until `.then`/`await`, so a call started inside a transaction runs after COMMIT unless it is awaited there. Before FREEZE, run the case once against a variant with the opposite behaviour (the call moved after COMMIT, or the lock removed) and write its result in LOOP-VERIFY under 'RED at freeze'. If it stays green, the case is vacuous. A red caused by a missing function or column is not that proof (MF-0032: SC-2 was frozen green-for-the-wrong-reason and found only in review)."
   Would have saved: the changes-requested review round, one user-approved re-freeze, one full `test:db` rerun and the delta re-review.
2. gate: new ticket (claim the next free number, `goal_status: reserved`) for `scripts/frozen-collisions.mjs`, wired as `pnpm ticket:collisions <ID>` and called by name from SKILL.md Stage 3a (replaces the hand grep in "Contract-widening tickets"). It reads a `## Symbols changed` list in LOOP-PLAN.md (function names whose signature changes, closed-set names, shared type names). It then greps every `**/*.acceptance.test.*` and every path in the `FROZEN.json` of `builds_on` tickets for each symbol and prints `file:line` for any hit not yet listed under "Frozen files this will re-freeze". It exits 1 on an unlisted hit. Pattern it flags for a function: `\b<name>\(` plus `import {…<name>…}`. Real case it would have caught: `toPlayableQuestion` in `src/engine/questions/__tests__/mf-0008-schema.acceptance.test.ts:70` (1-argument call), found at PLAN instead of DESIGN. Run it at DESIGN, when the checkpoint is built. Until the gate exists, nothing else changes in the skill.
   Would have saved: the separate approval round for the MF-0008 re-freeze, and (across MF-0016 and MF-0032) a re-freeze batch per ticket.

## Not worth changing
- `git add -N` to hash new files touched the shared index, then was undone. One slip with no damage; the hash method the review used (`git diff HEAD` for tracked, `cat` for untracked) already avoids it. Write it that way in the evidence, nothing more.
- SC-8 browser click-through unverified. Already handled by the existing HTTP-render rule; the PARTIAL verdict was correct.
- Mid-run reds from MF-0038/0039 acceptance files in `pnpm test`. Parallel-session noise, attributed correctly in the receipt; covered by `parallel-session-coordination` in memory.
- Token use: no metrics available. The only visible waste was the re-freeze and re-review loop, covered by action 1.
- Memory: checked `feedback-browser-verification.md`, `feedback-verify-derived-facts.md`, `project-supabase-migration-rules.md`; none covers lazy builders and none is stale, so no memory add or delete.

## Applied
- Action 1 (skill-edit, additive): applied. `.claude/skills/gsd-goal-loop/SKILL.md` Stage 2b, new paragraph after
  "…a fixture defect, not the SC's red." (ordering witness for interleaving tests; lazy Supabase builders).
- Action 2 (gate): held as a reserved ticket, never built. `.planning/tasks/MF-0043/GOAL.md` (next free number,
  checked across branches). Its `package.json` and SKILL.md edits need the user's approval when built.
