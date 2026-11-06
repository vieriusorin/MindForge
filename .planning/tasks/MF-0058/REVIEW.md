---
verdict: approve
reviewed_hash: 0d0edfddbdd06dafd4b5441f1eccc6997aa41ae1652f4509034f205cb12868b1
reviewed_at: 2026-11-06T00:00:00Z
---
<!-- reviewed_hash = `git diff main | shasum -a 256` (tracked changes). Untracked files were read in full and are
NOT covered by that hash: supabase/migrations/20261106120000_mf0058_paths.sql, paths/claude-developer.yaml,
docs/adr/0006-*, src/engine/path/**, src/server/paths/**, src/features/paths/**, src/app/(app)/paths/**, and the
mf-0058 acceptance tests. `pnpm ticket:verify` does not exist in this repo, so no receipt diff_hash was available. -->

## Findings

No blockers. Checked and found sound:
- Privileged write: `record-course-completion.ts` takes `userId` from callers that all pass the session `user.id`
  (walk/duel/seed-planting/cuckoo/storm actions; `AnswerInput` / `CuckooAnswerInput` are `strictObject`, so
  `...parsed.data` can't override `userId`). Every read that decides the rule runs on the learner's RLS client,
  so a mismatched id reads no attempts, gets an all-seed forest, and writes nothing. A 0-tree forest is never
  complete. `kind !== "course"` returns before any DB read. `pack_slug` / `pack_version` come from the deployed
  pack file, the same one `gradeAnswer` graded against (a stale hash returns `changed` before the recorder runs).
  Learners can't write attempts directly (attempts = SELECT only), so the forest can't be forged.
- Migration: RLS on, `revoke all` from public/anon/authenticated/service_role before grants. Learners get no write
  on `course_completions`. `service_role` gets only select and insert, so nobody holds UPDATE or DELETE.
  `path_enrollments` policies are own-row for select, insert and delete. Nothing for anon/PUBLIC.
- Failure isolation: all three call sites wrap the recorder in try/catch after the RPC committed, log only
  `error.message`, and still return `ok`. The importer lock lists exactly two files.
- Figures: n, N, percent, counts and fading all come from `pathProgress` / `summarizeForest`. Today and the path
  page render the same `PathProgressSummary` from the same `pathProgress` output, so SC-8 parity holds by
  construction. "Course n of N" = `nextPosition`, as the user decided at plan approval.
- Per-user reads are under `<Suspense>` and never `use cache`. The actions run auth → zod → `ActionResult` through
  `useMutation`. Views hold no behaviour.
- T0 framing reasons checked against `.cache/corpus`. The D5.S1 article says "on the web, Claude Desktop, and
  Claude Mobile apps". The D5.S2 article sits in the "Claude › Usage and limits" collection. The reworded
  subagents card matches the page ("Claude Code ignores a field it doesn't recognize without reporting an
  error"). In D2.S1 q5, D3.S2 q6 and D3.S3 q5 the claude.ai clause is setting only: each key rests on the API page.

- [should-fix] src/features/paths/components/path-view/path-view.tsx:21-30 together with
  src/features/paths/utils/path-display.ts:34-38 and src/features/paths/components/path-progress/path-progress.tsx:25.
  The page heading reads "PATH / Claude Developer", with Anthropic's partner-portal URL directly underneath.
  Read together they present this as Anthropic's Claude Developer path. MindForge covers only 5 of its 9 courses,
  and no line on the page says so (the 4 missing courses are named only in a YAML comment). When every course is
  complete, the same header shows the trophy "Path complete · {date}". By juxtaposition that reads as "you
  completed Anthropic's Claude Developer path", which isn't true. It isn't the word "certified", so it doesn't hit
  the NEVER list, but it is a false completion claim tied to a third-party name. Fix: add one line under the title,
  e.g. "The 5 of Anthropic's 9 Claude Developer courses that MindForge has", and label the link (for example
  "Anthropic's path order") instead of showing a bare URL.
- [should-fix] src/features/paths/utils/path-display.ts:3-11. `formatCompletedDate` formats with a hardcoded
  `timeZone: "UTC"` and prints no zone. A learner in UTC+10 who completes a course at 08:00 local on 7 Nov sees
  "Complete · 6 Nov 2026", a day early, with nothing to say why. The existing owner `src/lib/format-utc-date.ts`
  appends " UTC" for this reason. This copy drops the marker and duplicates that helper (one owner per fact). Fix:
  reuse or extend `formatUtcDate`, or mark the zone. The same applies to `trophyLine`.
- [should-fix] Scope. `src/features/paths/utils/path-display.ts` and `src/features/paths/utils/__tests__/path-display.test.ts`
  aren't covered by any task's `owns` in LOOP-PLAN.md (T6 owns `src/features/paths/components/**` and
  `src/features/paths/__tests__/**`). `.claude/rules/code-conventions.md` is changed with user approval (plan
  approval item 2) but also isn't in any `owns`. A scope = union-of-owns check would flag all three. Fix: add them
  to T6 / T5 `owns`, or record the deviation in GOAL's iteration log.
- [note] src/server/paths/record-course-completion.ts:30-63 only runs after a correct graded answer. Two groups of
  learners will see "In progress" on a course whose skills are all at Sapling until their next correct answer in
  that pack:
  - learners whose forests already qualified before this deploy;
  - learners whose skills reached Sapling because an admin restored a rejected question (`countableAttempts`
    changes with no new attempt).
  LOOP-PLAN ("Riskiest step") acknowledges this. It should be named in the hand-off as a follow-up, perhaps a
  one-off backfill run through the same recorder.
- [note] src/server/paths/record-course-completion.ts:49. Until the course is recorded, every correct answer in a
  course pack replays the whole pack: 4 reads plus FSRS. Fine at this scale. The recorded-row early return keeps
  later answers cheap.
- [note] supabase/migrations/20261106120000_mf0058_paths.sql:47-49. A learner can call PostgREST directly to enroll
  themselves in any slug-shaped `path_slug` that has no path file. It is harmless: only their own rows change, and
  `listPaths` and `getPath` ignore unknown slugs. Noted because `startPath`'s file check is not the boundary.
- [nit] src/features/paths/components/path-view/utils.ts:25-29. `STATUS_STAGE.complete = "sapling"` keeps the
  Sapling tile on a recorded course even after live health has dropped below Sapling. That follows "recorded once",
  but the tile is a stage icon, so it can read as the live stage. The status Badge word is correct.
- [nit] src/features/paths/components/path-list/path-list.tsx:24-51. The list is one Card per row. ui-design.md §3.5
  calls for one Card with rows split by `Separator`. This doesn't matter with one path, but it will once a second
  path is added.
