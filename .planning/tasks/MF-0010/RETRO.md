---
ticket: MF-0010
outcome: pass
causes: tooling, missing-context
actions: gate, skill-edit
lesson_keys: tailwind-arbitrary-variant-underscore, goal-status-drift-after-merge, sc-named-test-never-written, jsdom-cannot-prove-css-or-inert
applied: 2026-11-06
---
## Numbers
(`pnpm ticket:retro` is not wired in this repo; facts taken by hand from GOAL.md, LOOP-VERIFY.md, evidence and the session notes.)
- Build T1-T6 landed on main 2026-11-04 (5f706e2); GOAL.md stayed `stage: build / in-progress` for two days; branch had 0 commits ahead of main; issue #41 still "in progress".
- T7 verify and every browser proof had not run until 2026-11-06.
- Browser proof on a seeded local stack found 2 real defects the green unit and acceptance suites missed.
- 1 ui test named by SC-8 was never written during the build; added in the verify pass.
- Plan change at iteration 0 to 1 (React Flow instead of Mermaid, ADR 0003), 3 frozen files re-frozen with recorded reasons.

## Went right
- Browser verification was done on a seeded local stack, in both themes, with a prod build for SC-2. It caught the dark-mode edge-label defect and the focusable attribution link. - keep: already is (CLAUDE.md "pnpm build + browser check" and `feedback-browser-verification.md`).
- The `inert` regression test was seen red first, and the session said plainly that a Tab-order test cannot go red/green in jsdom, so it asserts the inert subtree. - keep: already is (testing.md "a bug fix starts with a failing test"; the jsdom limit is the new part, see Actions 2).
- The SC-8 browser proof needed a fixture (fresh user plus 5 DB-graded `record_attempt` calls so D5.S1 becomes the new seed), and the session built it instead of calling the SC "not verified". - keep: record the recipe in LOOP-VERIFY.md (already there).

## Went wrong
- Tailwind 4 turns `_` in an arbitrary variant into a space, so `[&_.react-flow__edge-text]` never matched the `react-flow__` class names, and dark-mode edge labels drew as black boxes. It passed typecheck, lint and jsdom, and was found only in a browser. cause: tooling (no static check; jsdom cannot compile Tailwind).
- Ticket looked unfinished for two days: the build was on main but GOAL.md said `build / in-progress`, the branch had no commits and the issue said "in progress". The next session had to rediscover that T1-T6 were done and T7 never ran. cause: missing-context (the resume step does not compare GOAL.md `stage` against `git log main --grep=<ID>`).
- The SC-8 walk ui test named in GOAL was never written in the build, and nothing flagged it until the verify pass. cause: wrong-test (a named test not tracked to a task). Once; the T7 verify caught it, so it is not an action.
- Environment friction: Docker down at first, port 3001 held by another app (3002 used). cause: tooling, already in memory `windows-dev-environment.md` ("port 3001 taken (use 3002)", "Docker for test:db"); not repeated as an action.

## Actions (at most two)
1. gate: new pure check `scripts/lib/tailwind-variant-check.mjs`, wired into the same Stop and CI gate that runs `gate:planning`, with a test next to it. Scan `src/**/*.tsx` (skip `src/components/ui/**`) for a class token matching `\[&[^\]]*_\.[A-Za-z0-9-]*__[A-Za-z0-9-]*` (an arbitrary variant using a bare `_` before a class that contains `__`) and print `<file>: Tailwind turns "_" into a space; write "\_\_" for a literal double underscore in <token>`. It would have flagged the pre-fix `src/components/flow-diagram/flow-diagram.tsx` (`[&_.react-flow__edge-text]`). The test fixtures are that token (flagged) and the `\_\_` form (clean). Would have saved: a browser-only discovery of a defect on a 2-day-late verify pass, and a re-run of the dark-mode proof.
2. skill-edit: `.claude/skills/gsd-goal-loop/SKILL.md`, in the resume/claim step (Stage 0 or the first "resume" paragraph, whichever exists), add one line: `On resume, run \`git log main --oneline --grep=<ID>\`. If commits exist but GOAL.md \`stage\` is still build, set the stage from what is on main, resume at T7 verify, and list every SC whose proof names a test or browser step that has not run. Also check that every test an SC names exists (grep its name).` Also add to `testing-strategy` skill under jsdom limits: `jsdom and user-event ignore \`inert\` and Tailwind never compiles in jsdom. For focus or CSS-selector SCs, assert the attribute or class on the subtree in a ui test and prove the behaviour in the browser (both themes for colour).` Would have saved: the two-day misread of ticket state and the late discovery that SC-8's test was missing.

## Not worth changing
- SC-8 test never written: caught by T7 verify, once; the resume-step line in Action 2 includes the cheap grep, so no separate action.
- Docker down and port 3001 taken: already in `windows-dev-environment.md`.
- ADR 0003 mid-build plan change and three re-freezes: recorded with reasons, user-directed; no process fault.
- Token usage: no session metrics available; the cost is the real size of a diagram feature plus a verify pass that needed a DB fixture.

## Applied
2026-11-06, automatic policy:
- skill-edit (additive), applied: `.claude/skills/gsd-goal-loop/SKILL.md` resume step gains the stale-stage check
  (`git log main --grep=<ID>`, resume at T7, grep every SC-named test); `.claude/skills/testing-strategy/SKILL.md`
  gains "Know what jsdom can't prove" (`inert`, Tailwind).
- gate, reserved, not built: `.planning/tasks/MF-0056/GOAL.md` (Tailwind arbitrary-variant underscore check).
- held: nothing.
