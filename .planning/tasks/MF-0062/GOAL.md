---
ticket_id: MF-0062
title: "Course map: skill nodes with real stage and health, one next step, on any pack (learning-path slice A)"
tier: normal                      # slice A: engine read + UI, no schema; figures come from summarizeForest/pathProgress
stage: design
branch:                           # session is on feat/MF-0059 (another ticket); branch not switched, see Iteration Log
builds_on: [MF-0058]
last_iteration: 0
goal_status: in-progress
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

## Iteration Log

<!-- append-only -->
- 2026-11-06 Stage 0: MF-0062 from `pnpm ticket:github next`. Session branch `feat/MF-0059` (other ticket) — not switched; suggest `git switch -c MF-0062` before BUILD.
- 2026-11-06 intake: user sent 14 reference screenshots (Brilliant mobile); journey J1–J14 recorded above. Council (6 agents) running.
- 2026-11-06 intake: council reports in (learning science, UX, data, seed/QA, adaptive tutor, skeptic). Findings, C-1..C-8 and split A–F recorded; key claims re-checked against source (Q-2, ADR 0004/0006, tree-stage thresholds, §2.2 streaks, replay grading).
- 2026-11-06 checkpoint 1: user answered D-1..D-4 (timing all now; map any pack; honest rewards; DB guards only). C-1..C-4 closed; C-9 opened (F/D vs D-4).
- 2026-11-06 split: MF-0062 retitled to slice A (tier normal). Reserved B–F as MF-0068, MF-0064, MF-0065, MF-0066, MF-0067 (issues #103, #99–#102). First reservation attempt mis-numbered B–F because `ticket:github next` failed once; builds_on fixed and re-synced. Next: DESIGN for slice A.
