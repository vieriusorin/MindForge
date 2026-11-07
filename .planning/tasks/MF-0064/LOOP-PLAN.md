---
phase: 1-planning
ticket_id: MF-0064
status: executing
verdict: IN_PROGRESS
started_at: "2026-11-07"
resume_with: /gsd-goal-loop
---

# Loop Plan — Iteration 1

## Discovery summary

- Precedent: Seed Planting (MF-0010): page `src/app/(app)/play/[packSlug]/plant/[skill]/page.tsx` (RSC: auth,
  `listPacks` 404, parallel reads, `planSeedPlanting`, `toPlayableQuestions` with deployed hashes) → client
  `SeedChecks` (hook `use-seed-checks.ts`: `useMutation(answerSeedCheck)`, `useSingleFlight`, focus refs) over the
  shared `QuestionCard`. The lesson copies that shape and reuses `planSeedPlanting` for the card/diagram choice
  (one owner for "which card and diagram a skill shows").
- Grading: `answerSeedCheck` / `answerWalkQuestion` → `gradeAnswer` (`src/server/attempts/grade-answer.ts`) →
  `record_attempt`. The lesson adds `answerLessonItem` of the same shape (D-L9); no new RPC call.
- Forest: the map reads `getMyCourseForest` → `courseForest` (countable attempts + storm proof). The lesson page
  uses the same read for stages (confusable choice, Seed vs met); the close page replays with `courseForest` twice.
- Course map entry: `startNodeHref` + `NODE_MODE_LABEL` (`src/features/course-map/utils/start-node.ts`), consumed by
  `map-node.tsx` and `next-step-banner.tsx`; the water reason copy is `nextStepReason` in
  `components/course-map/utils.ts` (its test asserts it does not promise the walk).
- Cross-feature: the lesson page passes the card (`NatureCardView`, seed-planting) and the diagram
  (`DiagramFigure`) as server-rendered slots (react-feature-architecture: compose at the page).
- Gates on touched paths: `gate:planning` (owns ⊂ agent scopes, every changed file owned), Biome (`src/components/ui/**`
  formatted only), frozen MF-0062 files (C-1).

## Symbols changed

- `startNodeHref` — plant and walk modes now return /play/<pack>/lesson/<skill>.
- `NODE_MODE_LABEL` — plant and walk become "Lesson".
- `nextStepReason` — the water line names the lesson instead of the Daily Walk.
- `QuestionCardProps` — gains optional showRationales (default true; no caller changes).

## Frozen files this will re-freeze

Approval: orchestrator under U-2 (C-1). History recorded in `.planning/tasks/MF-0062/FROZEN.json`.

| File:line | Change (new expected value) | Reason |
|---|---|---|
| `src/features/course-map/__tests__/mf-0062-start-node.acceptance.test.ts:19-25` | `startNodeHref(plant 1.2)` → `"/play/ccdv-f/lesson/1.2"`; `a b/c` → `"/play/demo/lesson/a%20b%2Fc"` | the MF-0062 contract exists for MF-0064 to retarget it (D-L2) |
| `src/features/course-map/__tests__/mf-0062-start-node.acceptance.test.ts:28-35` | walk → `"/play/ai-capabilities/lesson/x"`; duel unchanged `"/play/ai-capabilities/duel"` | same; closes MF-0062 REVIEW finding 2 |
| `src/features/course-map/__tests__/mf-0062-start-node.acceptance.test.ts:54-64` | `NODE_MODE_LABEL` toEqual `{ plant: "Lesson", walk: "Lesson", duel: "Scenario Duel" }`; routes list `["lesson","[skill]","page.tsx"]`, `["duel","page.tsx"]`, `["storm","boss","[domain]","page.tsx"]` | a link must name what it opens (REVIEW note 4) |
| `src/features/course-map/components/course-map/__tests__/mf-0062-course-map-view.acceptance.test.tsx:150-157` | link-name regex `/^(Lesson\|Scenario Duel): /`; names `["Lesson: System prompts", "Lesson: Few-shot examples", "Lesson: Output formats"]` | labels follow `NODE_MODE_LABEL` |
| `…/mf-0062-course-map-view.acceptance.test.tsx:160-171` | `"Lesson: System prompts"` → pathname `/play/ccdv-f/lesson/2.1`; `"Lesson: Output formats"` → `/play/ccdv-f/lesson/2.3`; `"Scenario Duel: Agent loops"` unchanged | retarget |
| `…/mf-0062-course-map-view.acceptance.test.tsx:186, 192, 204-207` | Start pathname `/play/ccdv-f/lesson/2.1`; title "Start opens the lesson for it"; Start pathname `/play/ai-capabilities/lesson/c.1` | retarget |

`pnpm ticket:collisions MF-0064` lists these two files for `startNodeHref` / `NODE_MODE_LABEL`; the other MF-0062
frozen files (`mf-0062-course-map`, `mf-0062-map-parity`, `mf-0062-map-link`) were read: they assert `nodeMode`,
`nextStep`, `courseMap` and the sidebar, none of which change.

## SC coverage

| SC | Steps | Proof |
|----|-------|-------|
| SC-1, SC-2 | 1 | `src/engine/lesson/__tests__/mf-0064-lesson-plan.acceptance.test.ts` |
| SC-3 | 1 | `src/engine/memory/__tests__/mf-0064-next-review.acceptance.test.ts` |
| SC-4 | 1 | `src/engine/lesson/__tests__/mf-0064-lesson-outcome.acceptance.test.ts` |
| SC-5 | 4, 5 | `src/features/lesson/__tests__/mf-0064-node-entry.acceptance.test.ts` + re-frozen MF-0062 files |
| SC-6 | 2, 3 | `src/features/lesson/components/lesson-player/__tests__/mf-0064-lesson-player.acceptance.test.tsx` |
| SC-7 | 3 | `src/features/lesson/components/lesson-close/__tests__/mf-0064-lesson-close.acceptance.test.tsx` |
| SC-8 | 4, 7 | browser + `pnpm build` |
| SC-9 | 7 | ladder, gates, evidence |

## Steps

1. Engine. `src/engine/memory/replay.ts`: extract the card replay into a module-private helper shared with the new
   `src/engine/memory/next-review.ts` (`nextReviewAt`: galloping + binary search over whole days on the same
   `get_retrievability`; null when no successful recall). `src/engine/lesson/`: `planLesson` (card/diagram from
   `planSeedPlanting`; recall order wrong-last → unseen → least recent; ≤ 4 options; confusable = nearest earlier
   met skill; Seed vs met order; `maxReasks = max(0, 12 − steps)`), `reaskQuestionIds`, `lessonProgress`,
   `lessonOutcome` (two `courseForest` replays, counts since `since`, `nextReviewAt` on countable attempts, change
   word by stage rank). Inner tests: `lesson-progress.test.ts`, `plan-lesson.test.ts` (multi-wrong order, empty
   forest skill), `next-review.test.ts` lives in the frozen file.
2. `src/features/lesson/actions.ts`: `answerLessonItem` (exists as a thin action; keep it).
3. Feature UI. `src/components/ui/collapsible.tsx` (`pnpm dlx shadcn@latest add collapsible`). `QuestionCard`
   `showRationales` prop (+ a test case). `src/features/lesson/`: `types.ts` (`PlayerStep`), `utils/to-player-steps.ts`
   (plan → DTO with deployed hashes and skill names; tested), `search-params.ts` (`since` parser, loader,
   `lessonDoneHref`), `components/lesson-player/` (view + `hooks/use-lesson-player.ts` + `utils.ts` (`withReasks`,
   `guessLine`, `STEP_META`) + `components/` step pieces; exhaustive switch over `PlayerStep["kind"]`),
   `components/lesson-close/` (Server Component view + `utils.ts`: change line, score line, review line). Tests:
   `utils.test.ts` per utils, `use-lesson-player.test.tsx` (error path, skip guess, single flight).
4. Pages. `src/app/(app)/play/[packSlug]/lesson/[skill]/page.tsx` (auth → 404 → reads → `planLesson` →
   `toPlayerSteps` → `LessonPlayer` with card/diagram slots, `startedAt` = server now) and `…/done/page.tsx` (auth →
   404 → nuqs `since` → `lessonOutcome` → `LessonClose`); both under `<Suspense>` with skeletons; `error.tsx` beside
   the player like `plant/[skill]`.
5. Course map. `start-node.ts` retarget + labels; `nextStepReason` copy and its inner test; inner `start-node.test.ts`
   and `course-map.test.tsx` literals; re-freeze the two MF-0062 files (table above).
6. Orchestrator: `CONTEXT.md` (**Lesson** entry; Course map line), `.claude/rules/ui-design.md` installed list (+
   `collapsible`, `progress` already present), MF-0062 `FROZEN.json` history.
7. Orchestrator: TEST ladder, browser (db + web lock), LOOP-VERIFY, evidence.

## Riskiest step

The close screen's honesty (SC-4/SC-7): "before" must be what the map showed when the lesson started, "after" what it
shows now. Both go through `courseForest`, and the parity test compares `after` with `courseForest` on the same
attempts. `since` comes from the player page's server clock while `answered_at` is the DB clock: an attempt made
in the lesson is seconds to minutes after `since`, so skew below that does not move an attempt across the line;
recorded as a Not verified residual. No write binds to versioned content beyond the existing `contentHash`
(MF-0032) sent by `gradeAnswer` callers: the player sends each item's deployed hash as rendered.
UI predicates that gate a write: "Check answer" disabled while pending / answered; the server refusal when the UI is
bypassed is unchanged (`record_attempt` grades every call; a double submit is MF-0067's idempotency, and
`useSingleFlight` keeps one call per click as in MF-0026). The guess step has no server call to bypass.

## Rejected options

- GET Route Handler + TanStack query for the close figures: no read route exists in the repo (F-8) and the close data
  is a first render; an RSC page is the rule's answer.
- Client-side replay of new answers for "after": not real (client clock, no countable/spoiled filter).
- Reusing `answerSeedCheck` across features: wrong copy ("fresh set of checks"), and a feature component should not
  import another feature's action; MF-0067 touches one more thin action instead.
- A pack-declared confusable link: a pack schema change (existing kinds only).
- Changing `nodeMode` / `NodeMode`: re-freezes MF-0062's engine oracle for no gain (brief: retarget via
  `startNodeHref` only).

## Verify

- `pnpm typecheck && pnpm lint && pnpm test`, `pnpm gate:planning`, `pnpm gate:workspace`, `pnpm build`.
- Frozen hashes: MF-0064 6/6 unchanged; MF-0062 3 unchanged + 2 re-frozen with history.
- browser: local stack, dev-seed account, `next dev -p 3003`: a course-pack lesson end to end, close screen,
  `ccdv-f` Water first → lesson; dark + 375 px.

## Tasks

```json tasks
[
  { "id": "T1", "title": "engine: planLesson, reaskQuestionIds, lessonProgress, lessonOutcome, nextReviewAt + inner tests", "agent": "service-builder",
    "owns": ["src/engine/lesson/**", "src/engine/memory/next-review.ts", "src/engine/memory/replay.ts",
             "src/engine/memory/index.ts", "src/engine/memory/__tests__/next-review.test.ts"],
    "depends_on": [], "closes": ["SC-1", "SC-2", "SC-3", "SC-4"],
    "done_when": ["pnpm exec vitest run src/engine/lesson src/engine/memory", "pnpm typecheck"],
    "context": ["skill:typescript-strict", "skill:tdd", "file:src/engine/content/plan-seed-planting.ts", "file:src/engine/path/course-forest.ts"] },
  { "id": "T2", "title": "answerLessonItem thin action", "agent": "service-builder",
    "owns": ["src/features/lesson/actions.ts"],
    "depends_on": [], "closes": ["SC-6"],
    "done_when": ["pnpm typecheck"],
    "context": ["file:src/features/seed-planting/actions.ts"] },
  { "id": "T3", "title": "lesson feature UI: player, close view, Why? collapsible, QuestionCard prop", "agent": "ui-builder",
    "owns": ["src/components/ui/collapsible.tsx", "src/components/question-card/**",
             "src/features/lesson/types.ts", "src/features/lesson/search-params.ts", "src/features/lesson/utils/**",
             "src/features/lesson/components/**", "src/features/lesson/__tests__/**"],
    "depends_on": ["T1", "T2"], "closes": ["SC-6", "SC-7"],
    "done_when": ["pnpm exec vitest run src/features/lesson src/components/question-card", "pnpm typecheck"],
    "context": ["skill:server-client-components", "skill:client-data-tanstack-query", "skill:react-client-patterns", "skill:ui-shadcn", "skill:nuqs-typescript-zod", "file:src/lib/forest-display.ts", "file:src/lib/format-utc-date.ts"] },
  { "id": "T4", "title": "lesson and close pages", "agent": "ui-builder",
    "owns": ["src/app/(app)/play/[packSlug]/lesson/**"],
    "depends_on": ["T3"], "closes": ["SC-5", "SC-8"],
    "done_when": ["pnpm typecheck", "pnpm build"],
    "context": ["skill:nextjs-data", "skill:server-client-components", "file:src/app/(app)/play/[packSlug]/plant/[skill]/page.tsx"] },
  { "id": "T5", "title": "course map retarget through startNodeHref + re-freeze MF-0062 files", "agent": "ui-builder",
    "owns": ["src/features/course-map/utils/start-node.ts", "src/features/course-map/components/course-map/utils.ts",
             "src/features/course-map/__tests__/**", "src/features/course-map/components/course-map/__tests__/**"],
    "depends_on": ["T4"], "closes": ["SC-5"],
    "done_when": ["pnpm exec vitest run src/features/course-map src/features/lesson"],
    "context": ["file:.planning/tasks/MF-0062/FROZEN.json"] },
  { "id": "T6", "title": "CONTEXT.md Lesson entry, ui-design installed list, MF-0062 FROZEN history", "agent": "orchestrator",
    "owns": ["CONTEXT.md", ".claude/rules/ui-design.md", ".planning/tasks/MF-0062/FROZEN.json"],
    "depends_on": ["T5"], "closes": ["SC-9"],
    "done_when": ["pnpm gate:planning"],
    "context": [] },
  { "id": "T7", "title": "TEST: ladder, browser, LOOP-VERIFY, evidence", "agent": "orchestrator",
    "owns": [".planning/tasks/MF-0064/LOOP-VERIFY.md", ".planning/tasks/MF-0064/**",
             ".planning/evidence/MF-0064.md", ".planning/evidence/MF-0064/**"],
    "depends_on": ["T6"], "closes": ["SC-8", "SC-9"],
    "done_when": ["pnpm typecheck", "pnpm lint", "pnpm test", "pnpm gate:planning", "pnpm gate:workspace", "pnpm build"],
    "context": [] }
]
```
