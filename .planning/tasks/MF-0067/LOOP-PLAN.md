---
phase: 1-planning
ticket_id: MF-0067
status: complete
verdict: PASS
started_at: "2026-11-06"
resume_with: /gsd-goal-loop
---

# Loop Plan — Iteration 1

## Discovery summary

- `record_attempt` = MF-0032 migration `supabase/migrations/20261104150000_mf0032_attempt_content_hash.sql` (F1, F2).
  Precedent for a signature change: drop the old signature, add the new parameter `default null`, regrant.
- App callers: `src/server/attempts/grade-answer.ts`, `src/server/attempts/grade-cuckoo.ts` (F3); input schemas
  `src/lib/answer-input.ts`, `src/features/cuckoo/schemas.ts`; hooks in duel / walk / seed-planting / cuckoo (F5).
- Shared client guard precedent: `src/lib/use-single-flight.ts` (MF-0026), a ref-based hook in `src/lib` used by
  all four modes. The id helper follows it (second feature consumer → `src/lib`, react-client-patterns rule 9).
- Gates on touched paths: `gate:planning`, `gate:workspace`; frozen files listed below.

## Symbols changed

- `record_attempt` (SQL, private + public): signature (text, text[], text) → (text, text[], text, uuid).
- `AnswerInput` (src/lib/answer-input.ts) and its walk alias `AnswerWalkInput`: gains required `clientAttemptId`.
- `CuckooAnswerInput`: gains required `clientAttemptId`.
- `GradeAnswerInput`, `GradeCuckooInput`: gain required `clientAttemptId`.
- `gradeAnswer`, `gradeCuckoo`: send `p_client_attempt_id`.

## Frozen files this will re-freeze

| File:line | Change (new expected value) | Reason |
|---|---|---|
| `src/server/db/__tests__/mf-0032-attempt-hash.db.acceptance.test.ts:191-212` | SC-7 title "only the 4-arg signature"; sigs `private.record_attempt(text,text[],text,uuid)` / `record_attempt(text,text[],text,uuid)` | the signature gains `p_client_attempt_id` (F6) |
| `src/features/__tests__/mf-0032-answer-hash.acceptance.test.tsx:49-54` | `EXPECTED` gains `clientAttemptId: expect.any(String)`; the content-hash assertions are unchanged | every hook now sends the id (F7) |
| `src/features/__tests__/mf-0032-changed-message.acceptance.test.ts:17-22` | `INPUT` gains `clientAttemptId: "<fixed v4 uuid>"`; expected messages and the `{ userId, ...INPUT }` forward unchanged | the schema requires the id (F7) |
| `src/features/__tests__/mf-0058-recorder-failure.db.acceptance.test.ts:110-115` | the `answerQuestion` input gains `clientAttemptId: randomUUID()`; assertions unchanged | the schema requires the id (F7) |
| `src/engine/content/__tests__/mf-0032-answer-hash.acceptance.test.ts:84` | `base` gains `clientAttemptId: "<fixed v4 uuid>"`, so the parse at :87-89 succeeds and the hash refusals at :93-99 still fail for the hash alone | `AnswerInput` requires the id |

Read, assertions hold (no change):

| File:line | Why it holds |
|---|---|
| `src/server/db/__tests__/mf-0003-attempts.db.acceptance.test.ts:87-169` | calls the RPC without the id; `default null` keeps one row per call |
| `src/server/db/__tests__/mf-0016-cuckoo-keys.db.acceptance.test.ts:139-144` | same |
| `src/server/db/__tests__/mf-0025-orphan-keys.db.acceptance.test.ts:109-145` | same |
| `src/server/paths/__tests__/mf-0058-course-completion.db.acceptance.test.ts:110-118` | same |
| `src/dev-seed/__tests__/mf-0029-seed.db.acceptance.test.ts:99-103` | same (grading parity, 2-arg call) |
| `src/dev-seed/__tests__/mf-0029-plan.acceptance.test.ts:87` | test title only |
| `src/server/paths/__tests__/mf-0058-recorder-wiring.acceptance.test.ts:6-58` | asserts that the callers exist by name; the names are unchanged |
| `src/features/cuckoo/components/cuckoo-session/__tests__/mf-0016-cuckoo-session.acceptance.test.tsx:75` | `objectContaining` |

## SC coverage

| SC | Steps | Proof |
|----|-------|-------|
| SC-1..SC-7 | 1, 2 | `mf-0067-retry-safe.db.acceptance.test.ts`; SC-5 variant run in LOOP-VERIFY |
| SC-8 | 3, 4 | `mf-0067-attempt-id-input.acceptance.test.ts`; `grade-{answer,cuckoo}.test.ts` |
| SC-9 | 5, 6 | `mf-0067-attempt-id.acceptance.test.tsx`; `src/lib/__tests__/attempt-id.test.ts` |
| SC-10 | 7 | gates, `pnpm build`, browser smoke + SQL read-back |

## Steps

1. `supabase/migrations/20261106160700_mf0067_attempt_idempotency.sql`: add column `client_attempt_id uuid`, add
   constraint `unique (user_id, client_attempt_id)`, drop both 3-arg functions, create the 4-arg ones (replay
   first → existing checks → `insert … on conflict do nothing` → on a lost race read the winner), revoke, then grant.
2. `pnpm db:reset` + `pnpm db:types` (db lock).
3. `src/lib/answer-input.ts`, `src/features/cuckoo/schemas.ts`: `clientAttemptId: z.uuid()`.
4. `grade-answer.ts` / `grade-cuckoo.ts`: required field, forwarded as `p_client_attempt_id`; inner tests updated.
5. `src/lib/attempt-id.ts` (pure `attemptIdFor({ held, submission, mint })`, `submissionKey`) + tests;
   `src/lib/use-attempt-id.ts` (ref; `idFor(submission)`, `clear()`).
6. The four hooks: `clientAttemptId: attempt.idFor(...)` in `submit`, `attempt.clear()` in `next`.
7. Re-freeze the five listed files (history entry), then the full ladder.

## Riskiest step

The race path in step 1. A check-then-insert without the unique key passes every sequential test and still writes
two rows under concurrency. Proof: SC-5 carries the ordering witness `isReleasedAtResponse` and is run once against
a check-then-insert variant (unique key dropped) that must go RED. Server refusal behind the UI guard: the hook's
id binding is only a client convenience; the DB refuses a reused id with another answer (SC-3) and is per user (SC-4).
Versioned content: a retry is matched against the stored registry hash (DQ-4) and replays before the hash check (DQ-3).
Re-run safety: no state outside the row survives; `db:reset` drops all rows and ids are client uuids.

## Rejected options

- DB-required `p_client_attempt_id` (no default): no integrity gain (DQ-2) and re-freezes 4 more frozen DB files.
- Id per question regardless of the answer: a changed answer after a network error would be refused with no way out.
- `ON CONFLICT DO UPDATE` to return the row: rewrites the winner's row and hides a mismatched answer.
- A sessions / idempotency table: out of scope (D-5).

## Verify

- `pnpm typecheck && pnpm lint && pnpm test`, `pnpm test:db`, `pnpm build`, `pnpm gate:planning`, `pnpm gate:workspace`
- browser: Duel answer as the demo learner, SQL read-back of `client_attempt_id`

## Tasks

```json tasks
[
  { "id": "T0", "title": "acceptance tests + the approved re-freeze batch", "agent": "acceptance-writer",
    "owns": ["src/server/db/__tests__/mf-0067-retry-safe.db.acceptance.test.ts",
             "src/features/__tests__/mf-0067-attempt-id-input.acceptance.test.ts",
             "src/features/__tests__/mf-0067-attempt-id.acceptance.test.tsx",
             "src/server/db/__tests__/mf-0032-attempt-hash.db.acceptance.test.ts",
             "src/features/__tests__/mf-0032-answer-hash.acceptance.test.tsx",
             "src/features/__tests__/mf-0032-changed-message.acceptance.test.ts",
             "src/engine/content/__tests__/mf-0032-answer-hash.acceptance.test.ts",
             "src/features/__tests__/mf-0058-recorder-failure.db.acceptance.test.ts"],
    "depends_on": [], "closes": [], "done_when": ["pnpm typecheck"], "context": ["skill:testing-strategy"] },
  { "id": "T1", "title": "migration + db types", "agent": "schema-builder",
    "owns": ["supabase/migrations/20261106160700_mf0067_attempt_idempotency.sql", "src/server/db/database.types.ts",
             "src/server/db/__tests__/mf-0067-review.db.test.ts"],
    "depends_on": ["T0"], "closes": ["SC-1", "SC-2", "SC-3", "SC-4", "SC-5", "SC-6", "SC-7"],
    "done_when": ["pnpm test:db"], "context": ["skill:supabase-postgres-best-practices"] },
  { "id": "T2", "title": "answer schema + grading paths", "agent": "service-builder",
    "owns": ["src/lib/answer-input.ts", "src/server/attempts/**"],
    "depends_on": ["T1"], "closes": ["SC-8"], "done_when": ["pnpm test"], "context": ["skill:typescript-strict"] },
  { "id": "T3", "title": "cuckoo schema + id helper + hooks", "agent": "ui-builder",
    "owns": ["src/features/cuckoo/schemas.ts", "src/lib/attempt-id.ts", "src/lib/use-attempt-id.ts",
             "src/lib/__tests__/attempt-id.test.ts", "src/features/*/components/*/hooks/*.ts",
             "src/features/walk/components/walk-session/__tests__/walk-session.test.tsx",
             "src/features/seed-planting/components/seed-checks/__tests__/seed-checks.test.tsx",
             "src/features/__tests__/mf-0067-attempt-id-next.test.tsx"],
    "depends_on": ["T2"], "closes": ["SC-9"], "done_when": ["pnpm test", "pnpm build"],
    "context": ["skill:client-data-tanstack-query", "skill:react-client-patterns"] },
  { "id": "T4", "title": "verify ladder, browser smoke, evidence", "agent": "orchestrator",
    "owns": [".planning/tasks/MF-0067/LOOP-VERIFY.md", ".planning/evidence/MF-0067.md", ".planning/evidence/MF-0067/**"],
    "depends_on": ["T3"], "closes": ["SC-10"],
    "done_when": ["pnpm typecheck && pnpm lint && pnpm test", "pnpm test:db", "pnpm build", "pnpm gate:planning", "pnpm gate:workspace"],
    "context": [] }
]
```
