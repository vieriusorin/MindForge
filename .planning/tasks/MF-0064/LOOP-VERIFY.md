---
phase: 1-verification
ticket_id: MF-0064
status: complete
verdict: PASS
started_at: "2026-11-07"
completed_at: "2026-11-07"
resume_with: /gsd-goal-loop
---

# Verification — Iteration 1

## RED at freeze (Stage 2b)

| SC | Acceptance test | Red reason at freeze (pasted) |
|----|-----------------|-------------------------------|
| SC-1, SC-2 | `mf-0064-lesson-plan.acceptance.test.ts` | `Error: not implemented` × 20 (planLesson, reaskQuestionIds stubs) |
| SC-3 | `mf-0064-next-review.acceptance.test.ts` | `Error: not implemented` × 3 |
| SC-4 | `mf-0064-lesson-outcome.acceptance.test.ts` | `Error: not implemented` × 7 |
| SC-5 | `mf-0064-node-entry.acceptance.test.ts` | `expected '/play/ccdv-f/plant/D1.S2' to be '/play/ccdv-f/lesson/D1.S2'`; `expected { plant: 'Seed Planting', …(2) } to deeply equal { plant: 'Lesson', …(2) }`; routes absent; Water first: `nextStep` = water A.1 held, `expected '/play/demo/walk' to be '/play/demo/lesson/A.1'` |
| SC-6 | `mf-0064-lesson-player.acceptance.test.tsx` | `Unable to find an element with the text: Step 1 of 6` / radio `/First/` / heading "Nothing to learn here yet" (stub renders null) |
| SC-7 | `mf-0064-lesson-close.acceptance.test.tsx` | `Unable to find … heading "Lesson complete"` / link "Back to course map"; the no-XP half green by design (absence lock) |

Full `pnpm test` at freeze: 39 failed / 1178 passed, reds only in those 6 files.

## Results

| SC | Verdict | Evidence |
|----|---------|----------|
| SC-1 | PASS | lesson-plan acceptance L1–L12 green (20/20 with SC-2) |
| SC-2 | PASS | limits for 7 plans + R1–R4 green |
| SC-3 | PASS | next-review 3/3: `2026-11-06T10:00:00.000Z`, null cases, treeStage agreement at ±1 ms |
| SC-4 | PASS | lesson-outcome 7/7 incl. parity with `courseForest` |
| SC-5 | PASS | node-entry 4/4; re-frozen MF-0062 start-node 4/4 and view 8/8; browser: ccdv-f "Water first: Debugging and Error Handling" Start → `/play/ccdv-f/lesson/D4.S1`, first step "Recall" on that skill |
| SC-6 | PASS | lesson-player 3/3; hook tests 5/5; utils 5/5 |
| SC-7 | PASS | lesson-close 2/2; utils 3/3 |
| SC-8 | PASS | browser (local stack, author account, `next dev -p 3003`): ai-capabilities D3.S1 (Seed) walked guess → card → diagram → 6 recalls (q2 wrong) → confusable D2.S4 → 2 re-asks → close "When properties collide · Seed → Sprout · 6 of 7 correct · Next review: Nov 9, 2026" and "Steerability… · Back to Sprout · 1 of 2 correct"; close and lesson at 375 px `scrollWidth` 375 (no horizontal scroll), dark and light; `/done` without `since` redirects to the lesson; `pnpm build` exit 0 |
| SC-9 | PASS | ladder below; MF-0064 frozen 6/6, MF-0062 5/5 (2 re-frozen, history recorded) |

## Gates and suite

typecheck 0 · lint 0 (`Checked 833 files … No fixes applied.`) · `Test Files  219 passed (219)` · `Tests  1240 passed (1240)` ·
`gate:planning: 70 ticket folders checked, ok` · `gate:workspace: 4 allowBuilds entries, ok` · `pnpm build` exit 0
(routes `/play/[packSlug]/lesson/[skill]` and `/done` partial-prerendered ◐). `pnpm test:db` not run: no
`supabase/**` or `src/server/**` change. `pnpm check:packs` not run: no `packs/**` change.

## Receipt

`2026-11-07T10:33:57Z · tree 108847f39b3b (sha256 of git diff HEAD + untracked code) · typecheck 0 · gates 2/2 · lint 0 · test 1240/1240 · build 0 · PASS`


## Post-review fixes (REVIEW.md approve on 3f8d5d92…, 2026-11-07)

- **F1 (past "Next review" beside Fading).** `reviewLine` (`src/features/lesson/components/lesson-close/utils.ts`) now
  takes the skill and returns "Review now: this tree is fading" whenever `after.wilting`. That equals "date ≤ now":
  `nextReviewAt` is the instant `treeStage` turns wilting (SC-3) and `after` is replayed as of now; the inner engine
  test `src/engine/lesson/__tests__/lesson-outcome.test.ts` pins it (fading, nothing answered since → `after.wilting`
  true and `nextReviewAt ≤ now`). Unit test written first and seen RED after a signature-only refactor:
  `AssertionError: expected 'Next review: Nov 3, 2026 (UTC)' to be 'Review now: this tree is fading'`.
- **F2 (`PlayerStepKindsMatch` checked nothing).** `true satisfies PlayerStepKindsMatch;` in `src/features/lesson/types.ts`.
  Probe 1 (engine gains `"order"` in `LESSON_STEP_KINDS`): `src/features/lesson/types.ts(24,6): error TS1360: Type 'true'
  does not satisfy the expected type 'never'.` Probe 2 (player gains `{ kind: "order" }`): `src/features/lesson/types.ts(25,6):
  error TS1360 …` (plus the view's `never` switch). Both reverted; typecheck 0.
- **Nits.** Guess copy now "You will meet this question again later in the lesson." (true with or without a card).
  The guess note shows on the graded recall only, not on its re-ask (hook test written first, RED:
  `AssertionError: expected 'Your guess before the lesson was not …' to be null`). The review date carries a separate
  "UTC" span (frozen SC-7 text "Next review: Nov 6, 2026" untouched and green).
- No frozen file edited: MF-0064 6/6, MF-0062 5/5 hashes match.

Ladder after the fixes: typecheck 0 · lint 0 (`Checked 835 files … No fixes applied.`) · `Test Files  220 passed (220)` ·
`Tests  1243 passed (1243)` · `gate:planning: 70 ticket folders checked, ok` · `gate:workspace: 4 allowBuilds entries, ok` ·
`pnpm build` 0. Browser not re-run for these copy/decision changes (proved by unit + RTL tests): listed under Not verified.

`2026-11-07T10:54:12Z · tree 1ad5fb5e35de4903e2f1afb8afc049b9e585174e87ae1c2dc0d444c7558b8b8a (diffHash from scripts/lib/ticket-receipts.mjs over git diff HEAD 028a859 + untracked, .planning excluded, 56 files) · typecheck 0 · gates 2/2 · lint 0 · test 1243/1243 · build 0 · PASS`

## MF-0067 wiring (base moved to 709b938, 2026-11-07)

- `use-lesson-player.ts`: `clientAttemptId: attempt.idFor(submissionKey(question.id, chosen))` on the one `mutate`;
  `attempt.clear()` in `advance`, so a re-ask (same item, same answer) is a new submission with a new id.
- Hook tests (non-frozen, `use-lesson-player.test.tsx`): uuid sent; same id on a retry after a network error
  (2 calls, equal ids); three distinct ids for q1, q2 and the re-ask of q1 with the same answer B. Frozen files: no edit;
  SC-6 acceptance green (its `toMatchObject` re-freeze approved by the user 2026-11-07).
- Ladder: typecheck 0 · lint 0 (`Checked 863 files … No fixes applied.`) · `Test Files  231 passed (231)` ·
  `Tests  1329 passed (1329)` · `gate:planning: 70 ticket folders checked, ok` · `gate:workspace: 4 allowBuilds entries, ok` · `pnpm build` 0.
- Browser (db + web lock, `pnpm db:reset` + `pnpm dev:seed`, `next dev -p 3003`, headless Chrome over CDP):
  `/play/ai-capabilities/lesson/D3.S1`, skip guess, Continue × 2, answered q1 (A, correct) and q2 (A, wrong).
  Read-back (`public.attempts`, author, answered since 2026-11-07T11:01:51Z), one row per graded answer, none for the guess:
  `ai-capabilities.D3.S1.q1|t|t|669d4502-7b4c-423e-abf7-622a351ceb29` ·
  `ai-capabilities.D3.S1.q2|f|t|e6d0dc75-f094-4460-830e-d01a44124a9e`.

`2026-11-07T11:02:33Z · tree ab0bcb46c2f83be706a7240454dd1759dee0c7b3508a0d58d91fe6e428ebd321 (diffHash, git diff HEAD 709b938 + untracked, .planning excluded, 56 files) · typecheck 0 · gates 2/2 · lint 0 · test 1329/1329 · build 0 · PASS`

## Not verified

- Post-review fixes (Review now, UTC span, guess copy, re-ask note) not re-checked in the browser; proved by unit/RTL tests.

- 5–8 min lesson length: proxied by the step caps (≤ 12 interactions), not timed.
- `since` (server clock) vs `answered_at` (DB clock) skew: assumed below the seconds a first answer takes.
- Browser run used a headless Chrome driven over CDP from the scratchpad (the shared devtools browser was held by
  another session); the magic link's redirect names :3001 and was followed by hand onto :3003.
- The "light-desktop" screenshots of the walk itself were taken under the headless default (dark); a separate light
  pass covers the close screen and a guess step.

## Verdict: PASS
