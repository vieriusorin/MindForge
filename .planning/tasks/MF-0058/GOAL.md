---
ticket_id: MF-0058
title: "Learning paths: start a path, see the next course, complete courses"
tier: high-risk                   # new tables + RLS, a privileged write, a new recorded figure (course complete)
stage: handoff
branch: MF-0058                   # created from main 2026-11-06 (03a1de2)
builds_on: []
last_iteration: 1
goal_status: complete-pending-manual-commit
---

> Drafted 2026-11-06 at intake from the user's brief: "paths, each with different courses; focus on a single path
> now, more later; how does a user know they started a path and completed its courses; improve the UI/UX; research
> it; create only the ticket." Research: `research/ux-learning-paths.md`. The group half of the brief (answer 5) is
> split out to **MF-0059**.

## Objective

**Today.** MindForge has six `kind: course` packs and one `kind: exam` pack (`ccdv-f`). They sit side by side in no
order. The pack a learner sees is whatever their newest pinned or joined group follows (`primaryPackSlug`,
`src/server/packs/primary-pack.ts:11`). A learner can't say "I'm doing this sequence". Nothing records that they
started it, nothing tells them which course comes next, and nothing says a course is finished. Five of those course
packs come from one Anthropic Academy path, but the app doesn't show it.

**End state.** A **Path** is an ordered list of packs, declared in a file. v1 ships one path: **Claude Developer**, in
Anthropic's order. The model takes more paths with no code change. A learner:

1. opens **Paths**, sees the path (its courses in order, the skill count per course, what "complete" means) and
   presses **Start path**, which records an enrollment;
2. sees, on the path page and on Today, **"Course n of N"** and one **Continue** target: the first course in path
   order that isn't complete;
3. sees a course marked **Complete · {date}** once every skill in it reaches at least Sapling. That record is written
   once and kept; the course's **live health** (today's stages, wilting skills) is shown beside it, because memory
   fades;
4. sees the path complete when every course in it is complete. This is a trophy, never "certified";
5. can **leave** the path: the enrollment goes, and the completion records stay.

## Affected

- **Roles:** Learner only. Enrollment and completion are private (own rows only), like pins (MF-0054). No admin or
  maintainer change. Group behaviour belongs to MF-0059.
- **Surfaces:**
  - `paths/claude-developer.yaml` (new top-level folder beside `packs/`), its zod schema in `src/engine/path/`, and
    `pnpm check:packs` (or a sibling check) validating it
  - `src/engine/path/`: `isCourseComplete`, `pathProgress` (pure, with the clock passed in)
  - DB: `public.path_enrollments(user_id, path_slug, started_at)` and
    `public.course_completions(user_id, pack_slug, completed_at, pack_version)`
  - server: `src/server/paths/` reads (`getPath`, `listPaths`, `getPathEnrollment`, `listCourseCompletions`) and the
    completion recorder
  - the five attempt-writing actions (`duel`, `walk`, `cuckoo`, `seed-planting`, `storm`) each call the recorder after
    a graded attempt
  - `src/features/paths/` (Start / Leave buttons, path view), route `src/app/(app)/paths/[pathSlug]`, a Path card on
    `today`, a **Paths** entry in the sidebar's Workspace group
  - `CONTEXT.md`: the terms Path, Enrolled, Course complete, Path complete

## Facts (re-derived 2026-11-06)

- **Anthropic's "Claude Developer" path** (https://anthropic-partners.skilljar.com/path/claude-developer, fetched
  2026-11-06) lists 9 courses in this order: 1 AI Capabilities and Limitations · 2 AI Fluency for Builders · 3 Claude
  Platform & Model Foundations · 4 Claude Platform 101 · 5 Claude Code 101 · 6 Claude Code in Action · 7 Introduction
  to MCP · 8 Introduction to agent skills · 9 Introduction to subagents. MindForge has packs for 1, 3, 6, 8 and 9.
- **Anthropic's "CCDV-F Prep" path** (…/path/claude-certified-developer-foundations) lists 5 courses: MSO
  Foundations · Production-Grade Prompting, Agents & Tool Use · Claude Code, MCP & Integration · Production
  Engineering, Evals & Security · Accelerators & IP Contribution. MindForge has a pack only for the second one
  (`prod-prompting`). The page doesn't put the exam inside the path.
- `kind` is validated in `src/engine/pack/schema.ts:44` and isn't stored in the DB. Every pack's `version:` is 1.
- **No per-learner "started" record exists.** Learners link to packs only through group membership,
  `attempts.pack_slug`, `storms.pack_slug` and `group_pins`. Any pack can be played by URL without a group. Only
  Review is gated by membership.
- **Course packs can't reach Tree.** Tree needs a storm proof (`tree-stage.ts:40`; Feynman was cut in MF-0013), and
  storms exist only for packs with an `exam:` block, which only `ccdv-f` has. **Sapling** (≥ 1 successful recall and
  stability ≥ 3 days, `FOREST_THRESHOLDS`) is the highest stage a course pack can reach.
- Stage is a function of recalls and stability only. Wilting is a separate flag (retrievability < 0.85). Stability
  changes only when an attempt is replayed, so **a course can only become complete right after a graded attempt**,
  which is why the recorder belongs on the attempt path and not on a page read.
- Memory is replayed in TypeScript (`memoryBySkill`), not in SQL, so a DB trigger on `attempts` can't decide
  completion.
- Skill counts: ai-capabilities 8, platform-foundations 9, claude-code-in-action 11, agent-skills 9, subagents 8. The
  path has 45 skills.
- **Re-derived at pickup (2026-11-06, branch MF-0058 off main 03a1de2):** skill counts, `version: 1`, `kind` enum
  (`schema.ts:44`), Tree needing a storm proof (`tree-stage.ts:40`) and `saplingStabilityDays: 3` all confirmed.
  Corrections: (a) there are 8 packs, not 7: `team-onboarding-sample` is `kind: onboarding` with 0 skills;
  (b) the sidebar is `src/features/app-shell/components/app-sidebar/app-sidebar.tsx:72`; (c) **there is no
  "service-role client" for writes.** The only privileged client is `createSecretSupabase`
  (`src/server/supabase/secret.ts`, ADR 0004), scoped to one *read* (group heatmap) and locked to one importer by
  `src/server/supabase/__tests__/secret-client-importers.test.ts:32`. Every write today goes through an RPC as the
  learner (`record_attempt` in `grade-answer.ts:59`, `grade-cuckoo.ts:58`). See C-2.
  (d) Five attempt actions do not each call `record_attempt`: duel, walk and seed-planting share `gradeAnswer`,
  cuckoo uses `gradeCuckoo`, storm uses its own RPCs. The recorder's call sites are those three paths.

## Constraints → how met

- Every figure on screen comes from `src/engine/**` → `pathProgress` returns every count and status the page and the
  card show. A parity test covers Today against the path page.
- Per-user data is never `use cache` → the path page body and the Today card are per-user reads under `<Suspense>`.
- Migration: RLS on, `revoke all` before grants (memory `project-supabase-migration-rules`).
  - `path_enrollments`: select / insert / delete own row.
  - `course_completions`: **select own row only, no insert/update/delete for `authenticated`.** A learner could
    otherwise forge "Complete" through PostgREST. The recorder writes through the service-role client inside
    `src/server/**` only, after the server has computed the rule itself.
- The recorder never fails the attempt. Recording completion is a side effect after the attempt commits; an error is
  logged and the attempt's `ActionResult` stays `ok`. Proof: a test where the recorder throws.
- shadcn only: path list from `Card`, `Badge` (status as a word), `Progress` (add via CLI if missing), `Separator`,
  `Button` and `StageIcon`. No hand-built stepper. Status never relies on colour alone.
- Writes from the client (`startPath`, `leavePath`) are Server Actions: auth, then zod re-parse, then `ActionResult`,
  called through `useMutation` (create-group-form shape).
- Packs stay the source of truth for content. A path file only names pack slugs. A bad path file fails the check
  command and never fails at runtime.

## Decided by the user (2026-11-06)

- **Course complete = every skill of the pack at Sapling or above.**
- **The pin rule stays**: the newest pin still sets the pack for Today, Play and Review (MF-0054). The path adds a
  card and a Continue link; it doesn't take over pack selection.
- **Completion is recorded once** and then kept, with live health shown beside it.
- **Path = Anthropic's flow when one exists.** It does (Claude Developer), so v1 uses its order over the packs
  MindForge has.
- **Groups follow a path**: joining a group means following its path, with discussion around it. Split to
  **MF-0059** (below), because it changes the group model that heatmap, expedition and review sit on.
- **A learner can leave a path.**
- **C-1 (pickup checkpoint):** a wilting Sapling counts toward Course complete; fading shows in live health.
- **C-2 / C-5:** `course_completions` is written by `createSecretSupabase` only, from one recorder in `src/server/**`
  that computes the rule itself. ADR 0004 is amended from "one read" to "one read and one write", and
  `secret-client-importers.test.ts` lists exactly two importers: `get-group-heatmap.ts` and the recorder.
- **C-4:** the 7 baseline `check:packs` problems are fixed in this ticket as **T0**, a separate hunk in the hand-off,
  each fix grounded on the cited page (or a `# framing:` / `# example-name:` note with its reason). SC-10 keeps
  "`pnpm check:packs` exits 0".
- **Plan approval (2026-11-06):** plan approved incl. MF-0005 grants re-freeze, gate-script + `next.config.ts` edits and
  local `db:sync-keys`; recorder errors logged via a named `console.error` exception in `code-conventions.md`; the
  secret-key write gets a new **ADR 0006** (0004 unchanged; supersedes the "amended" wording in C-2 above);
  "Course n of N" = position of the Continue course, with "{completed} of {N} complete" beside it.
- **C-3:** the new migration reaches the local stack with `supabase migration up` only. `pnpm db:reset` is not run
  without asking again.

## Decided without a question

- **v1 path content:** `paths/claude-developer.yaml` = `ai-capabilities → platform-foundations →
  claude-code-in-action → agent-skills → subagents` (Anthropic order, courses MindForge has). The four Anthropic
  courses without a pack are named in a file comment and become pack tickets later; the page doesn't show courses
  nobody can play. `prod-prompting` waits for a second path (CCDV-F Prep), and `ccdv-f` stays outside every path
  because Anthropic keeps the exam outside its path. Source: the Facts above.
- **Explicit Start path, not inferred from attempts.** An implicit enrollment is what produces Coursera's "finished
  every course, no path credit" failure (research pattern 1). It also answers the brief's "how does a user know they
  started".
- **Completion is recorded whether or not the learner is enrolled, for any course pack**, so courses done before
  Start count straight away (honest endowed progress, research pattern 9). The record is a memory fact, not a
  path fact.
- **Path complete is derived, not stored**: every course in the path has a completion row. Its date is the latest
  course date.
- **Recorded stays recorded** (the user's "recorded once"). If the pack later gains a skill, a question gets rejected,
  or memory fades, the row stays. `pack_version` is stored so the record says which pack it was earned on. The live
  health beside it shows the change.
- **Order is recommended, nothing is locked.** Every pack is already playable by URL, so a lock would be cosmetic
  (research pattern 7). Continue points at the first incomplete course in path order.
- **Leave = delete the enrollment row.** Completion rows stay, and pressing Start again restores the same progress.
- **A pack with zero skills can't be in a path** (the check fails), so "every skill" is never vacuously true.

## Success Criteria

- [x] SC-1: `paths/<slug>.yaml` (slug, name, source url, ordered `courses: [pack slug]`) validates with zod.
  `paths/claude-developer.yaml` lists exactly `ai-capabilities, platform-foundations, claude-code-in-action,
  agent-skills, subagents`. The check command exits 1 and names the path and the slug for: an unknown pack, a
  duplicate pack, an empty list, a pack with 0 skills. Proof: unit test of the schema plus a check run over bad
  fixtures.
- [x] SC-2: `isCourseComplete(forest)` is true exactly when every skill's stage is sapling, tree or ancient (edge
  table below). Proof: oracle test, literals from the table.
- [x] SC-3: `pathProgress({ path, completions, forests })` returns, per course in path order, `complete` (with the
  date) | `in-progress` (≥ 1 skill past seed) | `not-started`, plus `completedCount`, `total`, `next` (first
  non-complete course, or null) and `isPathComplete`. Proof: oracle test including a complete course *after* an
  incomplete one (order kept, endowed progress counted, `next` = the earlier one).
- [x] SC-4: After a graded attempt that makes the pack's last skill reach Sapling, exactly one `course_completions` row
  exists for (user, pack) with that pack's `version`. A second qualifying attempt doesn't add or change the row. An
  attempt that leaves one skill below Sapling writes nothing. Proof: `*.db.test.ts` through the recorder against the
  local stack.
- [x] SC-5: Security. `authenticated` can't insert, update or delete `course_completions` (including its own rows) and
  can't read another user's rows. For `path_enrollments`: own rows only for select, insert and delete; a repeated
  `startPath` is ok with one row; `leavePath` removes it and leaves completions untouched. The secret client is
  imported by exactly `get-group-heatmap.ts` and the recorder (C-2). Proof: `*.db.test.ts` + the importer lock test.
- [x] SC-6: The recorder failing doesn't fail the attempt: the action still returns `ok` and the attempt row exists.
  Proof: unit test with the recorder stubbed to throw (one action is enough because they share the helper; a grep
  shows the three grading paths of fact (d) call it).
- [x] SC-7: Path page `/paths/claude-developer`:
  - Not enrolled: Start path, the 5 courses in order with skill counts, the completion rule in one sentence, and any
    already-complete course marked.
  - Enrolled: "Course n of N", a Continue button to the `next` course's Walk, each course with its status word,
    "Complete · {date}" where recorded, and live health (stage counts plus "k skills fading" from `summarizeForest`).
  - Leave path is in a menu.
  - Proof: browser on the local stack, light, dark and 375px, screenshots in `.planning/evidence/MF-0058/`.
- [x] SC-8: Today shows a Path card for an enrolled learner, with the same `n of N` and Continue target as the path
  page, and no card when not enrolled. Proof: a parity test (both read `pathProgress`) plus browser.
- [x] SC-9: Sidebar Workspace has **Paths** (with a tooltip). The pin rule is unchanged: the MF-0054 acceptance tests
  stay green with no edit. Proof: `pnpm test`, browser.
- [x] SC-10: `CONTEXT.md` defines Path, Enrolled, Course complete and Path complete. `pnpm typecheck && pnpm lint &&
  pnpm test`, `pnpm test:db`, `pnpm check:packs` and `pnpm build` all exit 0. The evidence file has "See it
  yourself".

### Edge-input table (SC-2, SC-3)

| Input | Shown | Decided by |
|---|---|---|
| no attempts in the pack | `not-started`, not complete | user (every skill) |
| one skill planted (sprout), rest seed | `in-progress` | draft (≥ 1 skill past seed) |
| every skill sapling except one sprout | `in-progress`, not complete | user (every skill) |
| one skill exactly at 3.0 days stability, rest sapling | complete (`>=`, `FOREST_THRESHOLDS`) | code threshold |
| every skill sapling, some wilting | complete (stage counts; wilting shows in live health) | user (C-1, 2026-11-06) |
| recorded complete, now a skill below sapling (rejected question replayed out) | `complete` + date; live health shows the drop | user (recorded once) |
| pack gained a skill after the record | `complete` (row kept, `pack_version` older); health shows 1 seed | user (recorded once) |
| complete before Start path | counted complete at Start | draft (endowed, honest) |
| all 5 complete | `isPathComplete`, `next` = null, trophy line | draft |
| not enrolled | no Today card; path page shows Start | draft |

## Symbols changed

- `function` — new `recordCourseCompletion`, called after a successful `record_attempt` in `gradeAnswer`
  (duel, walk, seed-planting), `gradeCuckoo` (cuckoo) and the storm answer path (fact (d)); return contracts unchanged
- `name` — `createSecretSupabase` importer lock (`secret-client-importers.test.ts`): gains the recorder (C-2)
- `name` — `PackContent` / pack schema: unchanged. New `PathContent` schema.
- `name` — sidebar Workspace items (`app-sidebar.tsx:72`): gains Paths
- Run `pnpm ticket:collisions MF-0058` at pickup; list any hit under "Frozen files this will re-freeze".

## Concerns

| # | Collision | Owner | Status |
|---|-----------|-------|--------|
| C-1 | A skill can be Sapling and wilting at the same moment. Does a wilting Sapling count toward "every skill at Sapling"? Recommendation: **yes**. Stage measures how durable the memory is, wilting measures today's recall, and live health already shows the fading. | user | resolved 2026-11-06 (Decided by the user) |
| C-2 | The recorder runs as service role from 5 actions, which is a privileged-client path and high-risk. Alternative: write on page view (simpler, but a render with a side effect, and a learner who never opens the page gets a late date). Recommendation: **attempt path** (see Facts: completion can only start right after an attempt). | user (plan approval) | resolved 2026-11-06 (Decided by the user) |
| C-3 | `pnpm test:db` and the browser proof need the local stack; any `pnpm db:reset` at build time needs the user's approval at the DESIGN checkpoint | user | resolved 2026-11-06 (Decided by the user) |
| C-4 | Baseline red: `pnpm check:packs` exits 1 on `main` with 7 problems, all in packs this path uses (5 `claude.ai` framing leaks in `platform-foundations` questions D2.S1 q5, D3.S2 q6, D3.S3 q5, D5.S1 q2, D5.S2 q3; 2 ungrounded tokens in `subagents` cards D2.S1, D2.S2). SC-10 says `check:packs` exits 0. Fix as T0 (separate hunk), or narrow SC-10 to "no new problems" and reserve a content ticket. | user | resolved 2026-11-06 (Decided by the user) |
| C-5 | C-2 revised by fact (c): rows written by an RPC the learner can call are forgeable; rows written by `createSecretSupabase` need ADR 0004 widened from one read to one write and a second entry in the importer lock. | user | resolved 2026-11-06 (Decided by the user) |

## Out of Scope

- Groups following a path, group path views, discussion: **MF-0059**.
- A second path (CCDV-F Prep), and packs for the 4 missing Claude Developer courses: their own tickets.
- Certificates, sharing, badge images; hard locks; new game modes for course packs.
- Changing how Today, Play and Review pick a pack (the pin rule stays, user 2026-11-06).

## Open questions

- None open. C-1…C-5 resolved at the pickup checkpoint (2026-11-06). DESIGN preflight (`pnpm typecheck && pnpm lint && pnpm test`, `pnpm test:db`, `pnpm check:packs`,
  `pnpm build`, CI on main, `pnpm ticket:collisions MF-0058`) runs at pickup on branch `MF-0058`.

## Iteration Log

<!-- append-only -->
- 2026-11-06 intake: number reserved (`pnpm ticket:github next` → MF-0058, issue #90). Code map and UX research by
  subagents (`research/ux-learning-paths.md`).
- 2026-11-06 design (draft): user answered 1 every skill · 2 keep pin rule · 3 recorded once · 4 use Anthropic's flow ·
  5 groups follow a path (split to MF-0059) · 6 can leave. Fetched both Anthropic paths; v1 = Claude Developer over 5
  packs. SCs drafted, not frozen; no preflight run (ticket-only, per the user).
- 2026-11-06 pickup: branch `MF-0058` from main 03a1de2; claimed (#90 → In Progress · Design). Main CI `success`
  (03a1de2). Facts re-derived; corrections (a)–(d) above.
- 2026-11-06 design preflight: `pnpm typecheck` 0 · `pnpm lint` 0 · `pnpm test` 0 (157 files, 812 tests) · `pnpm test:db` 0 (27 files, 120 tests) · `pnpm check:packs` **1** (7 baseline problems, C-4) · `pnpm build` 0 · `pnpm db:reset` not run: needs approval (C-3) · `pnpm ticket:collisions MF-0058` exit 2 (reads LOOP-PLAN.md only; re-run at PLAN). Manual grep of `*.acceptance.test.*` for the touched symbols: six frozen files mock or call the attempt actions (mf-0012, mf-0016, mf-0026 ×2, mf-0032 ×2). Only `mf-0032-changed-message` SC-4 runs a real action past a successful grade (`gradeAnswer` mocked to ok), so the recorder must sit where that test cannot reach a DB (inside `gradeAnswer`, which it mocks) or swallow its error (SC-6). No sidebar acceptance test.
- 2026-11-06 design checkpoint: user answered C-1 counts · C-2 secret client (ADR 0004 widened) · C-4 fix as T0 ·
  C-3 `supabase migration up` only. No term collision in CONTEXT.md. SCs frozen as text; next: Stage 2b RED.
- 2026-11-06 freeze: acceptance-writer wrote 9 files (+ typed stubs). Re-run by the orchestrator: typecheck 0, lint 0,
  `pnpm test` 37 red / 812 green (reds only in the 6 new unit/ui files), `pnpm test:db` 14 red / 120 green (reds only
  in the 3 new db files). FROZEN.json written by hand (no `ticket:freeze` script), LF-normalised sha256, matching
  the writer's hashes. Next: PLAN (high-risk, user approves).
- 2026-11-06 plan: LOOP-PLAN.md written (ticket-planner), 10 tasks (T0 content, T1 migration, T1R MF-0005 re-freeze, T2 engine,
  T3 script/paths/tracing, T4 server+recorder+actions, T5 docs, T6a sidebar, T6 UI, T7 verify). `ticket:collisions` exit 0. Found at
  PLAN: the MF-0005 grants allow-list needs +4 lines (re-freeze, approval), `check-pack-grounding.mjs` must run the path check
  before its corpus-absent exit, `next.config.ts` must trace `paths/`, and `console.error` in the grading catch needs a
  code-conventions exception. Awaiting user approval (high-risk).
- 2026-11-06 build: T6a done (sidebar Paths, SC-9 green). T1 done (migration `20261106120000_mf0058_paths.sql` via `supabase migration up --local`; `pnpm db:types`; RLS file 7/10 green, 3 wait on actions). T1R: MF-0005 grants allow-list +4 lines (user-approved at plan), `pnpm test:db mf-0005-grants` 3/3 green; MF-0005 FROZEN.json sha256 → fa1c135f…, previous hash kept in `history`.
- 2026-11-06 build: T0 done. `pnpm check:packs` 0 problems (485 checked, 5 skipped; baseline 7). 6 notes (`# framing:` ×5, `# example-name:` ×1) + 1 reword of `subagents.D2.S1.card-file-and-scope`, grounded on the cached sub-agents page ("Claude Code ignores a field it doesn't recognize without reporting an error"; verified by the orchestrator). Deviation from LOOP-PLAN: the plan called that claim ungrounded; the page grounds it, so the claim was kept and only the off-page token `max_turns` removed. Local `pnpm db:sync-keys` run (no reset).
- 2026-11-06 build: T2 done (engine; frozen SC-2 9/9, SC-3 9/9; frozen hashes re-checked). T3 done by the orchestrator: `paths/claude-developer.yaml`, path check in `scripts/check-pack-grounding.mjs` before the corpus exit (`MF_PATHS_DIR`), `next.config.ts` traces `./paths/**/*`. `pnpm check:packs` exit 0 (1 path, 0 problems); with `.cache/corpus` moved aside a bad fixture (unknown + duplicate) exits 1 with both lines; `pnpm test src/engine/path` 57/57.
- 2026-11-06 build: T5 done by the orchestrator: CONTEXT.md gains Path, Enrolled, Course complete, Path complete (Game section); new `docs/adr/0006-server-only-secret-key-for-course-completions.md` (ADR 0004 unchanged). T4 dispatched (service-builder).
- 2026-11-06 build: T4 done (recorder via `createSecretSupabase`, ADR 0006; call sites in `gradeAnswer`, `gradeCuckoo`, `finishStorm`; `startPath`/`leavePath`; importer lock = 2). Orchestrator re-check: every FROZEN.json hash in `.planning/tasks/*` matches; typecheck 0; `pnpm test` 885 green, 2 red (only the SC-8 parity file, T6); `pnpm test:db` 134/134. Deviation: the scope hook blocked `src/features/paths/{schemas,types}.ts` for service-builder; handed to T6. T6 dispatched (ui-builder).
- 2026-11-06 build: T6 done (path page, /paths list, Today card, Start/Leave via useMutation, error.tsx; `schemas.ts`/`types.ts` moved out of actions.ts). Deviation: `src/features/paths/utils/path-display.ts` (+ test) is outside every task's `owns` (shared by three components, react-client-patterns rule 9); `.claude/rules/code-conventions.md` (user-approved exception) is outside every `owns` too (reviewer finding 3, logged here).
- 2026-11-06 test: stage test; all gates 0. Browser on the local stack as `strong@mindforge-demo.test`, SC-7/8/9 in light, dark, 375px (one completion row inserted by hand for the "Complete · date" screen; SC-4 proves the real write). Pre-existing: 375px sidebar hydration mismatch on every route incl. `/groups`.
- 2026-11-06 review: diff-reviewer approve, 0 blockers (`REVIEW.md`, hash 0d0edfdd…). Fixed should-fix 1 (source note: not a record on Anthropic's side; labelled link) and 2 (completion dates labelled " UTC", test RED first), plus the list link-name space. Post-review changes are UI copy only, not re-reviewed.
- 2026-11-06 hand-off: receipt PASS on tree 39a17990fea4 (LOOP-VERIFY iteration 1): typecheck, lint, test 912, test:db 134, check:packs 0, gate:planning ok, build; frozen hashes 0 mismatches. Evidence `.planning/evidence/MF-0058.md`.
