---
ticket: MF-0054
outcome: pass
causes: missing-context
actions: skill-edit
lesson_keys: freeze-stub-breaks-existing-callers, concurrency-test-needs-ordering-witness, rerunnable-writer-surviving-state, shared-devtools-browser
applied: 2026-11-06
---
## Numbers
(`pnpm ticket:retro` is not wired; counts taken by hand from GOAL.md, FROZEN.json, LOOP-VERIFY.md, REVIEW.md.)
- Tier high-risk, `last_iteration: 0`, FROZEN.json `history: []` (no re-freeze), 6 acceptance files frozen RED, identical on a 2nd run (DB files).
- Final tree: typecheck 0, lint 0, test 742/742 (152 files), test:db 120/120, build 0, gate:planning 0. Baseline was all green, so no pre-existing failure.
- Reviewer: approve, 0 blocking, 3 notes. One post-review CSS-only change was not re-read by the reviewer (LOOP-VERIFY says so).
- Receipt PASS, tree 9ffe0b3764d4. Not verified: Today page and mobile width in the browser, sub-ms ordering, T0 CI fix until the next CI run.
- Session token metrics: not available.

## Went right
- SC-4's concurrency case was proven non-vacuous: the advisory-lock line was removed in the local DB, the case went RED (`expected [ …(4) ] to deeply equal [ …(3) ]`), then the migration was restored and 9/9 passed. The one thing that could not happen before FREEZE (the function did not exist) was recorded as a deviation in the Iteration Log and LOOP-VERIFY, not hidden. — keep: already is (`concurrency-test-needs-ordering-witness` from an earlier ticket; SKILL.md opposite-behaviour rule).
- DESIGN re-derived the facts from source and found that `group_members.pinned_at` would show co-members your pins and would change the frozen MF-0005 grants allow-list. It moved storage to `private.group_pins` and showed the reversal at the checkpoint, so no frozen file was re-frozen. — keep: already is (Stage 3 frozen-collision grep, `frozen-shape-collision-grep-in-plan`).
- The DESIGN preflight line names all five gate commands with results or "not run: <reason>" (the MF-0053 gate's first real use). — keep: already is (`gate:planning` design-preflight check).
- The browser check found two defects the tests and the reviewer did not: the inline message squeezing the `/groups` row (the reviewer had flagged it as a note, the browser confirmed it) and the `empty:hidden` fix that removed the live region from the a11y tree. Both were fixed and re-checked in the browser. — keep: already is (ui-design a11y rules, `feedback-browser-verification.md`).
- `now()` being constant inside a transaction was found in PLAN (`clock_timestamp()`), not in BUILD. The 2 ms seed gap for JS ms precision was found in BUILD and recorded in the Iteration Log. — keep: already is in this ticket's migration and LOOP-PLAN; one-off, see below.

## Went wrong
- Two Stop-gate reds between FREEZE and plan approval. The freeze stub for `primaryPackSlug`, an EXISTING function whose signature changed, throws `not implemented`. The non-frozen `src/server/packs/__tests__/primary-pack.test.ts` went red, and so did `pnpm dev` (layout and Today both call it) until T2, through the whole high-risk plan-approval wait. LOOP-PLAN line 41 says that test was "already adapted at freeze" and line 85 says "it already compiles", so compiling was checked and runtime was not. SKILL.md Stage 2b says "For a module the plan will create, add a typed stub that throws". It says nothing about a function that already has callers. cause: missing-context.
- The inline status message squeezed the `/groups` row. REVIEW.md note 2 named it at `pin-toggle.tsx:23-29` and asked for a mobile-width check. The first fix (`empty:hidden`) hid the live region from the a11y tree. It was caught in the browser snapshot. This is covered by the shared `ui-design.md` a11y rule and a browser check that already exists; no cause beyond a two-step fix. cause: none.
- A first temp script used top-level await under tsx/CJS and failed silently into a misleading "1 passed" run of the real function. It was caught from the output. One occurrence, and there is no static check for what a scratch script does. cause: tooling (once).

## Actions (at most two)
1. skill-edit: `/Users/sorinvieriu/Projects/mind-forge/.claude/skills/gsd-goal-loop/SKILL.md`, Stage 2b, the sentence at line 222 ("For a module the plan will create, add a typed stub that throws `new Error("not implemented")`; read a data file the plan will create at runtime, never `import` it (a missing import is a compile error, not the SC's red)."). Append directly after it:
   `A stub for an EXISTING export (one with callers, or one that a non-frozen test or the dev server loads) must not throw: add the new shape beside the old one (a new name, or a new parameter that defaults to the old behaviour) and have the acceptance test import the new name, so the old callers stay green until BUILD switches them. After writing stubs, run the whole \`pnpm test\` once and require that the only reds are the frozen files; a non-frozen red now is a plan error (MF-0054: the throwing \`primaryPackSlug\` stub reddened \`primary-pack.test.ts\` and broke \`pnpm dev\` for the whole plan-approval wait).`
   Would have saved: two Stop-gate reds, a broken dev server across the high-risk approval wait, and the LOOP-PLAN claim "it already compiles" that checked the wrong thing.

## Not worth changing
- Gate option for the stub trap: a static check cannot know which exports are stubs, and the non-frozen red is already caught by the Stop gate the moment it happens. The fix belongs at the point the stub is written (Stage 2b), not in a script.
- The post-review CSS-only change was not re-read by the reviewer: LOOP-VERIFY stated it explicitly and the change touches no auth, delete or privileged path. Rule `review-fix-delta-reread` exists from an earlier ticket; this was a conscious, recorded exception.
- JS reading `pinned_at` at ms precision against the DB's µs (reviewer note 1), `now()` versus `clock_timestamp()`, and the 2 ms seed gap: specific to a timestamp-ordered pin list. The seed workaround and the reviewer note are recorded in the ticket; no pattern yet. If a second ticket orders rows by a DB timestamp in TS, draft a gate or an RPC rank.
- `unpinGroup` mapping 42501 to the "pin" message (reviewer note 3): unreachable in normal use, left as a note.
- Top-level await under tsx/CJS in a scratch script: once, caught by reading the output.
- Token usage: no session metrics. The ticket was a migration with three SECURITY DEFINER functions, a concurrency test, a seed change, a UI toggle and six frozen files, so its size explains the cost.
- Memory: checked `feedback-verify-derived-facts.md` and `feedback-browser-verification.md`. Neither covers the stub trap, and both are already correct; nothing to delete.

## Applied
- 2026-11-06 skill-edit (additive) applied: `.claude/skills/gsd-goal-loop/SKILL.md` Stage 2b, the "stub for an EXISTING export must not throw" paragraph appended after the typed-stub sentence.
- Held: nothing. No memory changes proposed; no gate proposed.
