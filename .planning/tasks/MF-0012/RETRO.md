---
ticket: MF-0012
outcome: pass
causes: missing-context
actions: skill-edit, memory-update
lesson_keys: design-preflight-sc-preconditions, shared-devtools-browser, browser-tooling-limits
applied: 2026-11-04
---
## Numbers
No `ticket:retro` script exists; facts read by hand. No REVIEW.md, no token metrics (no median comparison).
- Tier normal, `last_iteration: 0` in the front matter (Iteration Log says iteration 1), `goal_status: complete-pending-manual-commit`.
- Freeze: 3 files (`mf-0012-duel.acceptance.test.tsx`, `mf-0012-back-link.acceptance.test.ts`, `mf-0012-sync-keys.db.acceptance.test.ts`), `history: []` (0 re-freezes), every red recorded with `first_failure` and "same on 2nd run".
- Preflight at DESIGN: 56 files / 213 tests green on a5da410. BUILD followed LOOP-PLAN with no divergence; no BUILD to TEST loop-backs; no frozen-file edits.
- SCs: 7 listed, 7 ticked, SC-6 withdrawn by the user after the checkpoint (conflicted with `server-side.md` §2).
- Diff: 10 tracked files, +296 / -250, plus new files (search-params, utils, 3 acceptance tests, 2 script libs). Follow-ups MF-0022..MF-0025 reserved (renumbered by MF-0014, 2026-11-04: Walk/Seed double-click is MF-0026, learn-the-key is MF-0027).

## Went right
- DESIGN re-scoped the stale 2026-11-03 draft onto MF-0009's shared `QuestionCard` and `gradeAnswer` instead of patching the Duel's own markup, and said so in the GOAL header. — keep: already is, GOAL.md header note and SKILL.md "builds_on" handling.
- The freeze red was inspected per SC (SC-1 "called 2 times", SC-2/3 missing role/name, SC-5 exit 0 with the broken pack registered) and teardown rows were counted (0 fixture rows). — keep: already is, SKILL.md Stage 2b "red must be the SC's own, run twice".
- The DB-touching SC-5 was approved up front: its RED run writes to the local stack, and the GOAL records the fixture and child-first cleanup under "Decided by the user". — keep: already is, SKILL.md Stage 2 preflight (2).
- Two decisions were written down with their reason instead of asked: the ref-based double-submit guard (TanStack notifies observers a tick late) and `role="group"` on the card (ARIA 1.2 forbids naming `generic`). BUILD followed the plan without a divergence. — keep: already is, GOAL "Decided without a question".

## Went wrong
- SC-6 (`import "server-only"` in `fetch-attempts.ts`) was drafted from the MF-0003 review note and confirmed at the checkpoint, although `.claude/rules/server-side.md` §2 names that exact file as an exception (`server-only` throws under Vitest). It surfaced only while writing the acceptance tests, so the user was asked a second time to withdraw a confirmed SC. The SKILL.md preflight covers baseline reds and shared-state wipes but not "does the SC contradict a written rule". cause: missing-context
- The original SC-7 named a "component-split gate" that does not exist (`react-client-patterns.md`: "No gate enforces it yet"). Caught at DESIGN and corrected in "Decided without a question", so cheap, but it is the same class: an SC text naming a check or rule that was not looked up. cause: missing-context
- Browser check: an `evaluate_script` polling loop kept running in the page after the MCP call was stopped with TaskStop (stopping the tool call does not stop page JS) and raced the manual clicks until reload. Next 16 with `cacheComponents` keeps earlier routes as hidden Activity trees, so an unscoped `document.querySelector('main …')` matched hidden elements from the group page. About 6 extra tool calls, no wrong evidence recorded. `feedback-browser-verification.md` covers streaming waits and shared pages but neither of these. cause: missing-context

## Actions (at most two)
1. skill-edit: `/Users/sorinvieriu/Projects/mind-forge/.claude/skills/gsd-goal-loop/SKILL.md`, Stage 2 preflight paragraph (the one starting "Before the checkpoint, preflight each SC's proof."). Append after item (2), before "Then run `grill-with-docs`":
   "(3) For each SC that names a file, a rule, a gate or a script, grep `.claude/rules/` and `package.json` for that name before the checkpoint. If a rule lists the file as an exception, or the gate does not exist, fix or drop the SC text now and record it under "Decided without a question"; do not leave it to BUILD or to acceptance-test writing (MF-0012: SC-6 `server-only` vs `server-side.md` §2; SC-7 "component-split gate")."
   Would have saved: one second user question and the withdrawn-SC rework after the checkpoint, and the wrong SC-7 wording (both recurring under `design-preflight-sc-preconditions`, now seen in MF-0003, MF-0009 and MF-0012).
2. memory-update: `/Users/sorinvieriu/.claude/projects/-Users-sorinvieriu-Projects-mind-forge/memory/feedback-browser-verification.md` — append two bullets after the "Pages stream (Suspense)" bullet:
   "- Stopping an `evaluate_script` call (TaskStop) does not stop the JS it started: a polling loop keeps running in the page and races your clicks until the page is reloaded. Never loop or poll in `evaluate_script`; do one bounded read per call, and reload the page if you had to stop one (MF-0012).
   - Next 16 + `cacheComponents` keeps visited routes in the DOM as hidden Activity trees, so `document.querySelector('main …')` can match an element from a previous page. Scope selectors to the visible card (or use `take_snapshot` uids, which only list what is rendered) (MF-0012)."
   Would have saved: about 6 tool calls of racing clicks and re-queries, and the risk of recording evidence from a hidden tree.

## Not worth changing
- The GOAL front matter says `last_iteration: 0` while the Iteration Log records iteration 1: cosmetic, one ticket, no gate depends on it.
- The 2026-11-03 draft predating MF-0009's shared card: handled by DESIGN re-scoping as the skill intends; the new preflight (3) does not need a separate rule for it.
- No token numbers available, so no token-waste finding. The ticket was medium (Duel migration, shared card role, sync-script validation with a resolve hook) and ran in one iteration.
- `ticket:freeze|verify|retro` scripts still do not exist; the by-hand procedure (LF-normalised hashes) worked again.

## Applied
- 2026-11-04 action 1 (skill-edit, additive): `.claude/skills/gsd-goal-loop/SKILL.md` Stage 2 preflight gains item (3). Applied.
- 2026-11-04 action 2 (memory-update, additive): two bullets appended to `memory/feedback-browser-verification.md`. Applied.
- Held: nothing.
