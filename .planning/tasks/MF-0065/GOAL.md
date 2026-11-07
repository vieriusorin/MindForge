---
ticket_id: MF-0065
title: "Confidence-graded recall, misconception tags and smarter next question (slice D)"
tier: high-risk                   # attempts column, record_attempt signature, FSRS grading change (new ADR)
stage: handoff
branch: MF-0065
builds_on: [MF-0062, MF-0064, MF-0067]
last_iteration: 0
goal_status: complete-pending-manual-commit             # reserved by MF-0062 (council split, user decision D-1); picked up with /gsd-goal-loop MF-0065
---

> Reserved 2026-11-06 from MF-0062 (learning-path council, split slice). Decisions D-1..D-6 and findings live in
> `.planning/tasks/MF-0062/GOAL.md`; re-derive each fact at pickup (`## Facts`) before asking the user.

## Objective

**Today.** Grading is binary: a correct answer is FSRS `Good`, a wrong one `Again` (`src/engine/memory/replay.ts`).
A lucky guess grows a tree as fast as a sure recall, and a confident wrong answer (the learner *believes* a false
thing) is treated like a shrug. The wrong option a learner picks is stored (`attempts.chosen`) and never read, and no
pack says which misunderstanding a distractor stands for. The lesson player (MF-0064) orders a skill's items
wrong-last → unseen → least recent and picks its "confusable" step as the nearest earlier skill only, because packs
declare no confusable link; the Daily Walk re-asks the least recently seen item even when another was just missed.

**End state.** Before the reveal the learner may tap **Sure** or **Not sure** (Duel, Daily Walk, Seed Planting
checks, lesson recall). The tap is stored on the attempt in the same database call that grades it, and the engine
grades with it: correct + sure = `Good`, correct + not sure = `Hard`, wrong = `Again`; a **confident miss** (wrong +
sure) also puts the skill in the Daily Walk to be watered within 24 h, and the lesson close screen's next review is
at most 24 h after it. No tap = today's binary grading. ADR 0007 records this beside ADR 0005. Distractors carry
misconception tags in a per-pack `misconceptions.yaml` (validated by `pnpm check:packs`, the `subagents` pack tagged
and reviewed); a pure engine tally reads `chosen`, and the lesson close screen names the mix-up the learner fell for
in that lesson. A misconception that names another skill makes that skill **confusable**: the lesson's confusable
step prefers it. The Daily Walk re-asks the item last answered wrong. No group figure ever reads confidence.

## Facts (re-derived 2026-11-07 at pickup, branch MF-0065 = 709b938 + MF-0064 07fd567)

- F-1 `record_attempt` is the 4-arg pair `(text, text[], text default null, uuid default null)`, private definer +
  public invoker wrapper, returns `boolean`; replay first (MF-0067), comparing question / chosen / hash with
  `is distinct from` (review note 2 folded in by MF-0067's delta, `20261106160700_mf0067_attempt_idempotency.sql:69`).
  Grants: execute to `authenticated` only. MF-0032 SC-7 and MF-0067 SC-7 pin the pg_proc list to that one signature.
- F-2 ts-fsrs 5.4.2 probe (fuzz off, `scratchpad/mf65-probe.mjs`), first answer on a new card: `Again` S = 0.2120,
  `Hard` S = 1.2931, `Good` S = 2.3065 (all stay in the learning state, due in 1 / 6 / 10 min). Good on day 0 then on
  day 1: `Again` 0.5713, `Hard` 5.3188, `Good` 7.3153 (so correct + not sure still reaches Sapling, 3 d, more slowly).
  A Sapling of S 36.12 d lapsing (`Again`) on day 20 gets S 2.3992 and R = 1.0000 at +0 h and +12 h, 0.9485 at +24 h,
  0.8839 at +72 h: after a lapse the skill is a non-wilting Sprout for days, so FSRS alone would NOT bring it back
  within 24 h (wilting is R < 0.85, `tree-stage.ts`). ts-fsrs floors elapsed days (MF-0015), hence R 1.0 at +12 h.
- F-3 "Review within 24 h" therefore cannot come from the FSRS rating. D-4 (the engine decides) rules out a stored due
  override: it is derived in the engine from the attempt itself (latest attempt of the skill is wrong + sure).
  Consumers that schedule: `planWalk` (water list, `plan-walk.ts:78`) and MF-0064's `nextReviewAt`
  (`src/engine/memory/next-review.ts`, the close screen's next review).
- F-4 Group figures: the heatmap replays other members' attempts in TS from `public.group_attempts`, whose jsonb
  rows are built field by field (`20261104100000_mf0011_group_heatmap.sql:60`) with no confidence; expedition progress
  counts `a.correct` in SQL (`20261106140000_mf0059_path_groups.sql:105`); course completions are read-own only
  (MF-0058 RLS). So the only path by which confidence could reach a group figure is a future change to the heatmap
  replay — guarded in the engine (SC-7).
- F-5 Item hashes cover the whole raw YAML item (`item-hashes.ts`), and reviews bind to `(item_id, content_hash)`
  (MF-0007). A tag written inline on an option would change every tagged item's hash: approvals reset, and in-flight
  learners get "changed". MF-0061 is rewriting options in 8 packs right now (its worktree: ccdv-f 24 files,
  prod-prompting 9, claude-code-in-action 7, agent-skills 7, ai-capabilities 6, platform-foundations 2) and does not
  touch `subagents` (48 questions).
- F-6 MF-0064 already orders a lesson's items wrong-last → never answered → least recent (`plan-lesson.ts`
  `orderedItems`, D-L6). The Duel and Spot the Cuckoo pick `leastRecentlySeen` (`select.ts`), and MF-0016 SC-5
  (frozen) asserts a never-seen item beats an item last answered wrong — so changing those pickers is a re-freeze.
  `planWalk` has no frozen wrong-last case (`mf-0009-plan-walk.acceptance.test.ts` has no wrong attempt).
- F-7 Packs declare no confusable link (MF-0064 F-2; `grep -rni confus packs` → no hit).
- F-8 MF-0067 review note 6 (replay verdict vs revealed key): the stored attempt keeps the registry hash it was graded
  against, a replay with another hash is 23505, and the app refuses a hash that differs from the deployed file
  (`checkQuestionAnswer`, MF-0032) before the RPC. Same hash ⇒ same raw item ⇒ same key, so the key revealed on a
  replay is the key that produced the first grade. Decided: keep, and prove it (SC-3).
- F-9 Frozen UI tests click "Check answer" by name in every mode (MF-0012, MF-0026, MF-0032, MF-0067, MF-0064) and
  MF-0032 pins the exact Duel payload (`toEqual(EXPECTED)`). An optional tap that adds `confidence` only when tapped
  keeps all of them unedited.
- F-10 Baseline 2026-11-07: typecheck 0, lint 0 (863 files), test 1329/1329, test:db 205/205 after db:reset,
  check:packs 0; main CI `success`.

## Affected

- **Roles:** a signed-in learner, on their own attempts only. No admin surface. Group members see nothing new.
- **Surfaces:** `public.attempts.confidence` (new nullable column), `record_attempt` (5th parameter), DB types;
  `src/engine/memory/**` (grading, confident miss, next item), `src/engine/forest/group-heatmap.ts` (guard),
  new `src/engine/misconceptions/**`, `src/engine/lesson/plan-lesson.ts` (confusable preference);
  `src/lib/answer-input.ts`, `src/lib/attempt-id.ts`, `src/server/attempts/grade-answer.ts`,
  `src/server/memory/fetch-attempts.ts`, new `src/server/content/get-pack-misconceptions.ts`; a shared
  `src/components/confidence-tap/`; Duel, Walk, Seed checks and lesson player hooks + footers; lesson pages
  (player + done); `scripts/check-pack-grounding.mjs`; `packs/subagents/misconceptions.yaml`;
  `docs/adr/0007-*.md`; `CONTEXT.md`.

## Decided by the user (2026-11-06)

- D-4 (MF-0062): DB = guards and integrity only; the engine decides. D-6: store confidence and grade with it
  (correct + unsure = Hard, wrong + sure = Again + review within 24 h); new ADR beside ADR 0005; no group figure
  ever from confidence (brief 2026-11-07).
- U-1 Merge by the orchestrator; this ticket never commits. U-2 plans approved by the orchestrator, fresh-context
  diff reviewer before merge; `pnpm db:reset` on the LOCAL stack allowed under the db lock. U-3 / U-4 n/a.
- Re-freezes of other tickets' frozen files are approved by the user: listed in LOOP-PLAN, reported, not silent.
- 2026-11-07: the re-freeze batch (MF-0032 SC-7 and MF-0067 SC-7, signature literal only) is APPROVED by the user (relayed by the orchestrator after the fresh-context review). Recorded in both FROZEN.json histories.

## Decided without a question

- DQ-1 `record_attempt` gains `p_confidence text default null`, appended (5th); the 4-arg pair is dropped (MF-0032 /
  MF-0067 pattern); return type stays `boolean`. Values `'sure' | 'unsure' | null`; anything else → 22023, nothing
  written. Column `attempts.confidence text null check (confidence in ('sure','unsure'))`. Source: F-1, D-6.
- DQ-2 Confidence is part of "the same answer" for idempotency: a seen id with a different confidence (null vs a
  value included) → 23505, nothing written, compared with `is distinct from` (MF-0067 note 2). Client side the
  submission key includes the confidence, so a learner who changes the tap after a network error mints a new id.
- DQ-3 The grade (`correct`) never depends on confidence: the key alone decides it. Confidence only changes the FSRS
  rating, in the engine (D-4).
- DQ-4 Rating: correct + `sure` → Good; correct + `unsure` → Hard; wrong (any confidence) → Again; no confidence
  (legacy rows, storms, cuckoo, SQL callers, a learner who did not tap) → Good / Again as before. Hard counts as a
  successful recall (it was correct). Source: D-6, F-2.
- DQ-5 Confident miss = the skill's latest attempt is wrong + `sure`. While it stands (until any later attempt on
  that skill), `planWalk` lists the skill as **water** whatever its stage or R, and `nextReviewAt` is
  `min(fade date, missAt + 24 h)`. It never changes the forest's stage or "Fading" (forest figures stay pure FSRS).
  `CONFIDENT_MISS_REVIEW_HOURS = 24`. Source: D-6 + F-2/F-3 (derived from the attempt, no stored due date, D-4).
- DQ-6 The tap is **optional**: two toggle buttons "Sure" / "Not sure" (shadcn `Button`, `aria-pressed`, in a
  labelled group "How sure are you?") beside "Check answer"; tapping the pressed one again clears it; disabled
  while checking and after the verdict; reset on Next. No tap sends no `confidence` field. Reason: no forced extra tap
  per question, and every frozen "Check answer" / payload test stays valid (F-9). Modes: Duel, Daily Walk, Seed
  Planting checks, lesson recall/confusable/re-ask steps. Not Spot the Cuckoo (a line pick, `CuckooAnswerInput`
  unchanged) and not storms (exam conditions; `finish_storm` writes null).
- DQ-7 Misconception tags live in `packs/<pack>/misconceptions.yaml`, not inline on options: item hashes and reviews
  stay valid, and MF-0061's option rewrites do not collide (F-5). Shape:
  `misconceptions: [{ id, label, skill? }]` and `tags: { <questionId>: { <optionId>: <misconceptionId> } }`.
  Rules (check:packs + loader): id kebab-case, unique; label non-empty; `skill` a skill of the pack; a tagged question
  exists in the pack; a tagged option exists and is a distractor (`correct: false`); the tag names a declared
  misconception; every declared misconception is used at least once; the file is optional. Source: ADR 0001
  (content in files), F-5.
- DQ-8 Tagged pack in this ticket: `subagents` (untouched by MF-0061, F-5). Tags are drafted from each distractor's own
  rationale and reviewed by a fresh-context reviewer before hand-off; the other packs follow after MF-0061 merges
  (proposed follow-up).
- DQ-9 Tally (`misconceptionTally`): over the given attempts, every wrong attempt adds 1 to each tagged misconception
  among its `chosen` options; correct attempts and untagged options add nothing. Sorted by count desc, then the most
  recent pick desc, then id. Own attempts only.
- DQ-10 Confusable skills (`confusableSkills`): for a skill, the `skill` named by misconceptions tagged on that skill's
  distractors (excluding itself), ordered by tag count desc then skill code. `planLesson` takes them as an optional
  ordered `confusable` list: the first one already met (not a Seed) with a servable item becomes the confusable step;
  none qualifies → MF-0064's nearest-earlier rule. The step stays last in the lesson (MF-0064 D-L5 unchanged).
- DQ-11 Next item in a skill: MF-0064's ordering (wrong-last, least recently wrong first → never answered in file
  order → least recently answered) is moved to one engine function `orderSkillItems` in `src/engine/memory`, used by
  `planLesson` (same behaviour) and by `planWalk` (new: the walk re-asks the item last answered wrong). The Duel and
  Spot the Cuckoo keep `leastRecentlySeen`: switching them breaks MF-0016 SC-5 (F-6) — proposed as a follow-up with
  its re-freeze, not applied.
- DQ-12 Lesson close mix-up line: for the misconceptions picked during the lesson (attempts since the lesson start),
  the top one is shown as "Mix-up to watch: <label>" with "picked <k> time(s)" — own data, from the engine tally. No
  tags for the pack or no tagged pick → no line.
- DQ-13 MF-0067 note 6: keep (F-8) and prove by a DB test (SC-3).

## Success Criteria

- [x] SC-1: Only `record_attempt(text,text[],text,uuid,text)` exists (private + public), executable by
  `authenticated`, not `anon`; `attempts.confidence` is a nullable text with a CHECK; a call with `p_confidence`
  `'sure'` / `'unsure'` stores it and returns the same grade as without; any other value → 22023 and no row; a call
  without it stores null. Proof: `src/server/db/__tests__/mf-0065-confidence.db.acceptance.test.ts`.
- [x] SC-2: Idempotency includes confidence: same id + same confidence → first grade, one row; same id + another
  confidence, or null vs a value either way → 23505, no write, stored row unchanged. Proof: same file.
- [x] SC-3: A replay is bound to the version that graded it (MF-0067 note 6): after a graded answer with hash H, a
  registry change of key and hash to H2, the same id with H returns the first grade, and with H2 → 23505. Proof:
  same file.
- [x] SC-4: Grading. `ratingFor` returns Good / Hard / Again / Again / Good / Again for (correct, sure) /
  (correct, unsure) / (wrong, sure) / (wrong, unsure) / (correct, none) / (wrong, none); `replayMemory` of one first
  attempt gives stability 2.3065 / 1.2931 / 0.2120 / 2.3065 for correct+sure / correct+unsure / wrong+sure /
  correct+none (±1e-4) and `successfulRecalls` 1 for correct+unsure. Proof:
  `src/engine/memory/__tests__/mf-0065-confidence-grading.acceptance.test.ts` (literals from the F-2 probe).
- [x] SC-5: Confident miss. `confidentMissAt` returns per rows CM1–CM6; `planWalk` lists the CM3 skill with reason
  `water` (a non-wilting Sprout after a Sapling's lapse) and not after a later attempt (CM5) nor for wrong+unsure
  (CM4); `nextReviewAt` is miss + 24 h in CM7 and null in CM8. Proof: same oracle file.
- [x] SC-6: Next item. `orderSkillItems` orders rows NI1–NI5; `planWalk` serves, for a skill, the item last answered
  wrong; every MF-0064 lesson acceptance file passes unedited. Proof:
  `src/engine/memory/__tests__/mf-0065-next-item.acceptance.test.ts` + MF-0064 files.
- [x] SC-7: No group figure from confidence: `groupHeatmap` output is deep-equal whether the viewer's and others'
  attempts carry `sure` / `unsure` or none; `public.group_attempts` rows have no `confidence` key. Proof: engine part in
  the SC-4 oracle file; DB part in the SC-1 DB file.
- [x] SC-8: Misconception files. `parseMisconceptions` accepts a valid file and reports one issue per broken rule of
  DQ-7 (9 rules), plus unreadable YAML / unknown keys; `pnpm check:packs` exits 0 on the shipped packs and prints a `misconceptions:` summary with the
  tagged count; with `MF_PACKS_DIR` pointing at a fixture whose tag sits on a correct option it exits 1 naming the
  file. Proof: `src/engine/misconceptions/__tests__/mf-0065-misconceptions.acceptance.test.ts` +
  `src/test/__tests__/mf-0065-check-misconceptions.acceptance.test.ts` (tests run only under `src/**/__tests__`).
- [x] SC-9: Tally and confusables. `misconceptionTally` and `confusableSkills` return the literals of rows T1–T6 and
  K1–K3; `planLesson` with a `confusable` list picks the first met linked skill, and without one behaves as MF-0064.
  Proof: the SC-8 engine file.
- [x] SC-10: Action input. `AnswerInput` accepts `confidence` `sure` / `unsure` or absent and refuses any other value
  ("Pick an answer first.") in Duel, Walk, Seed Planting and the lesson; `gradeAnswer` sends `p_confidence` (the
  value; no key when absent, so the DB default null applies). Proof: `src/features/__tests__/mf-0065-confidence-input.acceptance.test.ts` +
  `src/server/attempts/__tests__/mf-0065-grade-confidence.acceptance.test.ts`.
- [x] SC-11: The tap. In Duel, Walk, Seed checks and the lesson, the "How sure are you?" group shows "Sure" and
  "Not sure"; tapping one sets `aria-pressed` and the next "Check answer" sends `confidence`; tapping it again
  clears it and nothing is sent; both are disabled after the verdict; after Next nothing is pressed; a retry with a
  changed tap sends a new `clientAttemptId`. Proof: `src/features/__tests__/mf-0065-confidence-tap.acceptance.test.tsx`.
- [x] SC-12: Lesson close names the mix-up: with a tagged pick during the lesson, "Mix-up to watch: <label>" and
  "picked 2 times"; none → no line. Proof: same SC-11 file (LessonClose) + browser.
- [x] SC-13: ADR 0007 exists beside ADR 0005 and states the rating table, the confident-miss 24 h rule, "no group
  figure from confidence" and what is rejected; CONTEXT.md defines Confidence, Confident miss, Misconception,
  Confusable skill. Proof: review + `pnpm gate:workspace`.
- [x] SC-14: Gates and screen: `pnpm typecheck && pnpm lint && pnpm test`, `pnpm test:db` (after `pnpm db:reset`),
  `pnpm build`, `pnpm check:packs`, `pnpm gate:planning`, `pnpm gate:workspace` exit 0; `pnpm db:types` regenerated;
  every other ticket's acceptance file passes (re-frozen ones as listed in LOOP-PLAN); browser on the local stack:
  Duel with "Sure" tapped writes a row with `confidence = 'sure'` (SQL read-back); a `subagents` lesson shows the tap
  and the close screen (light, dark, 375 px). Screenshots in `.planning/evidence/MF-0065/`.

### Edge-input table: rating and confident miss (SC-4, SC-5)

| # | Skill's attempts (oldest → newest) | Rating of last | Confident miss | Walk | Decided by |
|---|---|---|---|---|---|
| CM1 | none | — | null | unseen/new | planWalk |
| CM2 | correct+sure | Good | null | as FSRS says | DQ-4 |
| CM3 | Sapling, then wrong+sure (non-wilting Sprout after) | Again | the miss time | water | DQ-5, F-2 |
| CM4 | Sapling, then wrong+unsure | Again | null | strengthen (FSRS) | DQ-5 |
| CM5 | wrong+sure, then correct+unsure | Hard | null | as FSRS says | DQ-5 (cleared) |
| CM6 | wrong (no confidence, legacy) | Again | null | as FSRS says | DQ-4 |
| CM7 | nextReviewAt after CM3: fade at ≈ +4 d vs miss + 24 h | — | — | next review = miss + 24 h | DQ-5 |
| CM8 | wrong+sure on a Seed (no recall yet) | Again | miss time | water (already, Seed) | planWalk; nextReviewAt null (MF-0064: a Seed never fades) |

### Edge-input table: next item in a skill (SC-6)

| # | Items (file order) and last answers | Order | Decided by |
|---|---|---|---|
| NI1 | q1 never, q2 never | q1, q2 | file order |
| NI2 | q1 right (t1), q2 never | q2, q1 | unseen before right |
| NI3 | q1 never, q2 wrong (t1) | q2, q1 | wrong first (vs MF-0016 picker) |
| NI4 | q1 wrong (t2), q2 wrong (t1) | q2, q1 | least recently wrong first (MF-0064 D-L6) |
| NI5 | q1 right (t1), q2 right (t2), q3 wrong (t0) then right (t3) | q1, q2, q3 | last answer counts |

### Edge-input table: tally and confusables (SC-9)

| # | Input | Result | Decided by |
|---|---|---|---|
| T1 | no attempts | [] | DQ-9 |
| T2 | one wrong attempt choosing a tagged distractor | [{ id, count 1 }] | DQ-9 |
| T3 | a correct attempt | ignored | DQ-9 |
| T4 | wrong, untagged option | [] | DQ-9 |
| T5 | multi-select wrong picking two options tagged with two misconceptions | both count 1 | DQ-9 |
| T6 | m-a picked 2×, m-b 2× (m-b later), m-c 1× | m-b, m-a, m-c | count, then recency |
| K1 | skill without tags | [] | DQ-10 |
| K2 | tags naming skill X twice, Y once, and the skill itself | [X, Y] | DQ-10 |
| K3 | misconceptions without `skill` | [] | DQ-10 |

## Constraints → how met

- D-4 DB integrity only: the DB stores and bounds confidence and keeps idempotency; the rating, the 24 h rule and
  the next item are engine functions over attempts. No stored due date.
- Migrations: RLS unchanged; `revoke` before `grant`; definer only in `private`, `search_path = ''`; no grant change
  on `public.attempts` (authenticated still has no INSERT/UPDATE/DELETE).
- No group figure from confidence: `group_attempts` unchanged (no confidence field); the heatmap replay strips
  confidence before replaying (engine guard, SC-7); expeditions count `correct` in SQL. Confidence is read-own (RLS on
  attempts). No group output gains an input, so viewer invariance (MF-0021) is unaffected.
- Every figure from the engine: rating, review time, tally, confusables; the close screen formats engine output.
- Validate at the boundary: zod `z.enum(["sure","unsure"]).optional()` in `AnswerInput`; misconception YAML parsed by
  zod in the engine; DB CHECK + 22023 as the integrity backstop.
- shadcn only, tokens only: the tap is two `Button`s; no new primitive.
- Privacy: confidence is a self-report about one's own knowledge, stored with the attempt under the same RLS and
  retention as the attempt; it is never shown to anyone else (ADR 0007).

## Concerns

| # | Collision | Owner | Status |
|---|-----------|-------|--------|
| C-1 | MF-0032 SC-7 and MF-0067 SC-7 pin the 4-arg signature literal | user | resolved: re-freeze approved by the user 2026-11-07 |
| C-2 | "Next item: last wrong first" vs MF-0016 SC-5 (frozen: never-seen beats last-wrong in Duel/Cuckoo) | user | not applied (DQ-11); proposed follow-up with that re-freeze |
| C-3 | Optional tap means some learners never tap → binary grading for them | agent (DQ-6) | accepted: same as today; a required tap would break 5 tickets' frozen tests and adds a forced step |
| C-4 | Tagging other packs while MF-0061 rewrites their options | agent (DQ-8) | deferred: follow-up after MF-0061 |

## Out of Scope

- Confidence in Spot the Cuckoo and storms; a required tap; confidence shown in any group view or export.
- Tags for packs other than `subagents` (follow-up after MF-0061); a UI listing all misconceptions.
- Changing the Duel / Cuckoo picker (C-2); moving the lesson's confusable step out of the last position.
- Back-filling confidence on existing rows (null = legacy grading).

## Open questions

- None.

## Iteration Log

<!-- append-only -->
- 2026-11-06 reserved from MF-0062.
- 2026-11-07 picked up (branch MF-0065, issue #100); fast-forwarded onto MF-0064 07fd567 on the coordinator's instruction. Facts F-1..F-10 re-derived (ts-fsrs probe in the scratchpad).
- 2026-11-07 design preflight: `pnpm typecheck && pnpm lint && pnpm test` exit 0 (1329 tests) · `pnpm db:reset` exit 0 then `pnpm test:db` exit 0 (205 tests), db lock held · `pnpm check:packs` exit 0 · `pnpm build` not run: main CI `success` builds it; runs in TEST · `pnpm gate:planning` / `pnpm gate:workspace` run in TEST · `pnpm db:types` BUILD step under the db lock · main CI `success`.
- 2026-11-07 RED + freeze: 8 acceptance files frozen (FROZEN.json), each red for the SC's reason (stubs throw `not implemented`; DB `PGRST202` for the missing 5-arg function, run twice identical; UI: no "How sure are you?" group). `pnpm test`: the only reds are the 8 frozen files plus MF-0028 SC-4 / MF-0053 SC-5 (`check-planning` on this repo), which fail because MF-0067's GOAL on this base is still `complete-pending-manual-commit`, so its ownership check claims this branch's new files; it clears when the base moves onto main (MF-0067 merged). Not a plan error of this ticket; reported.
- 2026-11-07 PLAN: LOOP-PLAN written; `pnpm ticket:collisions MF-0065` exit 0 after listing 2 re-freezes (MF-0032 SC-7, MF-0067 SC-7: the signature literal only) and 21 read-and-hold files. Re-freeze approval: pending with the user (reported, not silent). `packs/subagents/misconceptions.yaml` drafted by a subagent (40 misconceptions, 134 tags, 2 with `skill`); fresh-context review is T7.
- 2026-11-07 BUILD + TEST: migration `20261107100000_mf0065_attempt_confidence.sql`, db types, engine (grading, confident miss, next item, heatmap guard, misconceptions), server, check:packs, four modes + lesson UI, ADR 0007, CONTEXT.md, subagents tags (fresh-context reviewed: 44 misconceptions, 133 tags). Re-froze MF-0032 SC-7 and MF-0067 SC-7 (signature literal only; user approval PENDING) and 2 own files (fixture invite_code; no-tap sends no `p_confidence` key), history in each FROZEN.json. SC-7 engine non-vacuity: RED with the guard removed. Ladder: typecheck 0 · lint 0 · test 1417/1417 · test:db 212/212 · check:packs 0 · build 0 · gate:planning ok · gate:workspace ok · MF-0060 checker ok. Browser on :3003 (headless CDP): Duel tap + SQL read-back `confidence = sure`; lesson close "Mix-up to watch"; 375 px no horizontal scroll. Hand-off; diff review by the orchestrator.
- 2026-11-07 review (APPROVE, 0 blocking, 2 should-fix) folded in: (1) a confident miss now leads the Daily Walk ahead of the WALK_SIZE cut — regression `src/engine/memory/__tests__/plan-walk-confident-miss.test.ts` RED first (`expected 'S1' to be 'S13'`), green after; (2) the pressed tap is filled (primary) and carries a Check icon — `src/components/confidence-tap/__tests__/confidence-tap.test.tsx` RED first (`expected null not to be null`), green after; (3) note 3: `src/server/db/__tests__/mf-0065-lost-race.db.test.ts` (lost-race tap comparison) RED against a variant without that line (`expected { data: true, code: null … } to deeply equal { data: null, code: '23505' … }`), green on the real migration; notes 5, 7: ADR 0007 revisit trigger names "never tap", CONTEXT.md Lesson entry names the confident-miss review; nit 9: `submissionKey` takes `Confidence | null`. No frozen file touched. Re-freeze batch approved by the user.
