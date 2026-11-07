---
phase: 1-planning
ticket_id: MF-0065
status: complete
started_at: "2026-11-07"
resume_with: /gsd-goal-loop
---

# Loop Plan — Iteration 0

## Discovery summary

- `record_attempt` = MF-0067 migration `supabase/migrations/20261106160700_mf0067_attempt_idempotency.sql` (4-arg,
  replay-first, `is distinct from`). Precedent for an appended parameter: drop the old pair, recreate with the new
  parameter `default null`, regrant (MF-0032, MF-0067).
- FSRS rating lives in one line of `src/engine/memory/replay.ts` (`replayCard`, MF-0064). The 24 h rule has two
  consumers: `planWalk` and MF-0064's `nextReviewAt`. The heatmap replays others' attempts via `memoryBySkill` in
  `src/engine/forest/group-heatmap.ts` — the one place a guard keeps confidence out of a group figure.
- MF-0064 already orders a lesson's items (`plan-lesson.ts` `orderedItems`): moved to `orderSkillItems` and reused by
  `planWalk`. `planLesson` gains an optional `confusable` list; the lesson page computes it with `confusableSkills`.
- Content reads: `getPackContent` (cached, `src/server/content/`); misconceptions get a sibling cached read
  `getPackMisconceptions`, loaded with `loadPackMisconceptions` (engine, reads `<packDir>/misconceptions.yaml`).
- `check:packs` (`scripts/check-pack-grounding.mjs`) imports engine TS through `scripts/lib/ts-resolve.mjs` (MF-0058
  `checkPath` precedent): the misconception rule runs there, corpus-free, before the corpus-absent exit.
- The client: four hooks (`use-duel-session`, `use-walk-session`, `use-seed-checks`, `use-lesson-player`) each own
  the submit; a shared `ConfidenceTap` view in `src/components/confidence-tap/` (second feature consumer → shared,
  react-client-patterns rule 9) and a pure `nextConfidence` toggle in `src/lib/confidence.ts`.
- Gates on touched paths: `gate:planning`, `gate:workspace`, `check:packs`; frozen files below.

## Symbols changed

- `record_attempt` (SQL, private + public): signature gains a 5th parameter p_confidence (text) →
  (text,text[],text,uuid,text) (signature literal grepped by hand: only the two SC-7 hits below).
- `replayCard` / `replayMemory`: rating from `ratingFor` instead of correct ? Good : Again (no confidence = same).
- `nextReviewAt`: capped at a confident miss + 24 h (no confidence = same).
- `planWalk`: confident-miss skills are water; the item per skill from `orderSkillItems` (wrong-last first).
- `planLesson`: optional confusable list; item order via `orderSkillItems` (same behaviour).
- `groupHeatmapFromAttempts`: strips confidence before replay (same output).
- `AnswerInput` (src/lib/answer-input.ts): optional confidence.
- `gradeAnswer`: sends p_confidence (no key when absent).
- `submissionKey` (src/lib/attempt-id.ts): optional third part, the confidence.
- `fetchAttempts`: also selects confidence and chosen.
- Additive optional fields, no caller breaks (not backticked): Attempt.confidence / Attempt.chosen, the
  public.attempts confidence column, LessonCloseProps.mixUp, PlanLessonInput.confusable, GradeAnswerInput.confidence,
  QuestionStepProps and the four Use…Return interfaces gaining confidence + chooseConfidence.

## Frozen files this will re-freeze

| File:line | Change (new expected value) | Reason |
|---|---|---|
| `src/server/db/__tests__/mf-0032-attempt-hash.db.acceptance.test.ts` (SC-7 pg_proc list) | sigs `private.record_attempt(text,text[],text,uuid,text)` / `record_attempt(text,text[],text,uuid,text)`; title "only the 5-arg signature"; `auth: true`, `anon: false` unchanged | the signature gains `p_confidence` (C-1) |
| `src/server/db/__tests__/mf-0067-retry-safe.db.acceptance.test.ts:321-341` (SC-7) | same two signature literals; title "only the 5-arg signature exists"; column/unique/grant/legacy assertions unchanged | the signature gains `p_confidence` (C-1) |

Read, assertions hold (no change):

| File:line | Why it holds |
|---|---|
| `src/server/db/__tests__/mf-0003-attempts.db.acceptance.test.ts` | calls the RPC with ≤ 3 args; `p_confidence default null` keeps today's row and grade |
| `src/server/db/__tests__/mf-0016-cuckoo-keys.db.acceptance.test.ts` | same |
| `src/server/db/__tests__/mf-0025-orphan-keys.db.acceptance.test.ts` | same |
| `src/server/paths/__tests__/mf-0058-course-completion.db.acceptance.test.ts` | same (record_attempt without confidence) |
| `src/dev-seed/__tests__/mf-0029-seed.db.acceptance.test.ts` | same (grading parity, 2-arg call) |
| `src/dev-seed/__tests__/mf-0029-plan.acceptance.test.ts:87` | test title only |
| `src/dev-seed/__tests__/mf-0052-seed.db.acceptance.test.ts` | `fetchAttempts` gains two fields; the test reads questionId/skillCode/correct/answeredAt only |
| `src/dev-seed/__tests__/mf-0052-plan.acceptance.test.ts:195-240` | `planWalk` asserts reasons only (water/new present); attempts carry no confidence |
| `src/engine/memory/__tests__/mf-0009-plan-walk.acceptance.test.ts` | one question per skill (`oneEach`), so item order is moot; no confidence, so the water rule is unchanged |
| `src/engine/memory/__tests__/mf-0003-replay.acceptance.test.ts` | no confidence → Good/Again exactly as before |
| `src/engine/memory/__tests__/mf-0064-next-review.acceptance.test.ts` | no confidence → no confident miss → fade date unchanged |
| `src/engine/lesson/__tests__/mf-0064-lesson-outcome.acceptance.test.ts` | same (nextReviewAt without confidence) |
| `src/engine/lesson/__tests__/mf-0064-lesson-plan.acceptance.test.ts` | `orderSkillItems` reproduces D-L6 exactly; no `confusable` → nearest-earlier rule |
| `src/features/lesson/__tests__/mf-0064-node-entry.acceptance.test.ts` | same (planLesson without `confusable`) |
| `src/features/lesson/components/lesson-close/__tests__/mf-0064-lesson-close.acceptance.test.tsx` | `nextReviewAt` values are fixture literals; `mixUp` is optional (absent → no line) |
| `src/engine/forest/__tests__/mf-0011-group-heatmap.acceptance.test.ts` | the guard only strips confidence; fixtures carry none → identical output |
| `src/engine/content/__tests__/mf-0032-answer-hash.acceptance.test.ts` | `AnswerInput` gains an optional field; inputs without it parse as before |
| `src/features/__tests__/mf-0032-changed-message.acceptance.test.ts` | `gradeAnswer` mocked; the forwarded `{ userId, ...INPUT }` has no confidence key when none is sent |
| `src/features/__tests__/mf-0067-attempt-id-input.acceptance.test.ts` | same: exact forward holds without a confidence key |
| `src/features/__tests__/mf-0058-recorder-failure.db.acceptance.test.ts` | calls `answerQuestion` without confidence; `gradeAnswer` sends no `p_confidence` key (DB default null) |
| `src/server/paths/__tests__/mf-0058-recorder-wiring.acceptance.test.ts` | asserts callers exist by name; names unchanged |

Approval: APPROVED by the user 2026-11-07 (relayed by the orchestrator). The new expected values change only the
signature literal; no assertion is weakened.

## Steps

1. T1 migration `supabase/migrations/20261107100000_mf0065_attempt_confidence.sql`: column + CHECK; drop 4-arg pair;
   recreate 5-arg private definer (bounds-check confidence → 22023; replay compare adds
   `v_prev.confidence is distinct from p_confidence`; insert stores it) + public wrapper; revoke then grant. Apply
   locally (`pnpm db:reset`), `pnpm db:types`. Re-freeze the two SC-7 literals with history.
2. T2 engine memory: `ratingFor`, `confidentMissAt`, `orderSkillItems`; `replayCard` uses `ratingFor`; `nextReviewAt`
   min with miss + 24 h; `planWalk` water rule + `orderSkillItems`; heatmap guard; `planLesson` confusable + shared
   order. Inner unit tests where branches need them.
3. T3 engine misconceptions: zod schema, `parseMisconceptions`, `loadPackMisconceptions`, tally, mix-up, confusables.
4. T4 server: `AnswerInput.confidence`, `gradeAnswer` → `p_confidence`, `fetchAttempts` selects confidence + chosen,
   `getPackMisconceptions`; inner grade-answer test updated for the new arg.
5. T5 check:packs misconception rule + summary line (orchestrator: scripts/**).
6. T6 UI: `ConfidenceTap` + `nextConfidence`; four hooks + footers; `submissionKey` with confidence; lesson pages
   pass `confusable` and `mixUp`; `LessonClose` line.
7. T7 content review: fresh-context review of `packs/subagents/misconceptions.yaml` against each rationale.
8. T8 ADR 0007, CONTEXT.md entries.
9. T9 verify ladder, browser, evidence.

## Riskiest step

The `record_attempt` rewrite (T1): a SECURITY DEFINER function on the answer path. Risks: a replay that ignores the
new field (lets a client change its tap after seeing the verdict — the tap is graded, so that would be gaming), a
NULL comparison that lets a changed tap through (`<>` vs `is distinct from`), and a grant gap after the drop. Each is
an SC-1/SC-2 assertion; both the replay path and the lost-race path compare confidence. Version binding (MF-0007
rule): the attempt still names the content hash the learner read; SC-3 proves the replay is bound to it.
Re-run state (seed/sync): not applicable — no seed or sync changes; `pnpm dev:seed` writes attempts without
confidence (null, legacy grading).

## Rejected options

- A separate `set_attempt_confidence` RPC after grading: lets the learner pick the tap after seeing the verdict.
- A stored due date on attempts for the 24 h rule: D-4 (the engine decides), and two owners of one fact.
- Tags inline on options: changes every tagged item's hash (reviews reset, in-flight "changed"), collides with MF-0061.
- A required tap: breaks five tickets' frozen "Check answer" tests and adds a forced step (C-3).
- Switching Duel / Cuckoo pickers to the next-item rule: MF-0016 SC-5 re-freeze (C-2), proposed as a follow-up.

## SC → steps

SC-1, SC-2, SC-3 → T1 · SC-4, SC-5, SC-6, SC-7 → T2 (+T1 for SC-7 DB) · SC-8 → T3, T5 · SC-9 → T3, T2 ·
SC-10 → T4 · SC-11, SC-12 → T6 · SC-13 → T8 · SC-14 → T9.

```json tasks
[
  { "id": "T0", "title": "acceptance tests (frozen) + SC-7 re-freeze batch", "agent": "acceptance-writer",
    "owns": ["src/engine/memory/__tests__/mf-0065-confidence-grading.acceptance.test.ts",
             "src/engine/memory/__tests__/mf-0065-next-item.acceptance.test.ts",
             "src/engine/misconceptions/__tests__/mf-0065-misconceptions.acceptance.test.ts",
             "src/test/__tests__/mf-0065-check-misconceptions.acceptance.test.ts",
             "src/server/db/__tests__/mf-0065-confidence.db.acceptance.test.ts",
             "src/features/__tests__/mf-0065-confidence-input.acceptance.test.ts",
             "src/server/attempts/__tests__/mf-0065-grade-confidence.acceptance.test.ts",
             "src/features/__tests__/mf-0065-confidence-tap.acceptance.test.tsx",
             "src/server/db/__tests__/mf-0032-attempt-hash.db.acceptance.test.ts",
             "src/server/db/__tests__/mf-0067-retry-safe.db.acceptance.test.ts"],
    "depends_on": [], "closes": [], "done_when": ["pnpm typecheck"], "context": ["skill:testing-strategy"] },
  { "id": "T1", "title": "migration + db types", "agent": "schema-builder",
    "owns": ["supabase/migrations/20261107100000_mf0065_attempt_confidence.sql", "src/server/db/database.types.ts",
             "src/server/db/__tests__/mf-0065-lost-race.db.test.ts"],
    "depends_on": ["T0"], "closes": ["SC-1", "SC-2", "SC-3"],
    "done_when": ["pnpm test:db"], "context": ["skill:supabase-postgres-best-practices"] },
  { "id": "T2", "title": "engine: grading, confident miss, next item, heatmap guard, lesson confusable", "agent": "service-builder",
    "owns": ["src/engine/memory/**", "src/engine/forest/group-heatmap.ts", "src/engine/lesson/plan-lesson.ts"],
    "depends_on": ["T0"], "closes": ["SC-4", "SC-5", "SC-6", "SC-7"], "done_when": ["pnpm test"],
    "context": ["skill:typescript-strict", "skill:tdd"] },
  { "id": "T3", "title": "engine: misconception files, tally, confusables", "agent": "service-builder",
    "owns": ["src/engine/misconceptions/**"],
    "depends_on": ["T0"], "closes": ["SC-8", "SC-9"], "done_when": ["pnpm test"], "context": ["skill:typescript-strict"] },
  { "id": "T4", "title": "server: input schema, grading path, reads", "agent": "service-builder",
    "owns": ["src/lib/answer-input.ts", "src/server/attempts/**", "src/server/memory/**",
             "src/server/content/get-pack-misconceptions.ts"],
    "depends_on": ["T1", "T3"], "closes": ["SC-10"], "done_when": ["pnpm test"], "context": ["skill:nextjs-data"] },
  { "id": "T5", "title": "check:packs misconception rule", "agent": "orchestrator",
    "owns": ["scripts/check-pack-grounding.mjs"],
    "depends_on": ["T3"], "closes": ["SC-8"], "done_when": ["pnpm check:packs"], "context": [] },
  { "id": "T6", "title": "UI: confidence tap in four modes, lesson confusable + mix-up", "agent": "ui-builder",
    "owns": ["src/components/confidence-tap/**", "src/lib/confidence.ts", "src/lib/__tests__/confidence.test.ts",
             "src/lib/attempt-id.ts", "src/lib/__tests__/attempt-id.test.ts",
             "src/features/duel/components/**", "src/features/walk/components/**",
             "src/features/seed-planting/components/**", "src/features/lesson/**",
             "src/app/(app)/play/[packSlug]/lesson/**"],
    "depends_on": ["T4"], "closes": ["SC-11", "SC-12"], "done_when": ["pnpm test", "pnpm build"],
    "context": ["skill:react-client-patterns", "skill:client-data-tanstack-query", "skill:ui-shadcn"] },
  { "id": "T7", "title": "subagents misconception tags (drafted, fresh-context reviewed)", "agent": "service-builder",
    "owns": ["packs/subagents/misconceptions.yaml"],
    "depends_on": ["T5"], "closes": ["SC-8"], "done_when": ["pnpm check:packs"], "context": [] },
  { "id": "T8", "title": "ADR 0007 + CONTEXT.md", "agent": "orchestrator",
    "owns": ["docs/adr/0007-confidence-grades-recall.md", "CONTEXT.md"],
    "depends_on": ["T2"], "closes": ["SC-13"], "done_when": ["pnpm gate:workspace"], "context": [] },
  { "id": "T9", "title": "verify ladder, browser, evidence", "agent": "orchestrator",
    "owns": [".planning/tasks/MF-0065/LOOP-VERIFY.md", ".planning/evidence/MF-0065.md", ".planning/evidence/MF-0065/**"],
    "depends_on": ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8"], "closes": ["SC-14"],
    "done_when": ["pnpm typecheck && pnpm lint && pnpm test", "pnpm test:db", "pnpm build", "pnpm check:packs",
                  "pnpm gate:planning", "pnpm gate:workspace"],
    "context": [] }
]
```
