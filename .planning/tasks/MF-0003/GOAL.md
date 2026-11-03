---
ticket_id: MF-0003
tier: high-risk                   # schema + RLS + a SECURITY DEFINER grading function; figures learners rely on
stage: handoff
branch: feat/MF-0001
builds_on: [MF-0001, MF-0002]     # both complete-pending-manual-commit
last_iteration: 1
goal_status: complete-pending-manual-commit
---

## Objective

Today every tree is a seed forever: there are no questions, no answers and no memory (MF-0001/0002).

End state, locally: a signed-in learner opens **Scenario Duel** for their group's pack and answers
5 exam-style questions picked for them, mostly from heavy-weight skills they haven't learned or are
forgetting. After each answer they see why **every** option is right or wrong, with a source link
and an "unreviewed" badge on non-official content. Answers are **graded by the database**, never
by the browser. The learner's forest on the group page now reflects **measured memory**: trees
sprout after a correct recall, grow as FSRS stability rises, and wilt when retrievability falls
below 0.85 (spec §2.2). It's computed by replaying the learner's graded attempts through FSRS, so
nothing a client sends can grow a tree.

## Affected

- **Roles:** signed-in learner (plays, sees own forest). Group members still see only their own forest (❓Q-4, heatmap later).
- **Surfaces:** `packs/<slug>/questions/*.yaml` (new content format); `src/engine/questions/*` (schema, loader, playable DTO, selector); `src/engine/memory/*` (FSRS replay); table `public.attempts`, `private.question_keys`, function `record_attempt`; `scripts/sync-question-keys.mjs`; routes `/play/[packSlug]/duel`; group page forest uses the learner's memory.

## Constraints

- Game state = memory state (spec §1.2-1) → the correctness of an attempt is computed in the DB from `private.question_keys`; `attempts` has no INSERT/UPDATE grant; the forest is derived only from graded attempts → SC-4, SC-5.
- The answer key must not reach the browser before the learner answers → the client gets a `PlayableQuestion` DTO without `correct`/`rationale` → SC-6.
- Exam facts are not invented: official questions are copied verbatim from Exam Guide v1.0 §8; every drafted question cites an official doc/guide URL and carries `status: unreviewed` until the review workflow exists → SC-2.
- Engine stays pure and pack-agnostic (MF-0001 SC-4 stays green); `ts-fsrs` pinned to 5.4.2 (6.0.0 is 6 days old; pnpm release-age policy).
- RLS + explicit grants + `revoke all` first on every new table; SECURITY DEFINER only in `private`, with an `auth.uid()` check (memory `project-supabase-migration-rules`).
- Local stack only (memory `feedback-local-first`).

## Decided without a question

- Scope = first playable loop; seed content = the 3 official samples + ~2 drafted questions per skill, badged "unreviewed": user, 2026-11-03.
- **Questions live in pack files** (`packs/<slug>/questions/<skill-code>.yaml`), consistent with packs-as-files (MF-0001). They're reviewable in PRs and the review workflow comes later. Only the answer key is copied to the DB, by `scripts/sync-question-keys.mjs` (local stack, idempotent).
- **No stored memory table.** Memory per (user, pack, skill) = FSRS replay of that user's graded attempts, at read time. Volumes are small (hundreds of attempts), and nothing can drift or be forged.
- Rating mapping: all chosen options exactly equal to the key set → `Good`; otherwise → `Again`. No self-rated confidence in v1.
- Memory is per learner per pack, shared across that learner's groups for the same pack. The duel route is per pack (`/play/[packSlug]/duel`).
- `feynmanPassed` / `stormSurvived` stay false until those modes exist, so trees cap at sapling for now (spec §2.2, MF-0001 thresholds).
- Session = 5 questions. Selection: skill score = weight × (1 − R), with R = 0 for unseen skills; at most one question per skill per session; within a skill, the question this learner saw least recently.

### Question file format (contract for content)

```yaml
# packs/ccdv-f/questions/D2.S3.yaml
skill: D2.S3
questions:
  - id: ccdv-f.D2.S3.official-1        # unique pack-wide, stable forever
    status: official                   # official | unreviewed
    stem: "A developer must process …"
    select: 1                          # how many options are correct (= count of correct: true)
    options:
      - { id: A, text: "…", correct: false, rationale: "Why A is wrong" }
      - { id: B, text: "…", correct: true,  rationale: "Why B is right" }
    source: { title: "Exam Guide v1.0 §8 Sample 1", url: "https://…" }
```

## Success Criteria

- [x] SC-1: The question loader validates a pack's question files: `select` equals the number of `correct: true` options; option ids are unique within a question; question ids are unique pack-wide; `skill` exists in the pack; every option has a non-empty rationale; `source.url` is present. Each violation is rejected with an error naming the path. Proof: acceptance `src/engine/questions/__tests__/mf-0003-questions.acceptance.test.ts`.
- [x] SC-2: CCDV-F content loads: the 3 official sample questions (Exam Guide §8) are present with `status: official` and the guide's correct options (Sample 1 → B, Sample 2 → B, Sample 3 → B); every one of the 25 skills has ≥ 2 questions; every non-official question has `status: unreviewed`. Proof: same file.
- [x] SC-3: FSRS replay (`replayMemory`) from graded attempts: no attempts → `null`; wrong-only attempts → `successfulRecalls` 0 (seed); one correct at t0 → sprout and not wilting at t0, and wilting at t0 + 60 days; correct at days 0, 3, 10, 25 → sapling (stability ≥ 3) at day 25. Proof: acceptance `src/engine/memory/__tests__/mf-0003-replay.acceptance.test.ts`.
- [x] SC-4: DB grading. As user A, `record_attempt(question_id, chosen)` returns `true` for the exact key set and `false` otherwise (including a superset). The stored `attempts` row has the DB-computed `correct`. A direct `insert` into `attempts`, or an `update` of `correct`, is refused. A can read only A's attempts (B sees 0 of A's). An unknown `question_id` raises. Anon can do nothing. Proof: DB acceptance `src/server/db/__tests__/mf-0003-attempts.db.acceptance.test.ts`.
- [x] SC-5: After `node scripts/sync-question-keys.mjs`, every question in every pack has a row in `private.question_keys` with the same key set, re-running is idempotent, and neither `authenticated` nor `anon` can `select` from `private.question_keys`. Proof: same DB file.
- [x] SC-6: `toPlayableQuestion()` returns stem, options (id + text), `select`, status and source, and **no** `correct` or `rationale` field (checked on all CCDV-F questions). Proof: acceptance in the questions file.
- [x] SC-7: `pickSessionQuestions` returns 5 distinct questions from 5 distinct skills; with no history, the first pick is from the highest-weight skill (D2.S5, 8.6); a skill whose R ≥ 0.85 ranks below any unseen skill of equal or higher weight. Proof: acceptance in the replay/selection file.
- [x] SC-8: Browser (local stack): signed-in A opens the duel from the group page and answers 5 questions. After each: the correct option(s) are marked, every option shows its rationale, the source link, and the "unreviewed" badge where applicable. Back on the group page, the skills answered correctly show 🌱 and the ones answered wrong stay 🌰. Before answering, the page HTML contains no rationale text. Proof: browser observations + HTML grep.
- [x] SC-9: MF-0001/0002 suites stay green; typecheck, lint, unit, db, build, check-hooks; advisors clean; fresh-context reviewer approves; evidence. Proof: receipt + REVIEW.md.

## Concerns

| # | Collision | Owner | Status |
|---|-----------|-------|--------|
| C-1 | ~50 drafted questions about a fast-moving product can be wrong. Mitigation: each cites an official URL actually read, is badged "unreviewed", and a colleague review workflow is a later ticket. Accept for v1? | user | resolved 2026-11-03: accept with "unreviewed" badges |
| C-2 | Answer keys exist in two places (pack files and `private.question_keys`). A forgotten sync means stale grading. Mitigation: SC-5 + the duel action refuses a question whose key is missing; sync is a documented step after editing questions. | agent | accepted |

## Out of Scope

- AI question generation, nature cards, diagrams, Feynman, storms (later tickets; AI needs ❓Q-2).
- Content review workflow (approve/flag), group heatmap, readiness score.
- MF-0002 hardening notes and the `site_url` port fix (separate small ticket).

## Open questions

- none.

## Iteration Log

<!-- append-only -->

### Iteration 1

```yaml
phase: 1-complete
verdict: PASS
started_at: "2026-11-03"
completed_at: "2026-11-03"
```

**Result:** PASS: SC-1..SC-9. Review round 1 requested changes (1 blocking: attempts read capped at 1000 rows). Fixed with paging, plus 4 cheap notes; each testable fix was shown RED first. Round 2 approved tree 0293104946228b32. Duel lives under `(app)` and follows the UI session's shadcn design rules (coordinated by message).
**Suggested commit message:** `MF-0003 feat: Scenario Duel with DB-graded attempts, FSRS-replayed forest, CCDV-F question bank (3 official + 50 unreviewed)`
