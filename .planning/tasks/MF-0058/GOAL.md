---
ticket_id: MF-0058
title: "Learning paths: start a path, see the next course, complete courses"
tier: high-risk                   # new tables + RLS, a privileged write, a new recorded figure (course complete)
stage: design
branch: MF-0058                   # to be created from main when the build starts (not the MF-0043 branch)
builds_on: []
last_iteration: 0
goal_status: reserved             # ticket only (user, 2026-11-06); built later on its own branch
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

- [ ] SC-1: `paths/<slug>.yaml` (slug, name, source url, ordered `courses: [pack slug]`) validates with zod.
  `paths/claude-developer.yaml` lists exactly `ai-capabilities, platform-foundations, claude-code-in-action,
  agent-skills, subagents`. The check command exits 1 and names the path and the slug for: an unknown pack, a
  duplicate pack, an empty list, a pack with 0 skills. Proof: unit test of the schema plus a check run over bad
  fixtures.
- [ ] SC-2: `isCourseComplete(forest)` is true exactly when every skill's stage is sapling, tree or ancient (edge
  table below). Proof: oracle test, literals from the table.
- [ ] SC-3: `pathProgress({ path, completions, forests })` returns, per course in path order, `complete` (with the
  date) | `in-progress` (≥ 1 skill past seed) | `not-started`, plus `completedCount`, `total`, `next` (first
  non-complete course, or null) and `isPathComplete`. Proof: oracle test including a complete course *after* an
  incomplete one (order kept, endowed progress counted, `next` = the earlier one).
- [ ] SC-4: After a graded attempt that makes the pack's last skill reach Sapling, exactly one `course_completions` row
  exists for (user, pack) with that pack's `version`. A second qualifying attempt doesn't add or change the row. An
  attempt that leaves one skill below Sapling writes nothing. Proof: `*.db.test.ts` through the recorder against the
  local stack.
- [ ] SC-5: Security. `authenticated` can't insert, update or delete `course_completions` (including its own rows) and
  can't read another user's rows. For `path_enrollments`: own rows only for select, insert and delete; a repeated
  `startPath` is ok with one row; `leavePath` removes it and leaves completions untouched. Proof: `*.db.test.ts`.
- [ ] SC-6: The recorder failing doesn't fail the attempt: the action still returns `ok` and the attempt row exists.
  Proof: unit test with the recorder stubbed to throw (one action is enough because they share the helper; a grep
  shows all five call it).
- [ ] SC-7: Path page `/paths/claude-developer`:
  - Not enrolled: Start path, the 5 courses in order with skill counts, the completion rule in one sentence, and any
    already-complete course marked.
  - Enrolled: "Course n of N", a Continue button to the `next` course's Walk, each course with its status word,
    "Complete · {date}" where recorded, and live health (stage counts plus "k skills fading" from `summarizeForest`).
  - Leave path is in a menu.
  - Proof: browser on the local stack, light, dark and 375px, screenshots in `.planning/evidence/MF-0058/`.
- [ ] SC-8: Today shows a Path card for an enrolled learner, with the same `n of N` and Continue target as the path
  page, and no card when not enrolled. Proof: a parity test (both read `pathProgress`) plus browser.
- [ ] SC-9: Sidebar Workspace has **Paths** (with a tooltip). The pin rule is unchanged: the MF-0054 acceptance tests
  stay green with no edit. Proof: `pnpm test`, browser.
- [ ] SC-10: `CONTEXT.md` defines Path, Enrolled, Course complete and Path complete. `pnpm typecheck && pnpm lint &&
  pnpm test`, `pnpm test:db`, `pnpm check:packs` and `pnpm build` all exit 0. The evidence file has "See it
  yourself".

### Edge-input table (SC-2, SC-3)

| Input | Shown | Decided by |
|---|---|---|
| no attempts in the pack | `not-started`, not complete | user (every skill) |
| one skill planted (sprout), rest seed | `in-progress` | draft (≥ 1 skill past seed) |
| every skill sapling except one sprout | `in-progress`, not complete | user (every skill) |
| one skill exactly at 3.0 days stability, rest sapling | complete (`>=`, `FOREST_THRESHOLDS`) | code threshold |
| every skill sapling, some wilting | complete (stage counts; wilting shows in live health) | **C-1** (recommended) |
| recorded complete, now a skill below sapling (rejected question replayed out) | `complete` + date; live health shows the drop | user (recorded once) |
| pack gained a skill after the record | `complete` (row kept, `pack_version` older); health shows 1 seed | user (recorded once) |
| complete before Start path | counted complete at Start | draft (endowed, honest) |
| all 5 complete | `isPathComplete`, `next` = null, trophy line | draft |
| not enrolled | no Today card; path page shows Start | draft |

## Symbols changed

- `function` — new `recordCourseCompletion` called from `src/features/{duel,walk,cuckoo,seed-planting,storm}/actions.ts`
  (their behaviour gains a post-attempt side effect; their return contract is unchanged)
- `name` — `PackContent` / pack schema: unchanged. New `PathContent` schema.
- `name` — sidebar Workspace items (`app-sidebar.tsx:72`): gains Paths
- Run `pnpm ticket:collisions MF-0058` at pickup; list any hit under "Frozen files this will re-freeze".

## Concerns

| # | Collision | Owner | Status |
|---|-----------|-------|--------|
| C-1 | A skill can be Sapling and wilting at the same moment. Does a wilting Sapling count toward "every skill at Sapling"? Recommendation: **yes**. Stage measures how durable the memory is, wilting measures today's recall, and live health already shows the fading. | user | open |
| C-2 | The recorder runs as service role from 5 actions, which is a privileged-client path and high-risk. Alternative: write on page view (simpler, but a render with a side effect, and a learner who never opens the page gets a late date). Recommendation: **attempt path** (see Facts: completion can only start right after an attempt). | user (plan approval) | open |
| C-3 | `pnpm test:db` and the browser proof need the local stack; any `pnpm db:reset` at build time needs the user's approval at the DESIGN checkpoint | user | open (asked at pickup) |

## Out of Scope

- Groups following a path, group path views, discussion: **MF-0059**.
- A second path (CCDV-F Prep), and packs for the 4 missing Claude Developer courses: their own tickets.
- Certificates, sharing, badge images; hard locks; new game modes for course packs.
- Changing how Today, Play and Review pick a pack (the pin rule stays, user 2026-11-06).

## Open questions

- C-1, C-2 (user). DESIGN preflight (`pnpm typecheck && pnpm lint && pnpm test`, `pnpm test:db`, `pnpm check:packs`,
  `pnpm build`, CI on main, `pnpm ticket:collisions MF-0058`) runs at pickup on branch `MF-0058`.

## Iteration Log

<!-- append-only -->
- 2026-11-06 intake: number reserved (`pnpm ticket:github next` → MF-0058, issue #90). Code map and UX research by
  subagents (`research/ux-learning-paths.md`).
- 2026-11-06 design (draft): user answered 1 every skill · 2 keep pin rule · 3 recorded once · 4 use Anthropic's flow ·
  5 groups follow a path (split to MF-0059) · 6 can leave. Fetched both Anthropic paths; v1 = Claude Developer over 5
  packs. SCs drafted, not frozen; no preflight run (ticket-only, per the user).
