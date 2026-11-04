---
phase: 1-verification
ticket_id: MF-0009
status: complete
verdict: PASS
started_at: "2026-11-04"
completed_at: "2026-11-04"
resume_with: /gsd-goal-loop
---

# Verification — Iteration 1

Receipt bound to `src/` tree hash `12a14ebc37a80530e5fbf087d9b143927694176f9f34ce2e6d2b8f654dca358f`
(`git diff HEAD -- src` + untracked `src/` files, sorted). No project `ticket:verify` script
exists; default VERIFY used. Logs: `.planning/tasks/MF-0009/logs/`.

## RED at freeze (Stage 2b)

`src/engine/memory/__tests__/mf-0009-plan-walk.acceptance.test.ts` — sha256 `604f1765…`, unchanged
since freeze (re-checked after BUILD and at the receipt). Run twice at freeze:

```
   9 Error: not implemented
      Tests  9 failed (9)
```

## Baseline (DESIGN, before any change)

typecheck 0 · lint 0 · test 30 files / 103 tests pass.

## Receipt

```
typecheck exit=0
lint exit=0        Checked 237 files in 46ms. No fixes applied.
test exit=0        Test Files 36 passed (36) · Tests 133 passed (133)
build exit=0       ├ /play/[packSlug]/walk  └ ◐ /play/[packSlug]/walk  └ ◐ /today
```

## SC verdicts

| SC | Verdict | Evidence |
|---|---|---|
| SC-1 | PASS | frozen acceptance file 9/9 green; `select.test.ts` (refactored helper) green |
| SC-2 | PASS | browser, walker fixture: banner "Start today's walk" → `/play/ccdv-f/walk`, "3 trees need water · 5 questions". Hand-derived from the fixture before looking: water D1.S2, D1.S1, D2.S1 (3); new D2.S5; strengthen D1.S3 (5) |
| SC-3 | PASS | walker attempts 4 → 9 after a 5-step walk (one row per step, DB-graded, each the never-seen `.q2`, D2.S5 `.q1`); `/today` then shows "2 trees need water · 6 questions", Sapling 0→1, Sprout 3→2, Fading items gone from Up next |
| SC-4 | PASS | browser, healthy fixture (all 25 skills recalled 1 h ago): `/today` "Your forest is healthy today." + "Play a Duel instead" → `/play/ccdv-f/duel`; `/play/ccdv-f/walk` h2 "Your forest is healthy today", link "Play a Duel", no walk |
| SC-5 | PASS | browser keyboard-only (arrows, Space, Tab, Enter) through all 5 steps: `status` region present and empty on load, filled with the verdict after Check and focused; after Next focus on the new stem `H2`, status empty; after Finish focus on "Today's walk is done". `walk-session.test.tsx` 8/8 asserts the same plus double-click → 1 call, server error, network error |
| SC-6 | PASS | receipt above |

## Bug found in TEST (regression test shown red first)

Browser: on question 2, Tab landed on option C (Radix kept the roving tab stop from question 1).
Test "SC-5: each new question starts with keyboard focus on its first option" added, run against
the unfixed code:

```
     × SC-5: each new question starts with keyboard focus on its first option, not the last pick 46ms
Expected element with focus:
Received element with focus:
      Tests  1 failed | 7 passed (8)
```

Fix: `key={question.id}` on `QuestionCard` → `Tests 8 passed (8)`.

## Not verified

- Screen-reader output (VoiceOver/NVDA) itself; verified via the a11y tree (`status`, live=polite)
  and focus, not by listening.
- Light theme of the new banner row (checked in dark only).
- `error.tsx` boundaries were not triggered (no fault injection).
