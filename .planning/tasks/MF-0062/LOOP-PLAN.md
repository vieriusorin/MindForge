---
phase: 1-planning
ticket_id: MF-0062
status: complete
verdict: PASS
started_at: "2026-11-06"
resume_with: /gsd-goal-loop
---

# Loop Plan — Iteration 1

## Discovery summary

- Forest stage + wilting: `treeStage` (`src/engine/forest/tree-stage.ts`), forest per pack: `buildForest`, figures:
  `summarizeForest` (focus order wilting → weight → code, :104). Course complete = `GROWN_STAGES` /
  `isCourseComplete` (`src/engine/path/is-course-complete.ts`, MF-0058).
- The learner's forest for one pack: `getMyCourseForest` (`src/server/paths/get-my-course-forest.ts`), used by the
  path page (`src/app/(app)/paths/[pathSlug]/page.tsx`) and Today's path cards. The map uses the same read (parity).
- Plantable skills: `plantableSkills` (`src/engine/content/plantable-skills.ts`), as the group page does
  (`src/app/(app)/groups/[groupId]/page.tsx:220`), from `getPackContent` + `getReviewContext`.
- Modes that exist: `/play/[packSlug]/{plant/[skill],walk,duel,cuckoo,storm/full,storm/boss/[domain]}`. No index page
  at `/play/[packSlug]`. Boss Storm without `exam:` → `StormUnavailable` (MF-0052).
- Precedent shape: MF-0058 path page (RSC container + `PathView` presentational, `buildCourseRows` in `utils.ts`,
  parity test reading page source).
- Gates on touched paths: none (no `scripts/**`, no `supabase/**`, no allowlist). Frozen sidebar tests MF-0052,
  MF-0054, MF-0058 pass literal `AppSidebarProps` → the new prop must be optional.

## Symbols changed

- `AppSidebarProps` gains optional `mapHref` (additive; frozen tests keep their literal props).
- `CourseRow` (MF-0058 path course row) gains a link to the course map; `PathCourseRow` and `buildCourseRows` unchanged.
- The engine path barrel (src/engine/path/index.ts, grepped by hand): additions only (`courseMap`, `nextStep`, `nodeMode`, `NODE_MODES` and their types).

## Frozen files this will re-freeze

None re-freezes. Listed for review, **no re-freeze expected**; each file's assertions were read on 2026-11-06:

- `src/features/app-shell/components/app-sidebar/__tests__/mf-0054-sidebar-label.acceptance.test.tsx`: builds
  `AppSidebarProps` literals without `mapHref` (lines 11, 36, 48) and asserts the Pinned/Recent group label and its
  links only (`groupLinks()` reads the links under that group, line 60). An optional prop that adds a Play item only
  when given leaves every assertion unchanged.
- `src/features/app-shell/components/app-sidebar/__tests__/mf-0058-paths-link.acceptance.test.tsx`: `BASE` without
  `mapHref` (lines 12, 31); asserts the Workspace group's Paths link and tooltip. Unchanged.
- `src/features/app-shell/components/app-sidebar/__tests__/mf-0052-storm-link.acceptance.test.tsx` (read by hand,
  not printed by the scan): asserts the Storm item present/absent by `stormHref`; Play gains an item only with
  `mapHref`. Unchanged.

## SC coverage

| SC | Steps | Proof |
|----|-------|-------|
| SC-1 | 1 | `src/engine/path/__tests__/mf-0062-course-map.acceptance.test.ts` M1–M7 |
| SC-2 | 2 | same file N1–N10 |
| SC-3 | 3 | same file C1–C6 |
| SC-4 | 4 | `src/features/course-map/__tests__/mf-0062-start-node.acceptance.test.ts` |
| SC-5 | 3, 6 | `src/features/course-map/__tests__/mf-0062-map-parity.acceptance.test.ts` |
| SC-6 | 5 | `src/features/course-map/components/course-map/__tests__/mf-0062-course-map-view.acceptance.test.tsx` + `utils.test.ts` |
| SC-7 | 7, 8 | `src/features/app-shell/components/app-sidebar/__tests__/mf-0062-map-link.acceptance.test.tsx` + browser |
| SC-8 | 6, 9 | `pnpm build` + browser (dark, 375 px) |
| SC-9 | 10 | full ladder |

## Steps

1. `src/engine/path/node-mode.ts` — `nodeMode`: wilting → walk; seed/sprout → plant if plantable else walk;
   sapling/tree/ancient → duel.
2. `src/engine/path/next-step.ts` — `nextStep(forest)`: `summarizeForest(forest, Infinity).focus.find(wilting)` →
   water; else first seed in region/tree order → next; else first sprout → next; else done.
3. `src/engine/path/course-map.ts` — `courseMap({ forest, plantable, hasExam })`: nodes with `isDone =
   GROWN_STAGES.has(stage)`, `mode = nodeMode(...)`; per domain doneCount/skillCount/checkpoint; totals and fading from
   `summarizeForest(forest)`; `next = nextStep(forest)`. Inner tests in `src/engine/path/__tests__/course-map.test.ts`.
4. `src/features/course-map/utils/start-node.ts` — `startNodeHref`, `bossStormHref`, `NODE_MODE_LABEL`.
5. `src/features/course-map/components/course-map/` — presentational `CourseMap` (Server Component, no hooks):
   banner (`components/next-step-banner.tsx`) with the single Start link, one `<section aria-labelledby>` per domain
   (`Card`), `<ol>` of nodes (`components/map-node.tsx`: `StageIcon`, name, stage word `Badge`, "Fading", "Done",
   "Next"/"Water first" badge, `Button asChild` link with `aria-label="<mode>: <skill>"`), checkpoint row
   (`components/map-checkpoint.tsx`). `utils.ts`: `STEP_BADGE`, `nextStepCopy`, `atSaplingLine`, `progressLine`,
   `nodeLinkLabel`, `findNextNode`; `__tests__/utils.test.ts` covers each export.
6. `src/app/(app)/play/[packSlug]/page.tsx` — container: auth redirect, `listPacks` 404, reads
   `getMyCourseForest` + `getPack` + `getPackContent` + `getReviewContext` in parallel, `plantableSkills`, `courseMap`,
   header (context line = pack name, h1 "Course map"); `<Suspense>` with a skeleton
   (`src/features/course-map/components/course-map-skeleton/`).
7. Sidebar: `mapHref?` in `types.ts`, a first Play item "Course map" (`Map` icon, tooltip, active on exact path);
   `src/app/(app)/layout.tsx` passes `/play/${packSlug}`.
8. Path page course row: course name links to the map (`courseMapHref` in `src/features/paths/utils/path-display.ts`,
   unit-tested in its existing test file if present, else a new `__tests__`).
9. `CONTEXT.md`: **Course map** entry (orchestrator task T4: docs are outside the role agents' scopes).
10. TEST: full ladder, browser check, LOOP-VERIFY, evidence.

## Riskiest step

Step 2/3 — the next-step decision is the one figure a learner acts on. Wrong order (seed vs wilting, weight tie) or a
different forest than the path page would send learners to the wrong node or show different counts. Caught by the
frozen oracle (N1–N10 with literal skill codes) and the parity file (same `summarizeForest`, same server read). No
write path in this ticket: every link opens an existing mode whose own server actions keep their guards (MF-0032
content-hash binding, `record_attempt` grading). No UI predicate gates a write. No seed/sync/importer.

## Rejected options

- A skill-scoped Walk (`/walk?skill=`): new behaviour in an existing mode; that is MF-0064's lesson.
- Linking checkpoints on course packs to the Boss Storm page: it shows "no mock exam" (MF-0052), a dead end.
- Next = first not-done node in order (sprouts included): points back at a just-planted Sprout, which cannot grow on
  the same day (council ts-fsrs probe) — a futile loop.
- A client component with nuqs state (filter by domain): no ticket need; the map is a Server Component with links.
- Putting `/play/<pack>` into `buildCourseRows`: changes an MF-0058 shape for a URL template.

## Verify

- VERIFY by hand (no `ticket:verify` script): typecheck, lint, test, gates, build; receipt line in LOOP-VERIFY.md
  with `git diff HEAD | shasum -a 256` plus untracked files.
- browser: `/play/ccdv-f`, `/play/ai-capabilities` as the dev-seed author account; light, dark, 375 px.

## Tasks — the graph the orchestrator dispatches; exactly one block

```json tasks
[
  { "id": "T1", "title": "engine: nodeMode, nextStep, courseMap + inner tests", "agent": "service-builder",
    "owns": ["src/engine/path/node-mode.ts", "src/engine/path/next-step.ts", "src/engine/path/course-map.ts",
             "src/engine/path/index.ts", "src/engine/path/__tests__/course-map.test.ts"],
    "depends_on": [], "closes": ["SC-1", "SC-2", "SC-3"],
    "done_when": ["pnpm exec vitest run src/engine/path", "pnpm typecheck"],
    "context": ["skill:typescript-strict", "skill:tdd"] },
  { "id": "T2", "title": "course-map feature: start-node contract + view", "agent": "ui-builder",
    "owns": ["src/features/course-map/**"],
    "depends_on": ["T1"], "closes": ["SC-4", "SC-6"],
    "done_when": ["pnpm exec vitest run src/features/course-map", "pnpm typecheck"],
    "context": ["skill:ui-shadcn", "skill:react-client-patterns", "file:src/lib/forest-display.ts"] },
  { "id": "T3", "title": "map page, sidebar item, path row link", "agent": "ui-builder",
    "owns": ["src/app/(app)/play/[packSlug]/page.tsx", "src/app/(app)/layout.tsx",
             "src/features/app-shell/components/app-sidebar/app-sidebar.tsx",
             "src/features/app-shell/components/app-sidebar/types.ts",
             "src/features/paths/components/path-view/components/course-row.tsx",
             "src/features/paths/utils/path-display.ts", "src/features/paths/utils/__tests__/**"],
    "depends_on": ["T2"], "closes": ["SC-5", "SC-7", "SC-8"],
    "done_when": ["pnpm test", "pnpm build"],
    "context": ["skill:server-client-components", "skill:nextjs-data", "file:src/lib/forest-display.ts"] },
  { "id": "T4", "title": "CONTEXT.md Course map entry; TEST: ladder, browser, LOOP-VERIFY, evidence", "agent": "orchestrator",
    "owns": ["CONTEXT.md", ".planning/tasks/MF-0062/LOOP-VERIFY.md", ".planning/tasks/MF-0062/**",
             ".planning/evidence/MF-0062.md", ".planning/evidence/MF-0062/**"],
    "depends_on": ["T3"], "closes": ["SC-9"],
    "done_when": ["pnpm typecheck", "pnpm lint", "pnpm test", "pnpm gate:planning", "pnpm gate:workspace", "pnpm build"],
    "context": [] }
]
```
