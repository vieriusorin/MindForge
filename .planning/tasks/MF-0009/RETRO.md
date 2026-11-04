---
ticket: MF-0009
outcome: pass
causes: missing-context
actions: skill-edit
lesson_keys: browser-tooling-limits, design-preflight-sc-preconditions
applied: 2026-11-04
---
## Numbers
No `ticket:retro` script exists; facts read by hand. No REVIEW.md, no token metrics (no median comparison).
- Tier normal, `last_iteration: 1`, `goal_status: complete-pending-manual-commit`, handed off 2026-11-04.
- Freeze: 1 file (`mf-0009-plan-walk.acceptance.test.ts`, 9 tests), `history: []` (0 re-freezes), red 9/9 on a stub, hash `604f1765...` unchanged at the receipt.
- Receipt (src tree `12a14ebc...`): typecheck 0, lint 0 (237 files), test 36 files / 133 tests, build 0. Baseline at DESIGN was 30 files / 103 tests, all green.
- SCs: 6 of 6 ticked. SC-2..SC-5 proven in the browser on the local stack with fixture users (attempts 4 -> 9).
- Concerns: C-1, C-2, C-3 all resolved before BUILD (C-2 and C-3 by the user at the DESIGN checkpoint).
- Divergences recorded in LOOP-PLAN: 5. One bug found in TEST (Radix roving tab stop kept across questions), regression test shown red first, fixed with `key={question.id}`.

## Went right
- Baseline run and SC preflight at DESIGN (clean 30/103), so every later red was this ticket's own. Zero pre-existing breakage to untangle, unlike MF-0005. — keep: already is, SKILL.md Stage 2 preflight paragraph (added after MF-0005).
- Every user-owned collision (C-2 "failed seeds are neither due nor new", C-3 "shared card vs MF-0012's Duel rework") was settled at the checkpoint with a recorded option, and the rejected options are in LOOP-PLAN. BUILD never stopped to ask. — keep: already is, GOAL.md Concerns table and LOOP-PLAN "Rejected options".
- The freeze red was inspected, not just counted. A first freeze attempt failed 3 of 9 with `PackValidationError` (inline pack fixtures whose skill weights did not sum to 100), which is a fixture red and not the SC's red. It was fixed before any hash was recorded, and FROZEN.json shows `first_failure: "not implemented (plan-walk.ts stub); same on 2nd run"`. — keep: already is, SKILL.md Stage 2b "A red from a typo or missing fixture is not the SC's red ... run twice".
- SC-2's number was hand-derived from the fixture before looking at the screen ("water D1.S2, D1.S1, D2.S1; new D2.S5; strengthen D1.S3"), so the browser check was a real comparison to an independent value. — keep: already is, memory `feedback-verify-derived-facts`.
- TEST found two things the green suite could not: the sidebar's "Daily Walk · Soon" was still disabled, and the Radix roving tab stop carried across questions. The second got a regression test shown red (1 failed / 7 passed) before the fix. — keep: already is, SKILL.md Stage 3d "a bug the reviewer finds gets its regression test shown RED first".
- Reuse of a precedent: the plan cites `pickSessionQuestions` (`select.ts:20`) and `use-create-group-form.ts`, and the shared `playableQuestions` helper was added so the button's count and the walk page read identical input. — keep: already is, LOOP-PLAN "Divergences".

## Went wrong
- The chrome-devtools MCP refused to save screenshots into the session scratchpad ("not within any of the configured workspace roots"), so screenshots were taken inline and none are kept as evidence. `references/verification.md` §7 (line 95) already says screenshots go under `.planning/evidence/screenshots/`, but the directory does not exist and the line does not say the MCP only writes inside the repo, while the session's own environment advertises the scratchpad as the place for temporary files. cause: missing-context
- Radix `RadioGroup` arrow-key selection does not work under jsdom (Space does), so the walk's component test asserts Space and the arrow keys were only checked by hand in the browser. The trade-off was right, but the fact is nowhere in the repo, so the next Radix component test (MF-0010 Seed Planting, MF-0012 Duel on the shared card) will rediscover it. cause: missing-context
- The first freeze attempt had fixtures that failed pack validation (weights not summing to 100) because each acceptance file builds its own inline pack (`packOf` in the frozen test; `load-pack.test.ts` does the same). Caught by the freeze procedure as designed and costing one cheap run, so not an action. cause: none worth acting on

## Actions (at most two)
1. skill-edit: `/Users/sorinvieriu/Projects/mind-forge/.claude/skills/gsd-goal-loop/references/verification.md`, §7 browser bullet list (the bullet "Record what was seen in words in the evidence file; a screenshot goes under `.planning/evidence/screenshots/` if one helps."). Replace that bullet with these two bullets:
   "- Record what was seen in words in the evidence file. If a screenshot helps, save it under `.planning/evidence/screenshots/<ID>-<topic>.png` (create the directory). The chrome-devtools MCP refuses any `filePath` outside the repo (it rejects the session scratchpad: "not within any of the configured workspace roots"), so do not point it at the scratchpad; without a repo path, take it inline and say so in the evidence file."
   "- Keyboard proofs on Radix controls: under jsdom, `RadioGroup` arrow-key selection does nothing (Space works). Test Space/Tab/Enter in the `ui` test and check arrow keys in the browser, and say so in LOOP-VERIFY "Not verified" or the SC row (MF-0009)."
   Would have saved: one rejected screenshot call and the lost screenshots now, and the next Radix-based ticket (MF-0010, MF-0012) a failing arrow-key test and the time to work out it is a jsdom limit and not a bug.

## Not worth changing
- Inline pack fixtures with weights not summing to 100 (3/9 red for the wrong reason): caught at freeze by the existing "red must be the SC's own, run twice" rule. A shared `packOf` test helper under `src/test/` is a code change worth doing when a third test file needs it, not a retro action.
- Sidebar "Daily Walk" link found still disabled only in TEST: the T5 task owned `src/features/app-shell/**` neither in its `owns` list nor in the plan. One ticket, found by the browser check as intended, and recorded as a divergence; no pattern yet.
- `error.tsx` boundaries not exercised (no fault injection), light theme of the banner not checked, no screen-reader listening: all listed under "Not verified" in LOOP-VERIFY, which is the correct place.
- No token numbers available, so no token-waste finding. The ticket was medium-sized (engine + shared card + walk feature + two pages) with one iteration.
- `ticket:freeze|verify|retro` scripts still do not exist (noted by MF-0004 and MF-0006); the by-hand procedure worked again and the LF hash issue did not recur (this checkout is macOS).

## Applied

- Action 1 (skill-edit, additive) applied: `.claude/skills/gsd-goal-loop/references/verification.md`
  §7, the screenshot bullet replaced by the screenshot-path bullet plus the Radix/jsdom keyboard bullet.
- Held: none. Memory: no change (no memory action proposed).
