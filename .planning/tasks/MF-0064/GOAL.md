---
ticket_id: MF-0064
title: "Lesson player: step list, segmented progress, feedback with Why?, close screen with real tree changes (slice C)"
tier: normal                      # UI over existing item kinds; no schema, no new write path (grades through gradeAnswer)
stage: handoff
branch: MF-0064
builds_on: [MF-0062]
last_iteration: 1
goal_status: complete-pending-manual-commit
---

> Reserved 2026-11-06 from MF-0062 (learning-path council, split slice). Decisions D-1..D-6 and findings live in
> `.planning/tasks/MF-0062/GOAL.md`; re-derive each fact at pickup (`## Facts`) before asking the user.

## Objective

**Today.** A course-map node (MF-0062) opens a pack-wide mode: a Seed or Sprout opens Seed Planting (card, diagram,
3 checks, no re-ask, no close figures), a fading skill opens the Daily Walk, which may not contain that skill
(MF-0062 REVIEW finding 2: `planWalk` ranks water by weight × (1 − R) and caps at 10). Feedback shows every
rationale inline at once; nothing says what changed in the forest or when to come back.

**End state.** Tapping a Seed, Sprout or fading node opens one **lesson** scoped to that skill:
guess first (ungraded, no attempt) → nature card → diagram → recall questions graded through the existing
`gradeAnswer` / `record_attempt` path with the rationale and citation behind a **Why?** disclosure → one question from
a confusable earlier skill → a re-ask of the items missed in this lesson → a close screen that shows, per skill, the
real tree before and after (from the database's graded attempts, replayed by the engine) and the next review date.
Existing item kinds only. The lesson plan is a pure engine function.

## Affected

- **Roles:** a signed-in learner, on their own memory only (RLS-bound reads). No other member's data.
- **Surfaces:** new routes `/play/[packSlug]/lesson/[skill]` (the player) and `/play/[packSlug]/lesson/[skill]/done`
  (the close screen); the course map's node and banner links (retargeted in `startNodeHref` only); a new
  `src/features/lesson/` feature; new engine module `src/engine/lesson/`; `nextReviewAt` in `src/engine/memory/`;
  an optional `showRationales` prop on the shared `QuestionCard`; shadcn `collapsible` added with the CLI.
  No table, no migration, no new server read.

## Facts (re-derived from source, 2026-11-07)

- F-1 ✓ `startNodeHref` (`src/features/course-map/utils/start-node.ts:21`) is the only node → URL builder; callers are
  `map-node.tsx` and `next-step-banner.tsx`. Its targets and labels are pinned by two MF-0062 frozen files:
  `mf-0062-start-node.acceptance.test.ts` (SC-4 literals, `NODE_MODE_LABEL` toEqual, routes on disk) and
  `mf-0062-course-map-view.acceptance.test.tsx` (link names and pathnames). Retargeting re-freezes both (C-1).
- F-2 ✓ Packs have **no confusable-skill link** (`grep -rni confus src packs docs CONTEXT.md`: no hit). "Confusable
  earlier skill" must be derived (Decided D-L3).
- F-3 ✓ The engine has **no next-review date**: `replayMemory` returns stability and retrievability only
  (`src/engine/memory/replay.ts`). ts-fsrs probe (5.4.2, `enable_fuzz: false`): `get_retrievability` floors elapsed
  days; one Good at 2026-11-01T10:00Z gives S = 2.3065 d, R(+3 d) = 0.8809, R(+4 d) = 0.8580, below 0.85 from +5 d.
  Two Goods one day apart: S = 7.3153 d.
- F-4 ✓ `QuestionCard` renders every option's rationale inline as soon as `feedback` is set
  (`src/components/question-card/question-card.tsx:84`); it has no "Why?" disclosure. shadcn `collapsible` is not
  installed (`src/components/ui/`), `progress` is.
- F-5 ✓ `gradeAnswer` (`src/server/attempts/grade-answer.ts`) is the one grading path; each feature action
  (`answerSeedCheck`, `answerWalkQuestion`) is `auth → AnswerInput.safeParse → gradeAnswer({ userId, ...parsed.data })`.
  MF-0067 adds a client attempt id to that path; a lesson action of the same shape passes parsed input through.
- F-6 ✓ Shipped questions: course packs 6 per skill, all 4 options, single-select; `ccdv-f` 2–3 per skill and 5
  items with 5 options (multi-select). Course packs have 1 card + 1 diagram per skill; `ccdv-f` 1 card, 2 diagrams.
- F-7 ✓ The forest the map shows is `getMyCourseForest` → `courseForest` (countable attempts, storm proof).
  `/play/[packSlug]/lesson` does not exist.
- F-8 ✓ There is no GET Route Handler or `queries.ts` in the repo; reads are RSC (`state-and-data.md` §1).

## Decided by the user (2026-11-06, parallel-run brief)

- **U-1 Merge:** the orchestrator commits, pushes, opens the PR and squash-merges. This session never runs
  `git commit` / `git push` / `gh pr create` / `gh pr merge`.
- **U-2 Approvals:** the orchestrator approves plans and re-freezes; a fresh-context diff-reviewer runs before merge.
  `pnpm db:reset` on the LOCAL stack is allowed under the shared db lock.
- **U-3** MF-0063 = admin-set external chat link. **U-4** MF-0061 = all three packs. (Not this ticket; recorded.)
- **2026-11-07 re-freeze approved by the user** (relayed by the orchestrator): MF-0062 `mf-0062-start-node.acceptance.test.ts` and
  `mf-0062-course-map-view.acceptance.test.tsx` (lesson targets and labels), and MF-0064's SC-6 player test
  (`toMatchObject` for MF-0067's `clientAttemptId`). Recorded in both FROZEN.json histories. C-1 closed.
- D-1..D-6 from MF-0062 stand: honest rewards (no XP, streak, league), DB = guards only, engine decides.

## Decided without a question

- **D-L1 Route** `/play/[packSlug]/lesson/[skill]` + `/done`: "Play" groups a pack's modes (MF-0062). CONTEXT.md gets a
  **Lesson** entry (it wins on naming) and its Course map line changes to "a node opens its lesson".
- **D-L2 Which nodes open a lesson:** `plant` and `walk` modes (Seed, Sprout, any fading node) → the lesson for that
  skill; `duel` (Sapling+ healthy) keeps the pack's Scenario Duel (council: Sapling+ → Duel). `nodeMode` is unchanged;
  only `startNodeHref` and `NODE_MODE_LABEL` move (brief: retarget ONLY through `startNodeHref`). Both lesson modes
  are labelled **Lesson** (the node already says "Fading"/"Water first" in words). This closes MF-0062 REVIEW
  finding 2 and note 4: the link opens a session scoped to the named skill.
- **D-L3 Confusable earlier skill** (F-2): the nearest skill **before** the lesson's skill in pack order (same domain
  first by proximity, crossing into earlier domains) that the learner has already met (stage ≠ seed in the same
  forest the map shows) and that has a playable question of ≤ 4 options. A met skill is not a new concept, so a
  lesson introduces at most 1 new concept (≤ 3, council). None qualifies → no confusable step.
- **D-L4 Guess first** = the first recall item, shown before the card with options and no key. The pick stays in the
  browser (no server call, no attempt, no key revealed); the same item is then asked as the first graded recall and
  its feedback says whether the guess was right. Only for a skill the learner has not recalled yet (a Seed):
  guessing is a pretest for new material; a met skill starts with a graded recall instead (retrieval first).
- **D-L5 Step order.** Seed: guess → card → diagram → recall × n → confusable. Met skill (Sprout+, fading or not):
  recall 1 → card → diagram → recall 2..n → confusable. Re-asks follow at the end.
- **D-L6 Recall items:** the skill's playable questions (practice review states, MF-0007) with ≤ 4 options, ordered
  last-answered-wrong first, then never answered (file order), then least recently answered; at most
  `LESSON_RECALL_TARGET = 6`. A skill with fewer items gives a shorter lesson.
- **D-L7 Limits (council):** ≤ 4 options (items with more are skipped), ≤ 12 interactions including re-asks
  (`LESSON_MAX_INTERACTIONS`; re-asks fill only what the plan leaves), ≤ 1 new concept. 8 is reached by every
  course-pack skill (Seed with no confusable: 1 + 1 + 1 + 6 = 9; met skill with none: 1 + 1 + 6 = 8); a thinner
  skill (`ccdv-f`, 2–3 items) gives fewer, recorded as an edge row. 5–8 min is a design target the step caps proxy;
  it is not measured (Not verified).
- **D-L8 Re-ask:** each recall or confusable item answered wrong in this lesson is asked once more at the end, in the
  order missed, deduplicated, capped at `12 − planned steps`; a wrong re-ask is not re-asked again; the guess never
  counts. Re-asks are graded attempts (the key was revealed by the learner's own graded answer: ADR 0005 Revealed).
- **D-L9 Grading:** a new thin `answerLessonItem` action in `src/features/lesson/actions.ts` with the exact shape of
  `answerSeedCheck` (`AnswerInput` → `gradeAnswer`), called only through `useMutation` in the player's hook. No new
  RPC call; MF-0067 changes one action and one hook here.
- **D-L10 Close screen is an RSC page** (`/done?since=<ISO>`, nuqs loader): it reads the learner's attempts again and
  the engine replays them (`lessonOutcome`): before = attempts answered before `since` as of `since`, after = all
  attempts now, both through `courseForest` (the map's recipe, so the close screen and the map agree). Shown: the
  lesson's skill first, then every other skill of the pack answered since `since`, in pack order. `since` is the
  player page's server time; a missing or invalid `since` redirects to the lesson. No GET route / TanStack read
  (F-8, "data the first render needs → RSC").
- **D-L11 Next review date** = the instant the tree starts to fade: the first whole day after the last countable
  attempt at which the replayed card's retrievability drops below `FOREST_THRESHOLDS.wiltBelowRetrievability`
  (searched with the same ts-fsrs `get_retrievability` the forest uses, so it agrees with `treeStage` to the ms).
  A Seed (no successful recall) has none: "a seed does not fade".
- **D-L12 Change words** come from the engine: `grew` (stage rank up), `watered` (same stage, was fading, now not),
  `shrank` (stage rank down), `same`.
- **D-L13 Segmented progress** = one shadcn `Progress` per step (aria-hidden) plus the text "Step k of n"; figures
  from engine `lessonProgress`. Total grows when a re-ask is added.
- **D-L14 Why?** = shadcn `Collapsible` (added with the CLI), closed by default, holding every option's rationale
  and the item's citation link. `QuestionCard` gains `showRationales` (default `true`, so every other mode is
  unchanged).

## Success Criteria

- [x] SC-1: `planLesson({ skillCode, forest, content, review, attempts })` returns the ordered steps per edge table
  L1–L12 (kinds and item ids as literals). Proof: oracle `src/engine/lesson/__tests__/mf-0064-lesson-plan.acceptance.test.ts`.
- [x] SC-2: Limits hold for every L-row plan: each question step has ≤ 4 options; `steps.length + maxReasks ≤ 12`;
  at most 2 distinct skills, and the confusable skill is never a Seed; the guess item is the first recall item.
  `reaskQuestionIds({ plannedCount, missedIds })` follows rows R1–R4. Proof: same oracle file.
- [x] SC-3: `nextReviewAt(attempts)` returns `2026-11-06T10:00:00.000Z` for one correct answer at
  2026-11-01T10:00Z (F-3), `null` for no attempts or only wrong ones, and agrees with `treeStage(replayMemory(...))`:
  not wilting 1 ms before, wilting at the instant. Proof: `src/engine/memory/__tests__/mf-0064-next-review.acceptance.test.ts`.
- [x] SC-4: `lessonOutcome({ pack, attempts, review, stormResults, skillCode, since, now })` returns, per skill (rows
  O1–O6), before / after `TreeState`, the change word, answered and correct counts since `since`, and
  `nextReviewAt`; after equals `courseForest(...)` on all attempts (parity with the map). Proof:
  `src/engine/lesson/__tests__/mf-0064-lesson-outcome.acceptance.test.ts`.
- [x] SC-5: Retarget + the MF-0062 gap. `startNodeHref` maps `plant` and `walk` to `/play/<pack>/lesson/<encoded
  skill>`, `duel` stays `/play/<pack>/duel`; `NODE_MODE_LABEL` = `{ plant: "Lesson", walk: "Lesson", duel:
  "Scenario Duel" }`; the lesson and done routes exist on disk. For a fading skill (the "Water first" node), the
  lesson its Start link opens recalls **that** skill: every recall step's item belongs to it. Proof:
  `src/features/lesson/__tests__/mf-0064-node-entry.acceptance.test.ts` + the re-frozen MF-0062 files (C-1).
- [x] SC-6: The player (RTL, action and router mocked at the facade): card and diagram advance with Continue; the
  guess step says it is not graded and calls no action; a correct answer shows "Correct!", the rationale and
  citation only after **Why?** is pressed; the recall of the guessed item says "Your guess before the lesson was
  right." or "… was not the answer."; a wrong answer adds a "Try again" re-ask at the end that is graded again;
  the confusable step names its earlier skill; progress reads "Step k of n"; the last Next navigates to
  `/play/<pack>/lesson/<skill>/done?since=<startedAt>`; an empty plan shows "Nothing to learn here yet" and a link to
  the map. Proof: `src/features/lesson/components/lesson-player/__tests__/mf-0064-lesson-player.acceptance.test.tsx`.
- [x] SC-7: The close view, given a `LessonOutcome`: per skill the before → after stage words ("Seed → Sprout",
  "Still a Sprout", "Watered: Sprout", "Back to Sprout"), "k of n correct", "Next review: <Mon D, YYYY>" or "No
  review date: a seed does not fade", a link "Back to course map" to `/play/<pack>`; no "XP", "streak", "league".
  Proof: `src/features/lesson/components/lesson-close/__tests__/mf-0064-lesson-close.acceptance.test.tsx`.
- [x] SC-8: Screen. On the local stack as the dev-seed account: a course-pack Seed node's lesson walked end to end
  (guess, card, diagram, a wrong answer re-asked, Why?), the close screen shows the real change (Seed → Sprout and a
  next review date); the `ccdv-f` "Water first" node opens a lesson on that skill; light, dark and 375 px with no
  horizontal scroll; `pnpm build` exit 0. Proof: browser, screenshots in `.planning/evidence/MF-0064/`.
- [x] SC-9: Nothing else moves. Every other acceptance file passes unedited (only the two MF-0062 files in C-1 are
  re-frozen, with history); `pnpm typecheck && pnpm lint && pnpm test`, `pnpm gate:planning`, `pnpm gate:workspace`,
  `pnpm build` exit 0; evidence has "See it yourself".

### Edge-input table: `planLesson` (SC-1, SC-2)

Fixture: skills A1, A2, A3 in domain A, B1 in domain B (pack order A1, A2, A3, B1); target per row.

| # | Input | Steps (kinds) | Decided by |
|---|---|---|---|
| L1 | target A2 a Seed; card, diagram, 7 playable questions (q1..q7); A1 a Sprout with questions | guess(q1), card, diagram, recall q1..q6, confusable(A1) | D-L4, D-L5, D-L6 |
| L2 | target A2 a fading Sprout, same items | recall(q1), card, diagram, recall q2..q6, confusable(A1) | D-L5 |
| L3 | as L1, no diagram | guess, card, recall × 6, confusable | brief edge |
| L4 | as L1, no card | guess, diagram, recall × 6, confusable | brief edge |
| L5 | as L1, only 2 questions | guess(q1), card, diagram, recall q1, q2, confusable; `maxReasks` = 12 − 6 = 6 | brief edge, D-L7 |
| L6 | target A1 (first skill), or every earlier skill a Seed | no confusable step, `confusableSkill` null | brief edge, D-L3 |
| L7 | every item's last attempt correct ("all mastered"), A2 a Sapling | recall order = least recently answered first; 6 served | brief edge, D-L6 |
| L8 | item order: q3 last wrong, q5 never answered, others correct at different times | q3, then unseen (file order), then least recent | D-L6 |
| L9 | q2 flagged, q4 rejected, q6 with 5 options | q2, q4, q6 never served | MF-0007, D-L7 |
| L10 | no card, no diagram, no playable question | `steps` = [] | brief edge |
| L11 | target B1; A3 a Seed, A2 a Sprout | confusable = A2 (nearest met, skipping the Seed A3, across the domain) | D-L3 |
| L12 | target A2 a Seed vs a fading Sprout (L1 vs L2) | only the Seed has a guess step | brief edge |

### Edge-input table: `reaskQuestionIds` (SC-2)

| # | Input | Result | Decided by |
|---|---|---|---|
| R1 | no misses | [] | D-L8 |
| R2 | misses q3, q1, q3 | [q3, q1] (miss order, deduplicated) | D-L8 |
| R3 | plannedCount 10, misses q1..q4 | [q1, q2] (cap 12 − 10) | D-L7 |
| R4 | plannedCount ≥ 12 | [] | D-L7 |

### Edge-input table: `lessonOutcome` (SC-4)

| # | Input | Shown | Decided by |
|---|---|---|---|
| O1 | Seed, one correct answer after `since` | Seed → Sprout, `grew`, 1 of 1 correct, next review = `nextReviewAt` | D-L10..12 |
| O2 | Seed, only wrong answers after `since` | Still a Seed, `same`, 0 of 2, next review null | D-L11 |
| O3 | Sprout fading at `since`, one correct after | Sprout, not fading, `watered` | D-L12 |
| O4 | Sapling (S ≥ 3 d), one wrong after | stage drops (sapling → sprout), `shrank` | D-L12 |
| O5 | no attempt after `since` | only the lesson skill, `same`, 0 of 0 | D-L10 |
| O6 | attempts after `since` on the lesson skill and on an earlier skill | lesson skill first, then the earlier skill (pack order) | D-L10 |

## Constraints → how met

- Existing item kinds only → questions, cards, diagrams; no pack schema change, no `check:packs` run needed.
- Figures from the engine → `planLesson`, `reaskQuestionIds`, `lessonProgress`, `lessonOutcome`, `nextReviewAt`;
  views only format. Close screen parity with the map: both through `courseForest` (SC-4).
- Grading only through the existing layer (MF-0067 in parallel) → one action calling `gradeAnswer`, one hook (D-L9).
- Guess records no attempt → no server call at all on the guess step (SC-6 asserts the action is not called).
- MF-0066 adds a step kind → `LESSON_STEP_KINDS` is a closed `as const` set; the view renders through an exhaustive
  `switch` with a `never` default and a `satisfies Record<LessonStepKind, …>` label map.
- MF-0065 adds confidence → the recall footer is one component; nothing in the plan assumes binary grading.
- Per-user data never cached → both pages read under `<Suspense>`, nothing `use cache`.
- Honest rewards (D-3) → no XP, streak or league (SC-7 asserts absence).
- Nothing locked → every node still links; the lesson works for any skill URL, duel nodes keep the Duel.
- shadcn only (`collapsible` via CLI), tokens only, lucide icons, `StageIcon`, status in words.
- Privacy: the learner's own attempts only (RLS); `since` only changes the learner's own view.

## Concerns

| # | Collision | Owner | Status |
|---|-----------|-------|--------|
| C-1 | Retargeting changes literals pinned by two MF-0062 frozen files (F-1). Re-freeze under U-2 with history in MF-0062's FROZEN.json; listed in LOOP-PLAN "Frozen files this will re-freeze". | user (2026-11-07) | resolved: approved; 2 files re-frozen with history; plus MF-0064's own player test (toMatchObject for MF-0067) |
| C-2 | MF-0067 changes the `gradeAnswer` / `AnswerInput` signature in parallel. This ticket adds one caller (`answerLessonItem`) and one `mutate` site (`use-lesson-player.ts`). | MF-0067 | resolved: D-L9 keeps it to one place |
| C-3 | MF-0062 base not yet on main when started; `main` CI on ec06592 (MF-0060) is `failure`, MF-0062 merge run in progress. | orchestrator | noted: not this ticket's code |

## Out of Scope

- Confidence grading (MF-0065), the "order the steps" kind (MF-0066), retry-safe answers (MF-0067), seed personas
  (MF-0068). Duel / Storm nodes. "Trees grown this week" (D-3) figure. A pack-declared confusable link.

## Open questions

- None with a non-agent owner.

## Iteration Log

<!-- append-only -->
- 2026-11-06 reserved from MF-0062.
- 2026-11-07 Stage 0: worktree `/Users/sorinvieriu/Projects/mind-forge-MF-0064`, branch `MF-0064` (based on MF-0062 8695cd6); issue #99 claimed by the orchestrator.
- 2026-11-07 design: Facts F-1..F-8 re-derived (ts-fsrs probe recorded in F-3); SC-1..SC-9; edge tables L1–L12, R1–R4, O1–O6; D-L1..D-L14.
- 2026-11-07 design preflight: `pnpm typecheck` 0 · `pnpm lint` 0 · `pnpm test` 0 (206 files, 1178 tests) · `pnpm gate:planning` 0 (70 folders) · `pnpm gate:workspace` 0 · `pnpm build` not run: baseline at TEST (UI ticket, run before hand-off) · `pnpm test:db` not run: no `supabase/**` or `src/server/**` change · `pnpm db:reset` + `pnpm dev:seed` not run: TEST-stage browser step under the shared db lock (U-2) · `pnpm check:packs` not run: no `packs/**` change · main CI: ec06592 `failure` (MF-0060, orchestrator), MF-0062 merge run in progress.
- 2026-11-07 freeze (2b): 6 acceptance files written from the SCs (stubs throw `not implemented`, views render null), formatted, typecheck + lint green; full `pnpm test`: reds only in those 6 files (39 failed / 1178 passed). `FROZEN.json` written (sha256 over LF content). SC-7 absence half green by design (lock).
- 2026-11-07 plan: LOOP-PLAN.md iteration 1 (tier normal: proceed; re-freeze of 2 MF-0062 files flagged for orchestrator approval, C-1). `pnpm ticket:collisions MF-0064` exit 0 ("no unlisted collisions … across 100 file(s)").
- 2026-11-07 coordinator heads-up: MF-0067 adds a required `clientAttemptId`; grading stays behind one `mutate` in `use-lesson-player.ts`; SC-6 acceptance first-call assertion re-frozen toEqual → toMatchObject (history in FROZEN.json, approval U-2).
- 2026-11-07 build: engine `planLesson`/`reaskQuestionIds`/`lessonProgress`/`lessonOutcome`, `nextReviewAt` (shared `replayCard`); `answerLessonItem`; lesson feature (player, close view, Why? collapsible via shadcn CLI, `QuestionCard.showRationales`); pages `/lesson/[skill]` and `/done`; course map retargeted in `startNodeHref` only; MF-0062 start-node + view files re-frozen; CONTEXT.md Lesson entry; ui-design installed list.
- 2026-11-07 test: typecheck 0 · lint 0 · `pnpm test` 219 files / 1240 tests · gate:planning ok · gate:workspace ok · `pnpm build` 0. Browser on the local stack (db + web lock, `pnpm db:reset` + `pnpm dev:seed`, `next dev -p 3003`, headless Chrome over CDP because the shared devtools browser was held): full ai-capabilities Seed lesson to the close screen (Seed → Sprout, next review), ccdv-f Water first → lesson on that skill, dark/light, 375 px no horizontal scroll.

### Iteration 1

```yaml
phase: 1-complete
verdict: PASS
started_at: "2026-11-07"
completed_at: "2026-11-07"
```

**Result:** PASS: SC-1..SC-9.
**Suggested commit message:** `MF-0064 feat: skill-scoped lesson player with guess first, Why?, re-ask and a close screen of real tree changes`
- 2026-11-07 review fixes (REVIEW.md APPROVE on 3f8d5d92): F1 "Review now" for a fading tree (test RED first), F2 `true satisfies PlayerStepKindsMatch` (drift probes fail to compile), guess copy, no guess note on re-ask (test RED first), UTC label. Frozen files untouched. Ladder green (220 files / 1243 tests, build 0); tree 1ad5fb5e35de.
- 2026-11-07 rebased by the orchestrator onto MF-0067 (709b938); user approved the re-freezes (recorded in both FROZEN.json). Wired `clientAttemptId` (`useAttemptId`, new id per advance and re-ask) with hook tests; ladder green (231 files / 1329 tests, build 0); browser read-back: 2 graded answers → 2 attempts rows with `client_attempt_id`, none for the guess. Tree ab0bcb46c2f8.
