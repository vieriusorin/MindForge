---
ticket_id: MF-0062
title: "Course map: skill nodes with real stage and health, one next step, on any pack (learning-path slice A)"
tier: normal                      # slice A: engine read + UI, no schema; figures come from summarizeForest/pathProgress
stage: handoff
branch: MF-0062
builds_on: [MF-0058]
last_iteration: 1
goal_status: complete-pending-manual-commit
---

> Opened 2026-11-06 from the user's brief: an AI council on making learning more interactive (path like Brilliant /
> Duolingo), logic in the database, a seed covering different scenarios. User screenshots of the target journey: pending.

## Objective

**Today.** A path (MF-0058) is a list of course packs on `/paths/[slug]`: course rows, no skill nodes, no "tap to play".
Learning happens in separate modes (Seed Planting, Walk, Duel, Cuckoo, Storm), each pack-wide. Grading is binary
(correct = Good, wrong = Again, `src/engine/memory/replay.ts:23`), and the wrong option a learner picks is stored
(`attempts.chosen`) but never read. No demo learner is enrolled in a path.

**End state (umbrella, split below).** A learner opens their path and sees a vertical map of skill nodes, each showing
its real tree stage and health, with one obvious next step ("Next" or "Water first"). Tapping a node starts a short
lesson (5–8 min) built from steps: guess first, nature card, diagram, recall with feedback and "Why?", a confusable
earlier skill, then a close screen with the real tree changes and the next review date. The seed shows every learner
state the map can be in.

## Council findings (2026-11-06, 6 read-only agents; claims re-checked marked ✓)

- **Human limits → numbers** (learning science): ≤ 3 new concepts per lesson, ≤ 4 options, 8–12 interactions,
  5–8 min per lesson, ~15–20 min a day, target 80–85% accuracy. Citations from the agent's memory; check before quoting.
- **Successive relearning is already enforced** ✓: a ts-fsrs probe (seed agent) gives 1 correct → stability 2.31 d
  (Sprout); 2 correct 1 day apart → 7.32 d (Sapling, threshold 3 d, `tree-stage.ts:23`); 10 correct on one day → 2.31 d.
  Cramming cannot fake a Sapling, so no new "done" rule is needed: **node done = Sapling** (= Course complete rule).
- **Path node = skill**, in-node flow = Seed Planting (Seed) / skill-scoped Walk (Sprout, wilting) / Duel or Cuckoo
  (Sapling+); domain checkpoint = Boss Storm. "Lesson" is not a new entity (CONTEXT.md has none; Seed Planting is one).
- **Adaptive v1** (tutor + learning science agree): confidence tap (sure/unsure) before reveal; misconception tags per
  distractor read from `chosen`; next-best item in a skill (wrong → unseen → least recent) + interleave confusables.
- **Reject:** hearts/energy, streak loss, XP for activity, individual leagues, locked nodes, live LLM-written content.
- **DB = integrity, engine = decisions** ✓: ADR 0004 rejected FSRS in SQL ("two copies of the formula"); ADR 0006
  "no database function or trigger" decides completion. The DB's legitimate jobs: grading (exists), clock, content-hash
  binding, ownership, append-only, CHECK bounds, idempotency (`record_attempt` has none: a retry writes 2 attempts).
- **Minimum schema if telemetry is approved** (data architect): nullable `attempts.{session_id, latency_ms, confidence,
  hint_used, client_attempt_id unique}`; `learning_sessions` + `session_steps` via definer RPCs; `profiles.time_zone`.
  Lesson progress, streaks, XP all derived in the engine. Grants test `mf-0005-grants.db.acceptance` re-freezes.
- **Seed gaps:** no enrollments/completions seeded; every group has 5 others so heatmap "not enough others" is never
  shown; fast+wrong / slow+accurate can't be seeded without timing columns. Proposed personas: fresh, halfway, midpath,
  finisher, lapsed+path, crammer+path, big path group, small path group. Append new personas after existing ones (PRNG).

## Decided by the user (2026-11-06)

- **D-1 Timing:** the whole track (slices A–F) now, before the 2026-11-30 freeze, not A+B only. Risk accepted by the
  user: it competes with the W3/W4 commitments (MINDFORGE §1.7). Each slice stays its own ticket so a slice that misses its week can still move without blocking the others.
- **D-2 Map scope:** the course map works on any pack's skills, `ccdv-f` included. Paths stay course-only (MF-0058).
- **D-3 Rewards:** honest versions. No XP for activity; show trees grown / watered this week; watered days never
  reset; competition stays co-op (Expeditions). §1.2, §2.2 and the CONTEXT.md group privacy rule stand unchanged (C-1..C-3 closed).
- **D-4 DB logic:** guards and integrity only (grading, clock, ownership, bounds, retry-safe writes). The engine decides
  stage, progress, next node. No session/telemetry tables were chosen (option 2 declined). C-4 closed.
- **D-5 Slice F:** retry-safe answers only (idempotency key on `record_attempt`); no session/telemetry tables. C-9 closed for F.
- **D-6 Slice D:** store confidence and grade with it (correct+unsure = Hard, wrong+sure = Again + review within 24 h); new ADR beside ADR 0005. C-6 closed for confidence.
- **U-1 Merge** (parallel run brief, 2026-11-06): the orchestrator commits, pushes, opens the PR and squash-merges
  after CI. This session never runs `git commit` / `git push` / `gh pr create` / `gh pr merge`.
- **U-2 Approvals**: plans are approved by the orchestrator agent; a fresh-context diff-reviewer runs before merge
  (dispatched by the orchestrator). `pnpm db:reset` on the LOCAL stack is allowed, under the shared db lock.
- **U-3** MF-0063 = admin-set external chat link. **U-4** MF-0061 = all three packs. (Not this ticket; recorded.)
- **(was) Open after D-1 × D-4:** slice F as drafted (sessions + telemetry tables) conflicts with D-4. Slice D's confidence
  column is telemetry too. See Concerns C-6, C-9.

## Concerns (owner: user)

- **C-1 XP** (J4, J6): conflicts with MINDFORGE §1.2.1 "Time spent or pages read earns nothing". Honest alternative:
  count only correct recalls, or show "trees grown this week".
- **C-2 Streak** (J7): conflicts with §2.2 ✓ "Streaks are seasons. Missing a day doesn't reset anything… No guilt
  mechanics." Honest alternative: watered days with no loss, or "days no tree wilted".
- **C-3 League** (J8): conflicts with CONTEXT.md "No per-member figures are ever shown to other members". Alternative:
  Expedition (exists).
- **C-4 "Logic in the database"**: guards/integrity only (fits ADRs 0001/0004/0006) vs progression in SQL (new ADR).
- **C-5 Deadline**: freeze 2026-11-30, exam 2026-12-07; W3/W4 committed (§1.7). The path covers course packs, not
  `ccdv-f` (MF-0058 Out of Scope). A map that also works for `ccdv-f` skills helps the exam.
- **C-6 Telemetry**: personal behavioural data; needs a named engine consumer + retention. Confidence → FSRS rating
  changes ADR 0005: new ADR.
- **C-7 Runtime AI**: MINDFORGE Q-2 ✓ "AI runs only as a local generation script, never in the app (v1)" vs the planned
  Feynman grader.
- **C-9 Slice F scope after D-4**: reduce F to retry-safe `record_attempt` (idempotency key, integrity) and drop
  sessions/telemetry tables, or keep them? Slice D: is a `confidence` column on attempts acceptable under D-4?
- **C-8 Collisions**: MF-0058 owns the path screen and `pathProgress` (extend, parity); MF-0059 owns group ↔ path;
  MF-0061 edits `platform-foundations` options; new item kinds need `check:packs` + review.

## Split (user decisions D-1, D-5, D-6) — tickets reserved 2026-11-06

A = **MF-0062** (this ticket) · B = **MF-0068** (#103) · C = **MF-0064** (#99) · D = **MF-0065** (#100) ·
E = **MF-0066** (#101) · F = **MF-0067** (#102). Order: A and F and B first (independent); C after A; E after C;
D after C and F (both change `record_attempt`). F is retry-safe answers only (D-5).

### Draft table (as proposed)

| Slice | Content | Schema | Proof |
|---|---|---|---|
| A | Course map: skill nodes by domain, stage + wilting, Next / Water first, Boss checkpoint; tap → existing mode | none | engine `pathNodes()` unit, UI test, build, browser |
| B | Seed path scenarios (8 personas) | none | plan unit + seed db test |
| C | Lesson player: step list, segmented progress, feedback + Why?, close screen with tree deltas | none | ui tests, browser |
| D | Confidence tap + misconception tags + next-best item | attempts cols, ADR | engine + db tests |
| E | New step kind "order the steps" (from diagrams) | pack schema | check:packs, review |
| F | Sessions/telemetry + idempotent record_attempt | tables, RPCs | db tests |

## Reference journey (user screenshots, 2026-11-06)

14 phone screenshots of Brilliant's "Thinking in Code" course, kept outside the repo: the league screen shows other
people's names. We borrow **mechanics only**; no name, mascot, art or look (ui-design.md: shadcn, tokens, no emoji).

| # | Screen | Mechanic | MindForge reading (draft, council to confirm) |
|---|---|---|---|
| J1 | Home: course, "LEVEL 3", next two lessons (Warm Up, Preventing Errors), one Start | one obvious next step | Today shows "next on your path" with a single Start |
| J2 | "Loading warmup" | warm-up before new material | warm-up = 3 due items from earlier skills (FSRS due), i.e. spaced retrieval |
| J3 | "Complete the program": drag blocks into slots, Check / Skip, 3 dots | constructive problem (Parsons-style) | new interactive item kind: order/fill steps (agent loop, tool-use turn, prompt parts) |
| J4 | Correct +15 XP, Run animation, flag icon | immediate feedback, run the answer, report | reveal key (ADR 0005) + existing Flag; XP is a decision (C-1) |
| J5 | 2/3 "So close!", Review / Skip review | re-try missed items at session end | in-session relearning of the missed item |
| J6 | Warm up complete, total XP | session-end summary | session report from engine figures |
| J7 | "A streak is born", weekday circles | daily return trigger | decision (C-2): streak on activity vs on "due reviews done" |
| J8 | League: weekly XP ranks with names | social competition | conflicts with CONTEXT.md "No per-member figures are ever shown to other members" (C-3) |
| J9 | Level path: Level 2 Loops, Level 3 Branching; nodes done / current / upcoming; a practice node | the path | path (MF-0058) → course pack → domain (level) → skill/lesson nodes; nothing locked (MF-0058) |
| J10 | In-lesson: segmented progress bar, build step | lesson = short sequence of steps | lesson anatomy: card → diagram → build → predict → transfer |
| J11 | "What happens without an `if`?" with a picture | predict the consequence | scenario question over a diagram |
| J12 | Correct + "Why?" | explanation on demand | rationale + citation behind a "Why?" (elaboration) |
| J13 | harder build (4 options, nested ifs) | faded scaffolding, rising difficulty | difficulty steps inside one lesson |
| J14 | summary: pseudocode next to Python | concept → real-world transfer | transfer step: the concept as real SDK / Claude Code config |

# Slice A design (MF-0062, 2026-11-06)

Everything above is the umbrella record. From here on, this ticket is **slice A only**: the course map.

## Affected (slice A)

- **Roles:** a signed-in learner, on their own memory only (RLS-bound reads). No other member's data is read or shown.
- **Surfaces:** new route `/play/[packSlug]` (the course map) for every pack; the sidebar Play group gets a
  **Course map** item; the path page's course rows (MF-0058) link to each course's map. No table, no migration.
- **Engine:** new `src/engine/path/{node-mode,next-step,course-map}.ts`, exported from `@/engine/path`.
- **Feature:** new `src/features/course-map/` (the view + `utils/start-node.ts`, the node → mode entry point).

## Facts (re-derived from source, 2026-11-06)

- F-1 ✓ Sapling = stability ≥ 3 d (`src/engine/forest/tree-stage.ts:22`, `>=` at :43); wilting = retrievability
  < 0.85 (:25, :54), and a Seed never wilts. So "node done = Sapling" is the existing `GROWN_STAGES`
  (`src/engine/path/is-course-complete.ts:5`) = the Course complete rule; no new rule.
- F-2 ✓ There is **no skill-scoped Walk**: `/play/[packSlug]/walk` takes no skill parameter
  (`walk/page.tsx`). Skill-scoped today: only Seed Planting `/play/[packSlug]/plant/[skill]`. Pack-wide: Walk, Duel,
  Cuckoo. The council's "skill-scoped Walk" does not exist, so a Sprout node opens Seed Planting (see Decided).
- F-3 ✓ The Daily Walk waters every wilting skill first (`src/engine/memory/plan-walk.ts:78`), so "Water first" →
  Walk is honest: the walk contains that skill (cap 10).
- F-4 ✓ A Boss Storm needs `pack.exam`; without one the page shows `StormUnavailable`
  (`storm/boss/[domain]/page.tsx:35`, MF-0052 SC-2). Only `ccdv-f` has an `exam:` block today (8 packs read).
- F-5 ✓ No page exists at `/play/[packSlug]` (only `cuckoo duel plant storm walk` under it).
- F-6 ✓ `summarizeForest` orders its focus list wilting first, then heaviest weight, then skill code
  (`summarize-forest.ts:104`). Today's briefing shows `focus[0]`.
- F-7 ✓ Shipped packs have 2–8 domains (no one-domain pack); `team-onboarding-sample` has 2. The one-domain case is
  proved in the engine oracle only.
- F-8 ✓ The path page reads each course's forest with `getMyCourseForest` (`paths/[pathSlug]/page.tsx`) and shows
  `summarizeForest` stage counts and fading count per course (`path-view/utils.ts buildCourseRows`).

## Decided without a question (slice A)

- **Map route = `/play/[packSlug]`**, titled "Course map" for every pack kind — follows from D-2 (any pack) and F-5;
  "Play" already groups the pack's modes. `CONTEXT.md` gets a **Course map** entry (it wins on naming).
- **Node = skill, in pack order** (domain order, then skill order from `pack.yaml`) — council "Path node = skill".
- **Node done = Sapling or above, wilting counts** — `GROWN_STAGES`, F-1.
- **Mode per node** (`nodeMode`), only modes that exist today (brief; F-2, F-3):
  wilting (any stage) → Daily Walk · Seed or Sprout, not wilting → Seed Planting when the skill has something to
  plant (`plantableSkills`, MF-0010), else Daily Walk · Sapling / Tree / Ancient, not wilting → Scenario Duel.
- **One next step** (`nextStep`): any wilting node → **Water first** on the first wilting skill in
  `summarizeForest` focus order (so it is the same skill as Today's top focus, F-6); else **Next** on the first Seed
  in map order (new material moves the learner forward; a sprout grows only after a recall on a later day, council
  ts-fsrs probe, so pointing back at a just-planted sprout would be a futile loop); else the first Sprout in map
  order; else **done** (every node at Sapling and none wilting).
- **Boss Storm checkpoint**: one per domain, at the end of the domain, only when the pack has `exam:` (F-4, MF-0052:
  a Storm is a mock exam; linking a course pack to "no mock exam" is a dead end). It is **Ready** when every node of
  the domain is done, else it shows "k of n at Sapling"; it always links (nothing is locked, CONTEXT.md Path).
- **Figures**: done / total / fading come from the engine (`courseMap`, which calls `summarizeForest` for total and
  fading); parity with the path page's course row is a test (SC-5).
- **Honest rewards (D-3)**: the map shows no XP, streak or league, and no "this week" figure in slice A.
- **Start node contract** for MF-0064: `startNodeHref({ packSlug, skillCode, mode })` in
  `src/features/course-map/utils/start-node.ts` is the only place a node becomes a URL. MF-0064 swaps its target.
- **Same forest as the path page**: the map reads `getMyCourseForest` (no `finalizeExpiredStorms`, like the path
  page), so a course's stage counts are equal on both screens.

## Success Criteria (slice A)

- [x] SC-1: `nodeMode({ stage, wilting, isPlantable })` returns the mode per the edge table (rows M1–M7). Proof:
  oracle `src/engine/path/__tests__/mf-0062-course-map.acceptance.test.ts`, literals from the table.
- [x] SC-2: `nextStep(forest)` returns `{ kind: "water" | "next", skillCode }` or `{ kind: "done" }` per the edge
  table (rows N1–N10), including the Sprout/Sapling boundary (2.99 d vs 3.0 d) and the wilting boundary (R 0.85 vs
  0.8499) through the real `treeStage`. Proof: same oracle file.
- [x] SC-3: `courseMap({ forest, plantable, hasExam })` groups nodes by domain in pack order, each with stage,
  wilting, `isDone`, mode; per domain `doneCount` / `skillCount` and a checkpoint (`{ isReady }`, or `null` without
  an exam); map `doneCount`, `totalSkills`, `wiltingSkills`, `next`. Rows C1–C6. Proof: same oracle file.
- [x] SC-4: `startNodeHref` maps plant → `/play/<pack>/plant/<encoded skill>`, walk → `/play/<pack>/walk`, duel →
  `/play/<pack>/duel`; `bossStormHref` → `/play/<pack>/storm/boss/<domain>`. Every target route exists in
  `src/app/(app)/play/[packSlug]/`. Proof: `src/features/course-map/__tests__/mf-0062-start-node.acceptance.test.ts`.
- [x] SC-5: Parity. For the same forest, `courseMap(...).totalSkills` and `.wiltingSkills` equal
  `summarizeForest(forest)` (what the path page's course row shows), `doneCount === totalSkills` exactly when
  `isCourseComplete(forest)`, and a `water` next step names `summarizeForest(forest).focus[0]` (Today's top focus).
  The map page and the path page both read `getMyCourseForest`. Proof:
  `src/features/course-map/__tests__/mf-0062-map-parity.acceptance.test.ts`.
- [x] SC-6: The map view (`CourseMap`), given a `CourseMap`: one section per domain with its name; nodes in order,
  each with the stage word, "Fading" when wilting, "Done" when done, and a link named "<mode label>: <skill name>"
  to `startNodeHref`; exactly one node carries "Next" or "Water first" (none when done); one primary **Start**
  link in the banner to the same href as that node; the done state says "Every skill is at Sapling"; a checkpoint
  link "Boss Storm: <domain>" with "Ready" or "k of n at Sapling" when the pack has an exam, and no checkpoint
  otherwise; no text "XP", "streak" or "league". Proof: RTL
  `src/features/course-map/components/course-map/__tests__/mf-0062-course-map-view.acceptance.test.tsx`.
- [x] SC-7: Entry points. The sidebar Play group has a **Course map** item (tooltip, link `/play/<primary pack>`)
  when given `mapHref`, and the MF-0052 / MF-0054 / MF-0058 sidebar acceptance files pass unedited; each course row
  on `/paths/claude-developer` links to `/play/<pack>`. Proof: RTL
  `src/features/app-shell/components/app-sidebar/__tests__/mf-0062-map-link.acceptance.test.tsx` + browser.
- [x] SC-8: Screen. `/play/ccdv-f` and one course pack (`/play/ai-capabilities`) render the map for the dev-seed
  account (`MF_AUTHOR_EMAIL`), light and dark, and at 375 px with no horizontal scroll; tapping the Start link
  opens the named mode; `/play/no-such-pack` is a 404; signed out redirects to sign-in. Screenshots in
  `.planning/evidence/MF-0062/`. Proof: browser on the local stack after `pnpm db:reset` + `pnpm dev:seed`,
  and `pnpm build` exit 0.
- [x] SC-9: Nothing else moves. Every existing acceptance file passes unedited; `pnpm typecheck && pnpm lint &&
  pnpm test`, `pnpm gate:planning`, `pnpm gate:workspace`, `pnpm build` exit 0; evidence has "See it yourself".

### Edge-input table: `nodeMode` (SC-1)

| # | stage | wilting | plantable | mode | Decided by |
|---|---|---|---|---|---|
| M1 | seed (never attempted) | false | yes | plant | draft (F-2, MF-0010) |
| M2 | seed | false | no (nothing to plant) | walk | draft (Walk offers "new") |
| M3 | sprout | false | yes | plant | draft (F-2: no skill-scoped Walk) |
| M4 | sprout | false | no | walk | draft |
| M5 | sprout | true | yes | walk | draft (F-3: Walk waters it) |
| M6 | sapling / tree / ancient | true | either | walk | draft (F-3) |
| M7 | sapling / tree / ancient | false | either | duel | council (Sapling+ → Duel) |

### Edge-input table: `nextStep` / `courseMap` (SC-2, SC-3)

| # | Input | next | Other shown result | Decided by |
|---|---|---|---|---|
| N1 | no memory at all (every skill a Seed) | next: first skill of first domain | done 0 of N, fading 0 | draft |
| N2 | a skill never attempted, others Sapling healthy | next: that Seed | | draft |
| N3 | all wilting (mixed weights) | water: heaviest wilting; tie → lower skill code | fading = N | F-6 |
| N4 | all done (Sapling+), none wilting | done | done N of N; every checkpoint Ready | draft |
| N5 | all done, one Sapling wilting | water: that Sapling | done N of N (wilting counts) | MF-0058 C-1 |
| N6 | Seeds and Sprouts, none wilting, Sprout first in order | next: the first Seed (after the Sprout) | | draft (futile-loop rule) |
| N7 | only Sprouts left (rest Sapling), none wilting | next: first Sprout in map order | | draft |
| N8 | Sprout/Sapling boundary: stability 2.99 d vs 3.0 d, R 0.95 | 2.99 → sprout, not done; 3.0 → sapling, done | | FOREST_THRESHOLDS |
| N9 | wilting boundary: R 0.85 vs 0.8499 (Sprout) | 0.85 → not wilting; 0.8499 → water | | FOREST_THRESHOLDS |
| N10 | a Seed with only wrong attempts (successfulRecalls 0) | treated as a Seed: next, never water | Seeds never wilt (F-1) | tree-stage.ts |
| C1 | a pack with one domain | one domain, one checkpoint (exam) | | draft |
| C2 | pack without `exam:` | every checkpoint `null` | | MF-0052 (F-4) |
| C3 | domain with every node done | checkpoint Ready | | draft |
| C4 | domain with k of n done | checkpoint not ready, "k of n at Sapling" | | draft |
| C5 | skill order | nodes keep pack order inside a domain, domains keep pack order | | council |
| C6 | an empty forest (no regions) | done, totals 0 | | draft (never complete, MF-0058) |

## Constraints → how met (slice A)

- No schema (D-4) → no migration, no new server read; the page composes existing reads (`getMyCourseForest`,
  `getPackContent`, `getReviewContext`, `getPack`).
- Figures from the engine, never component arithmetic → `courseMap` owns done / total / fading / next; the view
  only formats them. Parity test SC-5 binds the map to `summarizeForest` / `isCourseComplete`.
- Per-user data never cached → the page reads under `<Suspense>` with a skeleton, nothing `use cache`.
- Honest rewards (D-3) → no XP, streak, league; SC-6 asserts their absence.
- Nothing locked (CONTEXT.md Path) → every node and checkpoint links, whatever its state.
- MF-0058 owns the path screen → only the course row gains a link; `pathProgress` unchanged.
- shadcn only, tokens only, lucide icons, `StageIcon`; status as words ("Next", "Water first", "Fading", "Done",
  "Ready").
- Privacy: the map reads the viewer's own memory only (RLS); nothing from other members.

## Out of Scope (slice A)

- The lesson player and any new step kind (MF-0064, MF-0066); a skill-scoped Walk (would be MF-0064's lesson).
- Storm results on the checkpoint ("passed" state): needs storm-result reads per domain; follow-up proposal.
- "Trees grown / watered this week" (D-3 honest reward): needs attempt dates in the view; slice C close screen.
- Seed personas (MF-0068), confidence (MF-0065), retry-safe answers (MF-0067).

## Iteration Log

<!-- append-only -->
- 2026-11-06 Stage 0: MF-0062 from `pnpm ticket:github next`. Session branch `feat/MF-0059` (other ticket) — not switched; suggest `git switch -c MF-0062` before BUILD.
- 2026-11-06 intake: user sent 14 reference screenshots (Brilliant mobile); journey J1–J14 recorded above. Council (6 agents) running.
- 2026-11-06 intake: council reports in (learning science, UX, data, seed/QA, adaptive tutor, skeptic). Findings, C-1..C-8 and split A–F recorded; key claims re-checked against source (Q-2, ADR 0004/0006, tree-stage thresholds, §2.2 streaks, replay grading).
- 2026-11-06 checkpoint 1: user answered D-1..D-4 (timing all now; map any pack; honest rewards; DB guards only). C-1..C-4 closed; C-9 opened (F/D vs D-4).
- 2026-11-06 split: MF-0062 retitled to slice A (tier normal). Reserved B–F as MF-0068, MF-0064, MF-0065, MF-0066, MF-0067 (issues #103, #99–#102). First reservation attempt mis-numbered B–F because `ticket:github next` failed once; builds_on fixed and re-synced. Next: DESIGN for slice A.
- 2026-11-06 branch: worktree `/Users/sorinvieriu/Projects/mind-forge-MF-0062` on branch `MF-0062` (front matter fixed).
- 2026-11-06 design (slice A): Facts F-1..F-8 re-derived from source; SC-1..SC-9, edge tables M1–M7, N1–N10, C1–C6;
  decisions recorded under "Decided without a question (slice A)". No open concern with a non-agent owner for slice A
  (C-1..C-9 above are umbrella concerns, closed by D-1..D-6 or owned by slices C–F).
- 2026-11-06 design preflight: `pnpm typecheck` 0 · `pnpm lint` 0 · `pnpm test` 0 (195 files, 1085 tests) · `pnpm build` 0 · `pnpm gate:planning` 0 (69 folders) · `pnpm gate:workspace` 0 · `pnpm test:db` not run: no SC names it, no `supabase/**` or `src/server/**` change · `pnpm db:reset` + `pnpm dev:seed` not run: TEST-stage browser step under the shared db lock (U-2 allows the local reset) · `pnpm check:packs` not run: no `packs/**` change · main CI `success` on 660f1c1.
- 2026-11-06 freeze (2b): 5 acceptance files written from the SCs, formatted, typecheck + lint green, RED at runtime only (stubs throw `not implemented`; view stub renders null; map page absent); full `pnpm test` shows reds only in those 5 files (42 failed / 1089 passed). `FROZEN.json` written (sha256 over LF content). Absence cases green at freeze by design (regression locks), listed in LOOP-VERIFY.
- 2026-11-06 plan: LOOP-PLAN.md iteration 1 (tier normal: proceed without approval). `pnpm ticket:collisions MF-0062` exit 0 ("no unlisted collisions … across 93 file(s)") after listing the 3 sidebar frozen files as read, no re-freeze.
- 2026-11-07 build: engine `nodeMode`/`nextStep`/`courseMap` (TDD inside the frozen frame), `startNodeHref` contract, `CourseMap` view (Server Component, no hooks), `/play/[packSlug]` page, sidebar Course map item (optional `mapHref`), path course rows link to the map, `CONTEXT.md` Course map entry. Frozen hashes 5/5 unchanged.
- 2026-11-07 plan amended (coordinator PLAN-RULES, MF-0060 gate): CONTEXT.md moved from ui-builder T3 to an `orchestrator` task T4 that also owns LOOP-VERIFY.md; MF-0060 checker ok.
- 2026-11-07 test: typecheck 0 · lint 0 · `pnpm test` 202 files / 1143 tests · gate:planning ok · gate:workspace ok · `pnpm build` 0. Two earlier runs under load 51/28 had timeout-only failures in unrelated files (re-run alone green). Browser on the local stack (db + web lock held, `pnpm db:reset` + `pnpm dev:seed`, `next dev -p 3003`: 3001 is the user's, 3002 held by a main-checkout server): ccdv-f map (Water first, 8 checkpoints), ai-capabilities map from the path row (Next on the first Seed, no checkpoints), Start → Seed Planting, 404, dark + 375 px no horizontal scroll. Screens saved as JPEG (MCP cannot write PNGs outside the main checkout).

### Iteration 1

```yaml
phase: 1-complete
verdict: PASS
started_at: "2026-11-06"
completed_at: "2026-11-07"
```

**Result:** PASS: SC-1..SC-9.
**Suggested commit message:** `MF-0062 feat: course map with skill nodes, real stage and health, one next step, on any pack`
- 2026-11-07 review fixes (REVIEW.md APPROVE-WITH-FIXES on c2495b676dd8): F1 banner `min-h-10` + RTL test; F2 water copy softened + gap recorded for MF-0064; F7 `packDuelHref` for the done banner; F8 `cn()`; F9 LOOP-PLAN front matter. Frozen files untouched. Ladder green (204 files / 1147 tests, build 0); code tree 3ddad9d800cf.
