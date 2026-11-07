---
verdict: approve
verdict_detail: "No blockers. Grading integrity holds (guess is browser-only, every graded answer goes through answerLessonItem → AnswerInput.safeParse → gradeAnswer). Close figures come from engine courseForest replays of the viewer's own RLS-scoped attempts. Re-freezes change only literals. Two should-fix items (a past 'Next review' date beside a Fading badge; a compile-time check that checks nothing) and a few notes and nits, none blocking."
reviewed_hash: 3f8d5d92084317a1f37453132235b522365829002f14f965194df5f1be124a86
reviewed_at: 2026-11-07T10:49:58Z
---

Scope: worktree `mind-forge-MF-0064`, `git diff HEAD` (028a859) plus untracked files, `.planning` excluded from the hash.
Ran: `pnpm typecheck` 0 · `pnpm lint` 0 (833 files) · `vitest run src/engine/lesson src/engine/memory src/features/lesson
src/features/course-map src/components/question-card`: 26 files / 122 tests green (this includes all 6 MF-0064
acceptance files and the 2 re-frozen MF-0062 files) · `pnpm gate:planning` ok (70 folders, rule 2 ran, so no changed
file is unowned) · `pnpm gate:workspace` ok · frozen sha256 (LF): MF-0064 6/6 match and MF-0062 5/5 match the
current FROZEN.json. `pnpm build` was not re-run (the evidence records exit 0).

## Findings

1. **[should-fix]** `src/engine/lesson/lesson-outcome.ts:90-95` with `src/features/lesson/components/lesson-close/lesson-close.tsx:46-54`.
   The close screen can show a **past** "Next review" date beside a "Fading" badge. `nextReviewAt` is the day the tree
   began to fade, measured from the last countable attempt. When nothing was answered on the lesson skill since `since`
   (row O5), and the tree is already fading, that date is in the past. You reach that state in two ways:
   (a) A fading skill whose plan has a card and diagram but no question with 4 or fewer playable options: Continue,
   Continue, then the close screen.
   (b) Reopening a `/done?since=…` URL from history days later.
   Either way the screen reads "Fading · Next review: Nov 3, 2026" on Nov 7. Fix options: show "Review now" when
   `after.wilting` is true, or clamp the date to `now`. The decision belongs in the engine or in `reviewLine`, plus one
   unit test.
2. **[should-fix]** `src/features/lesson/types.ts:18-22`. `PlayerStepKindsMatch` is never used anywhere (grep finds
   only the declaration). When the kinds do not match, the type resolves to `never`, and an unused alias of `never`
   compiles without error. So the "compile-time check" in its comment checks nothing. Adding `true satisfies
   PlayerStepKindsMatch` (or a typed const) makes it real. Today `STEP_META satisfies Record<LessonStepKind, …>` plus
   `STEP_META[step.kind]` catches only one direction: a kind added to `PlayerStep` but missing from the engine.
3. **[note: grading integrity, verified]**
   - The guess step makes no server call: `lockGuess` keeps the pick in `guesses`
     (`use-lesson-player.ts:118-123`).
   - `PlayableQuestion` carries no key and no rationale, and the guess `QuestionCard` gets `feedback={null}`.
   - The graded recall of the same item starts with `chosen` reset (`advance`: `setChosen([])`, `mutation.reset()`),
     so nothing is pre-filled and nothing is revealed before the graded answer.
   - Why? (`why-panel.tsx`) renders only inside `{feedback && …}`.
   - `answerLessonItem` does auth, then `AnswerInput.safeParse` (a strictObject), then `gradeAnswer`, and returns
     `ActionResult`. Its only caller is the `useMutation` path, guarded by single-flight.
4. **[note: re-asks and FSRS]** A re-ask writes a second attempt on the same item in the same session. D-L8 intends
   this and ADR 0005 (Revealed) sanctions it. Probe on ts-fsrs, `enable_fuzz: false`, attempts 1 minute apart:
   - 1 Good: S = 2.307 d. 6 Goods in one session: S = 2.307 d. Same-day repeats add no stability, so a lesson cannot
     push a skill to Sapling.
   - Wrong then right: S = 0.247 d. 6 wrong then 6 re-asks right: S = 0.030 d.
   - A re-ask can still turn a Seed into a Sprout, because it adds a successful recall.

   Side effect the user should know about: one miss on the **confusable** step lapses the *earlier* skill, and the
   re-ask does not undo that. The evidence screenshot `sc-8-close-dark-desktop.png` shows "Steerability … Back to
   Sprout · 1 of 2 correct". This is honest under FSRS, but the lesson can shrink a skill the learner did not choose.
5. **[note: crafted `since`]** `done/page.tsx` replays only `listMyAttempts(user.id, …)` (RLS, own rows), so `since`
   cannot expose another user's data. A crafted `since` can only mislead the viewer about their own forest. For
   example, a future `since` computes "before" as wilting at that future instant, so `changeOf` returns `watered`
   with "0 of 0 correct" (`lesson-outcome.ts:35`).

   A related real-world path is a stale `startedAt`, after a reload or after Back restores an old player. The close
   screen then counts attempts from the first visit, and after a reload "before" already includes the earlier
   answers. Both stay self-only.
6. **[note: clock]** `since` uses the app server clock and `answered_at` the DB clock (residual already recorded in the
   evidence). For a met skill the first step is a graded recall, so the margin is the time the learner takes to answer
   it, a few seconds. No `Date.now()` or `new Date()` without an argument runs in `src/engine/**` or in a client render.
   The pages read `new Date()` after `getCurrentUser()`, the same as the other play pages.
7. **[note]** `src/features/lesson/components/lesson-close/utils.ts:5-8` formats the next review day in UTC without a
   "UTC" label. `src/lib/format-utc-date.ts` appends " UTC". A learner east of UTC whose last answer falls late in the
   UTC day sees a date one day earlier than their local date. `paths/utils/path-display.ts` sets the same precedent.
8. **[note]** `src/engine/lesson/lesson-outcome.ts:48-54`. The "before" replay passes every storm result, including any
   taken after `since`. That only matters for Tree and Ancient (storm proof), so it is negligible for a lesson.
9. **[note: plan limits, verified]**
   - The most steps a plan can have is guess + card + diagram + 6 recalls + confusable = 10. Re-asks get 12 − steps
     (`reaskQuestionIds`, used by the player's `withReasks`).
   - Both recall and confusable items are filtered to 4 or fewer options and to playable state (`orderedItems`).
   - The confusable item comes from an earlier non-Seed skill, so the lesson has at most 1 new concept.
   - `nextReviewAt` reuses the same `scheduler.get_retrievability` and `FOREST_THRESHOLDS.wiltBelowRetrievability`
     as `replayMemory`/`treeStage` (one owner per fact; SC-3 checks agreement to the millisecond).
   - The close screen's "after" forest is `courseForest`, the same call the map uses, and SC-4 tests that parity.
10. **[note: boundary, a11y, shadcn, verified]**
    - Both pages read per-user data under `<Suspense>` with skeleton fallbacks. There is no `use cache`.
    - The card and diagram are server slots. The client receives DTOs only.
    - The views contain no hooks. The hook returns intent-named callbacks and no setters.
    - `collapsible.tsx` is the stock shadcn radix-nova file.
    - Focus moves to the step `<section tabIndex=-1 aria-label>` on each advance, and to the `<output aria-live>` on
      feedback.
    - Progress segments are `aria-hidden`, with the visible text "Step k of n".
    - Buttons are `min-h-10`. Stage changes appear in words (badge text, plus `StageIcon` aria-label).
    - No emoji and no XP, streak or league.
11. **[note]** `.claude/rules/ui-design.md`. LOOP-PLAN task T6 assigns this file to the orchestrator, and gate:planning
    passes. The edit adds `collapsible`, which this ticket installed. It also adds `alert alert-dialog progress
    textarea`, which were already present in `src/components/ui/` (checked). That part is a doc-drift correction
    outside this ticket's scope. It is harmless and makes the installed list true.
12. **[note: SC-6 toMatchObject]** With `toMatchObject`, an extra field in the action input would not fail the test.
    At runtime `AnswerInput` is `z.strictObject`, so an extra field (for example a leaked guess) would make the server
    reject the call. A broken client would fail loudly and could not grade differently. The weakening is the minimum
    MF-0067 needs. The 4th-call assertion checks only `questionId`, which is weak but enough for "the re-ask is graded".
13. **[nit]** `components/guess-step.tsx:27`: "You will meet this question again after the card." is wrong for a plan
    with no card (L4). `use-lesson-player.ts:152`: `guessNote` is looked up by question id for any step, so a re-ask of
    the guessed item repeats "Your guess before the lesson was …".
14. **[nit]** `lesson-player/utils.ts:10`: `isGradedStep` is exported and tested but never used in production code
    (the hook checks `step.kind === "guess"`). That is a YAGNI export.

## Re-frozen files

| File | Previous sha256 | New sha256 | What changed | Weakened? |
|---|---|---|---|---|
| `src/features/course-map/__tests__/mf-0062-start-node.acceptance.test.ts` | `3cf2b235…5e6d` | `20870b9a…5505` | plant and walk hrefs → `/lesson/<encoded skill>`; `NODE_MODE_LABEL` plant and walk → "Lesson"; on-disk route list swaps `plant/[skill]` + `walk` for `lesson/[skill]`; duel and storm unchanged; test titles and header comment | No. Every assertion keeps its matcher (`toBe`/`toEqual`), only literals changed. The old plant and walk routes no longer need to exist (the pages still do). |
| `src/features/course-map/components/course-map/__tests__/mf-0062-course-map-view.acceptance.test.tsx` | `8af04c85…8834` | `7c1d9fe2…94bb1` | link-name regex and names → "Lesson: …"; pathnames → `/play/ccdv-f/lesson/2.1`, `/2.3`, `/play/ai-capabilities/lesson/c.1`; duel link unchanged; one test title | No. Same matchers and same counts, only labels and targets changed. |
| `src/features/lesson/components/lesson-player/__tests__/mf-0064-lesson-player.acceptance.test.tsx` | `6b7af435…7b78c` | `08dcbdfe…5fe03` | first-call assertion `toEqual` → `toMatchObject` (same four literal fields), re-frozen while still red | Minimal. See finding 12: the server's strictObject still rejects extra fields. |

History entries for all three are recorded: MF-0062 `FROZEN.json` (by MF-0064, approval pending under U-2) and
MF-0064 `FROZEN.json`.

## Delta re-review (orchestrator, 2026-11-07, tree 1ad5fb5e35de… per the builder's diffHash recipe)
- Should-fix 1: `reviewLine` returns "Review now: this tree is fading" whenever `after.wilting`; engine test pins that a
  fading tree has `nextReviewAt ≤ now`; RED line in LOOP-VERIFY. Resolved.
- Should-fix 2: `true satisfies PlayerStepKindsMatch` added; drift in either direction fails typecheck (TS1360, probes in
  LOOP-VERIFY). Resolved. Nits (guess copy, guess note on re-ask, UTC label) applied; frozen hashes unchanged.
- Re-freeze of MF-0062 start-node + course-map-view and MF-0064 SC-6: approved by the user 2026-11-07. Verdict: APPROVE.
- Pending before merge: rebase onto MF-0067 and wire `clientAttemptId` into the lesson submit.

## Delta (orchestrator, 2026-11-07, on base 709b938 = MF-0067)
`use-lesson-player.ts` sends `clientAttemptId: attempt.idFor(submissionKey(question.id, chosen))` (:139) and clears it in
`advance()` (:115), the same shape as the Duel/Walk/Seed Planting hooks; three non-frozen hook tests (uuid sent; same id on
retry after a network error; new id on re-ask). Browser read-back: one attempt row per graded answer, id set, none for the
guess. Frozen hashes unchanged. Verdict: APPROVE.
