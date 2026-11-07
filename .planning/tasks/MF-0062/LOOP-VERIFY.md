---
phase: 1-verification
ticket_id: MF-0062
status: complete
verdict: PASS
started_at: "2026-11-06"
completed_at: "2026-11-07"
resume_with: /gsd-goal-loop
---

# Verification — Iteration 1

## RED at freeze (Stage 2b)

Full `pnpm test` at freeze: `Tests  42 failed | 1089 passed (1131)`, every red in the five files below; typecheck and
lint green (runtime reds only).

| SC | Acceptance test | Red reason at freeze (pasted) |
|----|-----------------|-------------------------------|
| SC-1/2/3 | `src/engine/path/__tests__/mf-0062-course-map.acceptance.test.ts` | `Error: not implemented` (nodeMode, nextStep, courseMap), 24 of 24 |
| SC-4 | `src/features/course-map/__tests__/mf-0062-start-node.acceptance.test.ts` | `Error: not implemented` (startNodeHref, bossStormHref), 3 of 4 |
| SC-5 | `src/features/course-map/__tests__/mf-0062-map-parity.acceptance.test.ts` | `Error: not implemented` x5; `Error: ENOENT: no such file or directory, open '…/src/app/(app)/play/[packSlug]/page.tsx'` |
| SC-6 | `src/features/course-map/components/course-map/__tests__/mf-0062-course-map-view.acceptance.test.tsx` | `TestingLibraryElementError: Unable to find an accessible element with the role "region" and name "Agentic architecture"`; `… link and name "Scenario Duel: Agent loops"`; `Unable to find an element with the text: /Every skill is at Sapling/` (stub renders null), 6 of 8 |
| SC-7 | `src/features/app-shell/components/app-sidebar/__tests__/mf-0062-map-link.acceptance.test.tsx` | `AssertionError: expected 'Scenario Duel' to be 'Course map'`; `Unable to find … role "link" and name "Course map"`, 3 of 4 |

Green at freeze by design (regression locks, not the SC's red): SC-4 "every target route exists today" (the routes
already exist; the label table was written in the stub); SC-6 "a pack without an exam shows no checkpoint" and
"no XP, streak or league" (absence cases, green against a null stub); SC-7 "without mapHref no Course map item".

## Verdict per SC

| SC | Verdict | Evidence |
|----|---------|----------|
| SC-1 | PASS | `mf-0062-course-map.acceptance.test.ts` M1–M7 green (7 cases) |
| SC-2 | PASS | same file N1–N10 green, incl. 2.99/3.0 d and R 0.85/0.8499 through `treeStage` |
| SC-3 | PASS | same file C1–C6 + N1 green; `pnpm exec vitest run src/engine/path` → `Tests  87 passed (87)` (+3 inner in `course-map.test.ts`) |
| SC-4 | PASS | `mf-0062-start-node.acceptance.test.ts` 4/4 |
| SC-5 | PASS | `mf-0062-map-parity.acceptance.test.ts` 6/6 (4 forests, Water first = `focus[0]`, both pages import `getMyCourseForest`) |
| SC-6 | PASS | `mf-0062-course-map-view.acceptance.test.tsx` 8/8; `utils.test.ts` covers every `utils.ts` export |
| SC-7 | PASS | `mf-0062-map-link.acceptance.test.tsx` 4/4; MF-0052/0054/0058 sidebar files green unedited; browser: path rows link to `/play/<pack>` |
| SC-8 | PASS (screens as JPEG) | browser on local stack after `pnpm db:reset` + `pnpm dev:seed`, see evidence; `pnpm build` exit 0 (`/play/[packSlug]` ◐ Partial Prerender) |
| SC-9 | PASS | ladder below; frozen hashes 5/5 unchanged |

Targeted run (all touched folders): `Test Files  25 passed (25)` · `Tests  164 passed (164)`.

## Gates and suite

typecheck exit 0 · lint `Checked 786 files … No fixes applied.` · `pnpm test` `Test Files  202 passed (202)` /
`Tests  1143 passed (1143)` · `gate:planning: 69 ticket folders checked, ok` · `gate:workspace: 4 allowBuilds entries, ok`
· `pnpm build` exit 0 · MF-0060 checker (PLAN-RULES self-check) `gate:planning: 69 ticket folders checked, ok`.
Two earlier full runs under load average 51 / 28 (parallel worktrees) had 8 / 3 failures in unrelated files, all
`Test timed out in 5000ms` or `Timeout waiting for worker to respond`; the 3 re-run alone passed (29/29), and the
clean run above at load ~8 is the receipt.

## Receipt

`2026-11-07T09:48:13Z · code tree (git diff HEAD + untracked, excluding .planning) c2495b676dd8 · typecheck 0 · gates 2/2 · lint 0 · test 1143/1143 · build 0 · PASS`

## Review fixes (REVIEW.md APPROVE-WITH-FIXES, reviewed c2495b676dd8)

- F1: `min-h-10` on both banner buttons; `components/course-map/__tests__/course-map.test.tsx` asserts it (2 cases).
- F2: water copy softened (`utils.ts` `nextStepReason`: no promise that the walk contains the skill); `utils.test.ts`
  asserts `not.toMatch(/waters it\b/)`; the ranking/cap gap is recorded below as input for MF-0064.
- F7: done-state banner uses `packDuelHref(packSlug)` (new, tested in `__tests__/start-node.test.ts`), so
  `startNodeHref` stays node-only.
- F8: `cn()` in `map-node.tsx`. F9: LOOP-PLAN front matter `status: complete`, `verdict: PASS`.
- Re-run: typecheck 0 · lint `Checked 788 files … No fixes applied.` · `pnpm test` `Test Files  204 passed (204)` /
  `Tests  1147 passed (1147)` · gate:planning ok · gate:workspace ok · `pnpm build` 0 · frozen 5/5 unchanged.
  Not re-checked in the browser (class and copy only; covered by the RTL tests).

`2026-11-07T09:55:29Z · code tree 3ddad9d800cf · typecheck 0 · gates 2/2 · lint 0 · test 1147/1147 · build 0 · PASS` (post-review)

## Not verified

- Water first / Next → Daily Walk does not guarantee the walk contains the named skill: `planWalk` ranks water by
  weight × (1 − R), pools failed-only Seeds with wilting skills, caps at 10, and picks the heaviest unseen skill as
  "new"; a non-plantable Sprout as Next can open an empty walk. The copy no longer promises it. Input for MF-0064
  (node opens a skill-scoped lesson). In the browser every Seed/Sprout on `ccdv-f` and `ai-capabilities` was plantable
  (all showed Seed Planting), so cases M2/M4 were not seen on those packs; other packs not checked.
- PNG screenshots at `.planning/evidence/MF-0062/sc-<n>-*.png`: the browser MCP may write only under the main
  checkout, which this run must not touch; the screens were captured as JPEG via the tool's own cache and copied in.
- The dev server ran on port 3003, not 3001/3002 (3001 is the user's; 3002 was held by a main-checkout next-server
  since 2026-11-04, left running).
- The bare HTTP status of `/play/no-such-pack` is 200 (not-found streams inside `<Suspense>`, like every `/play` page);
  the signed-in browser shows the 404 page.
- Pre-existing, not this diff: a sidebar hydration mismatch under mobile emulation (`SidebarProvider` desktop vs Sheet
  branch), also on `/paths/claude-developer`; desktop shows no issue.
