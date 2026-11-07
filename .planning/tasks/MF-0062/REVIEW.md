---
verdict: approve
verdict_detail: APPROVE (after delta re-review)
reviewed_hash: 3ddad9d800cf4145d70c527bc5539b3cd211d104dbcb8ddbfc7843d4bc1aa0f3
reviewed_at: 2026-11-07T09:52:42Z
---

# MF-0062 review (fresh context)

Scope read: GOAL.md (D-1..D-6, F-1..F-8, SC-1..SC-9, edge tables M/N/C), LOOP-PLAN.md, LOOP-VERIFY.md,
FROZEN.json, `.planning/evidence/MF-0062.md`, full diff vs HEAD 660f1c1 plus untracked files.

Checks run by the reviewer:
- `pnpm exec vitest run src/engine/path src/features/course-map src/features/app-shell src/features/paths`:
  25 files / 164 tests passed (the 5 MF-0062 acceptance files, the MF-0052/0054/0058 sidebar files and the inner tests).
- Frozen hashes: 5/5 match FROZEN.json.
- `pnpm typecheck` 0, `pnpm lint` 0 (786 files).
- MF-0060 checker (PLAN-RULES self-check) against this worktree: `gate:planning: 69 ticket folders checked, ok`.
  Ownership checked by hand too: every changed file is in a task's `owns` (T1 engine → service-builder, in scope;
  T2/T3 `src/features/**`, `src/app/**` → ui-builder, in scope; `CONTEXT.md` → orchestrator T4); the two
  acceptance files outside `owns` are FROZEN.json files (exempt).
- Reviewed hash equals the receipt's code tree prefix `c2495b676dd8`.

What holds: every figure (done / total / fading / next) comes from `courseMap` in `src/engine/path`, the view only
formats it; total and fading come from `summarizeForest`, `isDone` from `GROWN_STAGES` (one owner each). Thresholds
are not restated: N8/N9 go through the real `treeStage`. The page reads per-user data inside `<Suspense>`, nothing
`use cache`, the same `getMyCourseForest` as the path page. The feature has no `"use client"` and no `src/server`
import; props are plain DTOs. shadcn components, tokens only (`text-white/*` only inside `bg-hero`), lucide icons,
no emoji, status always in words. Every linked route exists (`plant/[skill]`, `walk`, `duel`, `storm/boss/[domain]`).
The frozen tests use literal expected values from the SC tables and prove intent, not just letter.

## Findings

1. **[should-fix] Banner touch targets below 40 px.**
   `src/features/course-map/components/course-map/components/next-step-banner.tsx:46` (`size="lg"` = `h-9`, 36 px) and
   `:68` (default size = `h-8`, 32 px). The node and checkpoint buttons carry `min-h-10`, but the banner's Start (the
   one primary action on the screen) does not. ui-design.md §5: "Interactive targets are ≥ 40px on touch layouts".
   Scenario: at 375 px (SC-8's own viewport) the main call to action is a 36 px target. Fix: add `className="min-h-10"`
   to both banner buttons.

2. **[should-fix] "Water first → Daily Walk" (and "Next" → Daily Walk) can open a walk that does not contain the named
   skill: the map and the walk rank the same skills with two different rules.**
   `src/engine/path/next-step.ts:17-20` picks the water target in `summarizeForest` focus order (wilting, then weight,
   then code). `planWalk` (`src/engine/memory/plan-walk.ts:40-41, 78, 82, 103`) ranks water by `weight × (1 − R)`,
   puts attempted-but-never-recalled Seeds in the same water bucket, and caps the walk at 10; its one "new" item is the
   *heaviest* unseen skill (`:84-86`), not the first Seed in map order.
   Scenarios: (a) a lapsed learner on `ccdv-f` with more than 10 skills needing water (wilting skills plus failed-only
   Seeds): the heaviest wilting skill with R 0.84 scores lower than lighter skills with R 0.3, falls past slot 10,
   and the banner says "Water first: X … The Daily Walk waters it before anything new"
   (`components/course-map/utils.ts:58`) while the walk never shows X. (b) a non-plantable Seed as Next
   (`nodeMode` M2 → walk) opens a walk whose "new" item is a different, heavier Seed. (c) N7 with a non-plantable
   Sprout (M4 → walk) and nothing else to water or plant: `planWalk` returns an empty walk (head empty), a dead end.
   F-3 notes the cap but nothing mitigates it. Fix options (any one): soften the banner copy so it does not promise
   the skill is in the walk; or file the follow-up for MF-0064 (skill-scoped lesson) and record the known gap in the
   evidence "Not verified". (b)/(c) are rare today if every shipped skill is plantable; worth one line confirming that.

3. **[note] Today's top focus and the map's Next can name different skills.**
   With nothing wilting, Today's briefing `topFocus` is `summarizeForest(...).focus[0]`
   (`src/app/(app)/today/page.tsx:128`) = the heaviest Seed, while the map's Next is the first Seed in pack order
   (`next-step.ts:22-24`). On an exam pack with uneven weights a learner sees "focus: Y" on Today and "Next: X" on the
   map. This is a GOAL decision ("Next on the first Seed in map order") and SC-5 binds only the water case, so not a
   defect; flagging because the two screens give two "what to study next" answers. Consider a CONTEXT.md line saying
   which wins, or a follow-up.

4. **[note] Skill-named links open pack-wide modes.**
   `components/course-map/components/map-node.tsx:41` names the link "Scenario Duel: <skill>" / "Daily Walk: <skill>",
   which reads (for a screen reader especially) as a skill-scoped session; `/duel` and `/walk` take no skill and may
   not include it. Required by SC-6 wording and acknowledged in F-2 (MF-0064 retargets via `startNodeHref`), so leave
   as is; it becomes honest once MF-0064 lands.

5. **[note] `/play/no-such-pack` returns HTTP 200.**
   `src/app/(app)/play/[packSlug]/page.tsx:24` calls `notFound()` inside `<Suspense>`, so the status is already
   streamed as 200 and the not-found UI renders in place. This matches every sibling `/play/*` page
   (`walk/page.tsx:26`, `duel/page.tsx:28`), and LOOP-VERIFY records it honestly. Acceptable for consistency; SC-8's
   "is a 404" is met as the rendered 404 page, not the status code. A project-wide fix (pack check before the
   Suspense boundary) would be its own ticket.

6. **[note] An empty forest renders "Every skill is at Sapling."**
   C6 makes `courseMap` of a pack with no skills return `next: done`; `next-step-banner.tsx:59-62` then claims every
   skill is at Sapling for 0 skills. No shipped pack has zero skills (F-7), so unreachable today.

7. **[nit] Done-state banner bends the start-node contract.**
   `next-step-banner.tsx:70-74` calls `startNodeHref({ skillCode: "", mode: "duel" })`. When MF-0064 retargets a
   mode to a skill-scoped URL (the stated purpose of the contract), this call yields a URL with an empty skill. A
   `packDuelHref(packSlug)` (or reuse of an existing duel href helper) would keep the contract node-only.

8. **[nit] Conditional class by template literal.**
   `map-node.tsx:17` builds `className` with a template string; the repo convention is `cn(...)` from `@/lib/utils`.

9. **[nit] Stale LOOP-PLAN front matter.**
   `.planning/tasks/MF-0062/LOOP-PLAN.md:4-5` still says `status: executing`, `verdict: IN_PROGRESS` while GOAL.md is
   `complete-pending-manual-commit` and LOOP-VERIFY is PASS. The gate passes; tidy for the record.

No blocking findings: approve. Findings 1 and 2 are cheap to fix before merge (1 is a two-class edit; 2 can be a
copy change plus an evidence line).

## Delta re-review (orchestrator, 2026-11-07, tree 3ddad9d800cf4145d70c527bc5539b3cd211d104dbcb8ddbfc7843d4bc1aa0f3)
- 1: `min-h-10` on both banner buttons, asserted in `course-map.test.tsx`. Resolved.
- 2: "Water first" copy no longer promises the Walk waters that skill (`utils.test.ts` asserts it); the Walk-ranking gap is
  recorded in evidence Not verified and handed to MF-0064 (skill-scoped lesson). Resolved for this slice.
- 7: done banner uses `packDuelHref`, so `startNodeHref` only sees real nodes (tested). 8, 9 applied.
- Notes 3 (Today vs map Next when nothing fades) → MF-0064 input; 5 (404 under Suspense returns 200, all /play pages) →
  follow-up. Frozen hashes 5/5 unchanged. Verdict: APPROVE.
