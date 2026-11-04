---
phase: 1-planning
ticket_id: MF-0013
status: executing
verdict: IN_PROGRESS
started_at: "2026-11-04"
resume_with: /gsd-goal-loop
---

# Loop Plan — Iteration 1

> Written by `ticket-planner` (2026-11-04); saved by the orchestrator because the agent-scope hook
> rejected the agent's Windows path (known: memory `windows-dev-environment`). One line added under
> Verify: the fresh-context review a high-risk ticket requires.

## Discovery summary

**The contract (frozen, never edited by a builder):**
- `src/engine/storm/__tests__/mf-0013-storm.acceptance.test.ts` (SC-1, SC-2, SC-5 engine half):
  `composeFullStorm({ pack, pool, seed })` and `composeBossStorm({ pack, domainCode, pool, seed })` → `StormPlan`.
  `scoreStorm(pack, StormResult)` → `StormReport`. `stormDomainScores(report)` → `StormDomainScore[]`.
- `src/server/db/__tests__/mf-0013-storms.db.acceptance.test.ts` (SC-3, SC-4, SC-5 DB half):
  `public.start_storm(p_pack_slug text, p_kind text, p_domain_code text, p_questions jsonb)` → uuid.
  `public.answer_storm_question(p_storm_id uuid, p_question_id text, p_chosen text[], p_content_hash text)` → void (`data` must be falsy).
  `public.finish_storm(p_storm_id uuid)`. Tables `public.storms (id, kind, domain_code, started_at, ends_at, finished_at, …)`,
  `public.storm_questions (storm_id, question_id, chosen, correct, voided, …)`, `public.attempts.storm_id`.
  A Boss Storm of 3 → `ends_at − started_at` exactly 408 s. `select *` on `storms` must not match `/correct|rationale/i`
  **anywhere in the row JSON**, so no `storms` column name may contain "correct" (e.g. no `correct_count`).
  `storm_questions` may have a `correct` column (null until finish) but no `correct_options` or `rationale`.
- `src/engine/forest/__tests__/mf-0001-stage.acceptance.test.ts` (SC-6, re-frozen).
- `src/server/db/__tests__/mf-0005-grants.db.acceptance.test.ts` (re-frozen, C-5): `authenticated SELECT` on
  `public.storms` and `public.storm_questions` are the ONLY new relation grants in `public` and `private`. There are
  no column grants, and no `public` function is executable by `anon`/`PUBLIC`.

**Already in the tree (freeze diff):** stubs `src/engine/storm/{types,compose-storm,score-storm,index}.ts`;
`MemorySnapshot.stormSurvived` renamed to `stormProven` + `fullStormProven` in `src/engine/forest/tree-stage.ts:3-13`
(logic unchanged: `stageOf` still needs `feynmanPassed` for Tree and Ancient, lines 28-40) and in
`src/engine/memory/replay.ts:34-36` (both hard-coded `false`); CONTEXT.md "Voided question"; fixture renames in
`build-forest.test.ts`, `group-heatmap.test.ts`, `mf-0011-group-heatmap.acceptance.test.ts`.

**Precedents:**
- DB: `supabase/migrations/20261103083446_mf0003_attempts.sql` (definer in `private` + invoker shim in `public`,
  revoke-all-first, the DB grades with set equality, `pack_slug`/`skill_code` taken from the key row);
  `20261103160000_mf0007_reviews.sql` (`private.items.content_hash`, `private.item_state(item_id)`, hash mismatch →
  errcode `55000`, spoiled = any `private.item_reviews` row by the caller for that `item_id`, as `review_states.reviewed_at`).
  `20261103150000_mf0004_create_group_guards.sql` created `private.packs (slug, updated_at)`.
  `private` schema: `usage` granted to `authenticated` (mf0002:14) and `service_role` (mf0011:19).
- Key sync: `scripts/sync-question-keys.mjs` (packs → keys → items, per-pack transactions).
- Grading/serving: `src/server/attempts/grade-answer.ts` (a server helper returning `ActionResult<…, GradeError>`; the
  shape `start-storm.ts` copies), `src/engine/questions/playable.ts` (`toPlayableQuestion` allow-list),
  `src/server/content/get-item-hashes.ts` (deployed-file hashes, i.e. the hash the learner READ),
  `src/server/content/get-review-context.ts`, `src/engine/content/review.ts` (`reviewStateOf`, `isPlayable`).
- Feature/page shape: `src/app/(app)/play/[packSlug]/walk/page.tsx` + `src/features/walk/**` (Suspense slot,
  `useMutation` over an action, focus management), `src/features/groups/utils/rpc-errors.ts` (SQLSTATE → message).
- Memory: `src/engine/memory/{replay,memory-by-skill,countable}.ts`. Forest callers that build the LEARNER'S OWN forest:
  `src/app/(app)/today/page.tsx:39-43` and `src/app/(app)/groups/[groupId]/page.tsx:58-61`.
  `plant/[skill]/page.tsx:44` only asks "is it a seed", and proof cannot change a seed, so it stays unchanged.
  `group-heatmap.ts:114` is other members' memory, and its "healthy" ignores Tree (GOAL start-trust residual), so it
  stays unchanged. Other learners' storms are RLS-private anyway.
- Sidebar (`src/features/app-shell/components/app-sidebar/app-sidebar.tsx:109-136`): the Play group has Scenario Duel and
  Daily Walk. **There is no "Soon" storm badge** (`grep -i soon` in `src/` has no hits outside `ui/`), so the plan
  adds a "Storm" item.
- `src/components/ui/`: no `alert-dialog` (needed for the Finish confirmation), so it is added with the shadcn CLI.

**Gates:** this repo defines no `COMPONENT_SPLIT_MIGRATED_PATHS` / `I18N_MIGRATED_PATHS` (grep: only mentioned in
`.claude/agents/ticket-planner.md`). The only allow-list touched is the MF-0005 grants list, already re-frozen with
user approval (C-5). No allowlist addition is needed beyond it: `private.pack_skills` and the new `private.packs`
columns carry no grants.

**Environment (memory: windows-dev-environment):** Docker must be up for `test:db`. Use `supabase migration up --local`
(C-7, never `db:reset`), then `pnpm db:sync-keys`, then `pnpm db:types`.

## SC coverage

| SC | Tasks | Proof |
|----|-------|-------|
| SC-1 | T2 | `mf-0013-storm.acceptance.test.ts` "SC-1" + `src/engine/storm/__tests__/largest-remainder.test.ts` |
| SC-2 | T2 | same file, four "SC-2" cases + `compose-storm.test.ts` (multi-skill redistribution, tiers) |
| SC-3 | T1 | `mf-0013-storms.db.acceptance.test.ts` (5 SC-3 cases) + `mf-0013-storm-finalize.db.test.ts` |
| SC-4 | T1, T3, T4 | DB case "SC-4"; `src/server/storm/__tests__/to-storm-session-question.test.ts` (no key fields); browser view-source of `/storms/<id>` while running |
| SC-5 | T1, T2 | engine "SC-5" + DB "SC-5" + `score-storm.test.ts`, `storm-proof.test.ts` |
| SC-6 | T2, T5 | `mf-0001-stage.acceptance.test.ts`; `memory-by-skill.test.ts` (proof merge); Today forest shows a Tree after a proving storm (browser) |
| SC-7 | T4 | browser on port 3001: Boss + Full Storm end to end; countdown vs `ends_at` |
| SC-8 | T6 | receipt: advisors, `pnpm test:db`, typecheck, lint, test, build |

## Steps

### T1 — migration, key sync, DB types (schema-builder)

1. Create the file with `supabase migration new mf0013_storms`. Its timestamp must sort after
   `20261104100000`. If the clock gives an earlier one, rename it to `20261104130000_mf0013_storms.sql`. Write a header
   comment in the style of mf0003/mf0007 (why the tables have no write grants; the deadline is DB `now()`; keys only
   after finish).
2. **Pack exam timing + skill map (private):**
   - `alter table private.packs add column exam_questions integer check (exam_questions > 0), add column exam_minutes integer check (exam_minutes > 0);`
     These are nullable because a non-exam pack has no storms; `start_storm` refuses when they are null.
   - `create table private.pack_skills (pack_slug text not null references private.packs (slug) on delete cascade, skill_code text not null check (char_length(skill_code) between 1 and 32), domain_code text not null check (char_length(domain_code) between 1 and 32), primary key (pack_slug, skill_code));`
     RLS on, `revoke all … from public, anon, authenticated`, no policies.
3. **`public.storms`:** `id uuid primary key default gen_random_uuid()`, `user_id uuid not null references auth.users (id) on delete cascade`,
   `pack_slug text not null`, `kind text not null check (kind in ('full','boss'))`, `domain_code text`,
   `started_at timestamptz not null`, `ends_at timestamptz not null`, `finished_at timestamptz`,
   `check ((kind = 'boss') = (domain_code is not null))`, `check (ends_at > started_at)`,
   `check (finished_at is null or finished_at >= started_at)`.
   No column name may contain "correct" or "rationale" (SC-4 regex).
   - `create unique index storms_one_running_idx on public.storms (user_id) where finished_at is null;`
   - `create index storms_user_pack_started_idx on public.storms (user_id, pack_slug, started_at desc);`
4. **`public.storm_questions`:** `storm_id uuid not null references public.storms (id) on delete cascade`,
   `user_id uuid not null references auth.users (id) on delete cascade` (denormalised for a one-predicate RLS policy and
   the seen-questions read), `position smallint not null check (position >= 1)`, `question_id text not null`,
   `skill_code text not null`, `domain_code text not null`, `content_hash text not null`, `unreviewed boolean not null`,
   `chosen text[] check (chosen is null or cardinality(chosen) between 1 and 10)`, `chosen_at timestamptz`,
   `correct boolean`, `voided boolean not null default false`, `primary key (storm_id, question_id)`,
   `unique (storm_id, position)`, `check ((chosen is null) = (chosen_at is null))`.
   - `create index storm_questions_user_question_idx on public.storm_questions (user_id, question_id);`
5. **`public.attempts.storm_id`:** `alter table public.attempts add column storm_id uuid references public.storms (id) on delete set null;`
   `create unique index attempts_storm_question_idx on public.attempts (storm_id, question_id) where storm_id is not null;`
   The index covers the FK for the advisor and is the backstop against a double finish writing twice.
6. **RLS + grants:** both new tables get `enable row level security`, then `revoke all … from public, anon, authenticated`,
   then `grant select … to authenticated`. Policies `"storms: read own"` / `"storm_questions: read own"` are
   `for select to authenticated using (user_id = (select auth.uid()))`. No INSERT/UPDATE/DELETE grants or policies.
7. **Internal helpers** (owner only: `revoke execute … from public, anon, authenticated`; `security definer`, `set search_path = ''`):
   - `private.options_match(p_chosen text[], p_key text[]) returns boolean immutable`: the mf0003 set equality
     (`array(select distinct … order by 1)` on both sides). `record_attempt` is NOT edited.
   - `private.finalize_storm(p_storm_id uuid) returns void`: `select … for update` the storm row; return if
     `finished_at is not null` (idempotent). Then, in order:
     a. set `voided = true, correct = null` on rows whose `private.items.content_hash` ≠ the stored `content_hash`, or
        whose item or key row is gone;
     b. set `correct = private.options_match(chosen, k.correct_options)` from `private.question_keys k` on non-voided
        rows with `chosen is not null`. Unanswered rows keep `correct = null`: they are wrong in the score and make no
        attempt (C-3);
     c. `insert into public.attempts (user_id, pack_slug, skill_code, question_id, chosen, correct, answered_at, storm_id)`:
        one row per non-voided answered question, `pack_slug`/`skill_code` from the key row, `answered_at = chosen_at`
        (C-4);
     d. set `finished_at = least(now(), ends_at)`.
8. **`private.start_storm(p_pack_slug text, p_kind text, p_domain_code text, p_questions jsonb) returns uuid`**
   (EXECUTE for `authenticated`). Each check raises before any write:
   - `auth.uid()` null → `42501`.
   - the pack row must have non-null `exam_questions`/`exam_minutes` → else `22023`.
   - `p_kind in ('full','boss')`. A boss storm needs `p_domain_code` to be a `domain_code` of the pack in
     `private.pack_skills`; a full storm needs `p_domain_code is null` → else `22023`.
   - `jsonb_typeof(p_questions) = 'array'` and its length `n` is between 1 and the cap (`full`: `exam_questions`,
     `boss`: 12) → else `22023`.
   - every element has a string `question_id` and `content_hash`, and `count(distinct question_id) = n` → else `22023`.
   - every question has a `private.items` row with `item_type = 'question'` and the same `pack_slug`, a
     `private.question_keys` row, and a `private.pack_skills` row for its skill (boss: `domain_code = p_domain_code`).
     It must have `private.item_state(item_id) not in ('flagged','rejected')`, and no `private.item_reviews` row by the
     caller for that `item_id` (spoiled, any hash) → else `22023`.
   - every `content_hash` equals `private.items.content_hash` → else `55000` ("item changed since it was read").
   - take `pg_advisory_xact_lock(hashtextextended('storm:' || v_uid::text, 0))`. Finalize each of the caller's storms
     with `finished_at is null and ends_at <= now()` through `private.finalize_storm`. If a running storm remains, raise
     `23505` ("a storm is already running"); the partial unique index is the second guard.
   - `v_now := now()`; `v_seconds := ceil(n * exam_minutes * 60::numeric / exam_questions)::integer`.
     Insert the storm with `started_at = v_now`, `ends_at = v_now + make_interval(secs => v_seconds)`.
     Insert `storm_questions` with `position` = jsonb ordinality, skill and domain from the key + `pack_skills`,
     `content_hash` from the input (already checked equal to the registry), and `unreviewed = (item_state = 'unreviewed')`.
   - return the storm id. (Boss with 3 questions → 408 s; Full with 53 → 7200 s; Boss with 12 → 1631 s.)
9. **`private.answer_storm_question(p_storm_id uuid, p_question_id text, p_chosen text[], p_content_hash text) returns void`**:
   - raise `42501` when unauthenticated or when the storm is not the caller's (one message for "missing" and "not yours");
   - lock the storm row `for update` (this serialises it with `finalize_storm`);
   - `finished_at is not null or now() >= ends_at` → `MF013` ("the storm is over");
   - `p_chosen` must hold 1–10 ids, each 1–8 chars (mf0003 bounds) → else `22023`;
   - no `storm_questions` row → `P0002`;
   - `p_content_hash` must equal **both** the stored `content_hash` **and** the current `private.items.content_hash`
     (GOAL Constraints) → else `55000`;
   - `update … set chosen = p_chosen, chosen_at = now()`. It returns nothing about correctness.
10. **`private.finish_storm(p_storm_id uuid) returns void`**: `42501` unless the caller owns the storm; then call
    `private.finalize_storm`. It is allowed before and after `ends_at`, and a second call is a no-op.
11. **`private.finalize_expired_storms() returns void`** (lazy finalisation, decided 2026-11-04): finalizes the caller's
    storms with `finished_at is null and ends_at <= now()`. It never touches a storm still inside its deadline.
12. **Public shims** (`language sql`, `security invoker`, `set search_path = ''`) for `start_storm`,
    `answer_storm_question`, `finish_storm` and `finalize_expired_storms`, with the exact signatures above.
    On the private targets: `revoke execute … from public, anon, authenticated`, then `grant … to authenticated`.
    On the shims: `revoke … from public, anon`, then `grant … to authenticated`.
13. `scripts/sync-question-keys.mjs`: in the pack-registry transaction, read `packs/<slug>/pack.yaml`
    (`YAML.parse`) and upsert `private.packs (slug, exam_questions, exam_minutes)` from `exam.questions`/`exam.minutes`
    (null when there is no `exam`). Per pack, in its own transaction, upsert `private.pack_skills` from
    `domains[].skills[]` and delete this pack's rows whose skill is gone. Update the header comment (MF-0013).
14. Apply: `supabase migration up --local` (this also applies main's `20261104100000_mf0011_group_heatmap.sql`), then
    `pnpm db:sync-keys`, then `pnpm db:types` (regenerates `src/server/db/database.types.ts`).
15. New `src/server/db/__tests__/mf-0013-storm-finalize.db.test.ts` (not frozen):
    - (a) a storm moved past `ends_at` by the superuser is finalised by `finalize_expired_storms`, with attempts written
      and `finished_at = ends_at`;
    - (b) a storm still running is untouched by it;
    - (c) calling `finish_storm` twice writes the attempts once;
    - (d) `start_storm` after expiry finalises the old storm and starts the new one;
    - (e) a signed-in learner cannot `select` from `private.pack_skills`;
    - (f) an answer naming the stored hash after the registry hash changed is refused (`55000`).

### T2 — engine (service-builder)

16. `src/engine/storm/largest-remainder.ts`: `allocateSeats(seats: number, entries: readonly { key: string; weight: number; capacity: number }[]): Map<string, number>`.
    Hamilton method by weight. A remainder tie goes to the earlier entry. An entry never exceeds its `capacity`; seats
    it cannot take are re-allocated by the same method to entries with spare capacity, until all are placed or no
    capacity is left. Internal to the module (not re-exported from `index.ts`) and tested directly.
17. `src/engine/storm/seeded-random.ts`: `seededRandom(seed: number): () => number` (mulberry32) and
    `shuffle<T>(items: readonly T[], random: () => number): T[]` (Fisher–Yates on a copy).
18. `src/engine/storm/compose-storm.ts`: replace the stubs.
    - `BOSS_STORM_SIZE = 12`. `stormDurationSeconds(exam: PackExamMeta, questionCount: number): number` =
      `Math.ceil(questionCount * exam.minutes * 60 / exam.questions)`. Throw when `pack.exam` is absent.
    - Candidates: drop any whose `isPlayable(state, "storm")` is false (flagged, rejected) or that is `spoiled`. Sort each
      skill's candidates by id, then bucket them into tiers: 1 approved-unseen, 2 unreviewed-unseen, 3 approved-seen,
      4 unreviewed-seen. Shuffle each bucket with the seeded RNG.
    - Full: domain seats = `allocateSeats(exam.questions, domains by weight, capacity ∞)` (D1 8 … D8 6). Per domain,
      the ideal skill quotas = `allocateSeats(domainSeats, skills by weight)`. Then fill tier by tier:
      - tier 1 = `allocateSeats(domainSeats, skills, capacity = tier-1 size)`, so a short skill passes its seats to the
        domain's other skills;
      - for tier k > 1, the remaining seats go first to each skill's deficit against its ideal quota (weight = deficit,
        capacity = tier-k size), then any seats left go by skill weight to skills with spare tier-k capacity.
      A domain still short after tier 4 makes the storm shorter.
    - Boss: the same domain fill with `domainSeats = BOSS_STORM_SIZE` for `domainCode`. "All playable if fewer" falls
      out of the capacities. Throw on an unknown `domainCode`.
    - `unreviewed = candidate.state === "unreviewed"`. `domainCode` comes from the pack and is never parsed from the
      skill code. The final `questions` are a shuffle of all picks with the same RNG, and
      `durationSeconds = stormDurationSeconds(exam, n)`.
19. `src/engine/storm/score-storm.ts`: replace the stubs.
    - Internal `tallyBySkill(questions)` counts non-voided questions only; an unanswered one counts as scored and wrong.
    - `scoreStorm` lists `domains` and `skills` in pack order, only entries with `scored ≥ 1`.
      `percent = Math.floor(100 * correct / scored)`: flooring keeps "percent ≥ 72 ⇔ at least 72 %" exact.
      `survived = percent >= SURVIVE_PERCENT`. `proven = scored >= 2 && correct === scored`. `voided` = ids in input order.
    - `stormDomainScores` maps `domains` to `{ domainCode, percent, finishedAt: finishedAt.toISOString() }`.
20. `src/engine/storm/storm-proof.ts`: `stormProof(results: readonly StormResult[], rejected: ReadonlySet<string>): ReadonlyMap<string, SkillStormProof>`,
    with `SkillStormProof = { stormProven: boolean; fullStormProven: boolean }` (type in `types.ts`).
    - Per storm, drop voided and rejected question ids (CONTEXT.md Attempt: a later rejection drops out of the proof),
      then reuse `tallyBySkill`. A skill is proven in that storm when `scored ≥ 2 && correct === scored`.
    - `stormProven` = proven in any storm; `fullStormProven` = proven in any `kind === "full"` storm. Skills never
      proven are absent.
21. `src/engine/storm/storm-shortfall.ts`: `stormShortfall(pack: Pack, storm: { kind: StormKind; domainCode: string | null; questions: readonly { skillCode: string }[] }): readonly { domainCode: string; planned: number; actual: number }[]`.
    It compares the planned per-domain seats (step 18) with what the storm holds and returns only short domains. The
    report's "this storm was shorter because…" line reads it.
22. `src/engine/storm/index.ts`: add the exports `BOSS_STORM_SIZE`, `stormDurationSeconds`, `stormProof`,
    `stormShortfall` and `type SkillStormProof`.
23. `src/engine/forest/tree-stage.ts` `stageOf`: Ancient = `stabilityDays >= ancientStabilityDays && fullStormProven`;
    Tree = `stabilityDays >= treeStabilityDays && (feynmanPassed || stormProven)`. Update the field comments.
24. `src/engine/memory/memory-by-skill.ts`: add a third parameter `proof: ReadonlyMap<string, SkillStormProof> = new Map()`.
    Each snapshot takes `stormProven`/`fullStormProven` from it (default `false`). `replay.ts` keeps `false`, because it
    sees one skill's attempts, not storms.
25. Inner tests:
    - `src/engine/storm/__tests__/largest-remainder.test.ts`: D1–D8 = 8/17/2/1/9/6/4/6 from the pack weights; a tie
      goes to the earlier entry; capacity overflow is re-allocated.
    - `seeded-random.test.ts`: the same seed gives the same sequence; shuffle is a permutation and pure.
    - `compose-storm.test.ts`: in a multi-skill domain where one skill has 0 approved, its seats go to the other skills'
      approved questions before any unreviewed one; `stormDurationSeconds` 53→7200, 12→1631, 4→544; it throws without
      `exam`.
    - `score-storm.test.ts`: 71.9 % → 71, not survived; an all-voided domain is absent.
    - `storm-proof.test.ts`: Boss-only proof → `{ stormProven: true, fullStormProven: false }`; one wrong answer →
      absent; a rejected wrong answer is dropped → proven; voided questions are ignored.
    - `storm-shortfall.test.ts`.
    - `src/engine/memory/__tests__/memory-by-skill.test.ts`: the proof is merged; the default empty map keeps `false`.
    - The stage rules are covered by the frozen stage test.
26. `docs/MINDFORGE.md` §2.2 rows: "Stability ≥ 14 days + Feynman passed **or storm-proven**" → Tree;
    "Stability ≥ 45 days + **Full-Storm-proven**" → Ancient (CONTEXT.md wins). CONTEXT.md is already correct (freeze diff).

### T3 — server reads and the start helper (service-builder)

Everything lives under `src/server/storm/`, with `import "server-only"` except the pure mappers. Reads select explicit
columns, return camelCase DTOs typed in `types.ts`, throw on a Supabase error with a `<fn>: ` prefix and return
`null`/`[]` when missing. Nothing is cached.

27. `types.ts`:
    - `StormSummary { id; packSlug; kind: StormKind; domainCode: string | null; startedAt: string; endsAt: string; finishedAt: string | null }`;
    - `StormQuestionRow { questionId; skillCode; domainCode; position; contentHash; unreviewed; chosen: readonly string[] | null; correct: boolean | null; voided }`;
    - the zod row schemas.
28. `finalize-expired-storms.ts`: `finalizeExpiredStorms(): Promise<void>` calls RPC `finalize_expired_storms`.
    It is the one write in the read path (decided 2026-11-04); a comment says why.
29. `get-running-storm.ts`: `getRunningStorm(userId): Promise<StormSummary | null>` (`finished_at is null`).
30. `get-storm.ts`: `getStorm(stormId): Promise<StormSummary | null>`. A `z.uuid()` guard runs first and returns `null`
    when the id is invalid.
31. `list-storm-questions.ts`: `listStormQuestions(stormId): Promise<StormQuestionRow[]>`, ordered by `position`.
    It returns no key: the report page reads the key from the pack files only after `finishedAt !== null`.
32. `list-my-storm-results.ts` + pure `fetch-storm-results.ts` (client as a parameter, like `fetch-attempts.ts`) +
    pure `to-storm-result.ts`: `listMyStormResults(userId, packSlug): Promise<StormResult[]>` reads finished storms with
    embedded `storm_questions(question_id, skill_code, chosen, correct, voided)`, paged by 500 storms.
33. `list-my-seen-storm-question-ids.ts`: `listMySeenStormQuestionIds(userId): Promise<Set<string>>`, paged by 500
    (`storm_questions.question_id` where `user_id`; ids are globally unique in `private.items`).
34. `start-storm.ts`: `startStormFor({ userId, packSlug, kind, domainCode }): Promise<ActionResult<{ stormId: string }, StartStormError>>`
    (a copy of `gradeAnswer`'s shape), with `STORM_START_ERRORS = ["no-questions", "already-running", "content-changed", "not-ready"] as const`.
    - Reads in parallel: `getPack`, `getPackQuestions`, `getReviewContext`, `getItemHashes`, `listMySeenStormQuestionIds`.
    - Builds candidates with pure `build-storm-candidates.ts` (`reviewStateOf`, `review.spoiledBy`, the seen set);
      questions without a deployed hash are dropped.
    - `seed = randomInt(0, 2 ** 31)` from `node:crypto` (randomness at the edge).
    - Calls `composeFullStorm`/`composeBossStorm`; an empty plan → `no-questions`.
    - Calls RPC `start_storm` with `[{ question_id, content_hash }]` in plan order, and maps `23505` →
      `already-running`, `55000` → `content-changed`, `22023` → `not-ready`.
35. `to-storm-session-question.ts` (pure): `(question: Question, row: StormQuestionRow) → StormSessionQuestion`
    `{ question: toPlayableQuestion(question), contentHash: row.contentHash, chosen: row.chosen, unreviewed: row.unreviewed }`.
    The type `StormSessionQuestion` lives in `src/server/storm/types.ts`, and the feature types re-export it.
36. Tests:
    - `__tests__/to-storm-result.test.ts`;
    - `__tests__/build-storm-candidates.test.ts` (spoiled, seen and state mapping; a missing hash is dropped);
    - `__tests__/to-storm-session-question.test.ts`: the serialised output contains no `correct`, `rationale`, `author`
      or `generatedBy` key (SC-4 server half).

### T4 — storm feature, routes, sidebar (ui-builder)

37. `src/features/storm/schemas.ts`:
    - `StartStormInput`: `packSlug` (slug regex), `kind` (`z.enum(STORM_KINDS)`), `domainCode` (`string | null`),
      refined so that boss ⇔ a domain;
    - `AnswerStormInput`: `stormId` uuid, `questionId` 1–128, `chosen` 1–10 of `/^[A-Z]$/`, `contentHash` 1–128;
    - `FinishStormInput`: `stormId` uuid.
38. `src/features/storm/types.ts`: `StartStormResult = ActionResult<{ stormId: string }>`,
    `AnswerStormResult = ActionResult`, `FinishStormResult = ActionResult`; re-export `StormSessionQuestion`.
39. `src/features/storm/utils/rpc-errors.ts` (+ `__tests__/rpc-errors.test.ts`):
    - `stormRpcMessage(code)`: `MF013` "Time is up: this storm has ended.", `55000` "This question changed during the
      storm; it will not count.", `42501`, and a fallback;
    - `START_MESSAGE` `as const satisfies Record<StartStormError, string>`.
40. `src/features/storm/actions.ts` (`"use server"`): `startStorm(input: unknown)`, `answerStormQuestion(input: unknown)`,
    `finishStorm(input: unknown)`. Each one runs `getCurrentUser()` (redirecting to sign-in only as the auth guard) →
    `safeParse` → `startStormFor` or the RPC through `createServerSupabase()` → `ActionResult`. No `redirect()` on
    success, and no grade, key or rationale in any return.
41. `components/storm-start/` (`"use client"`):
    - props: `packSlug`, `kind`, `domainCode`, `questionCount`, `durationSeconds`;
    - hook `use-storm-start.ts`: `useMutation(startStorm)`, with `onSuccess` → `router.push(`/storms/${stormId}`)`;
    - view: a `Card` with the question count, the minutes and the rules (no feedback until the end; the clock keeps
      running when the tab closes), a Start `Button` and an error `Alert`;
    - `utils.ts` `formatMinutes(seconds)` + its test;
    - component test: a successful start navigates; a server error is shown; the button is disabled while pending.
42. `components/storm-session/` (`"use client"`), props `{ stormId; endsAt: string; questions: StormSessionQuestion[]; skillNames }`:
    - `utils.ts` (+ `__tests__/utils.test.ts`): `remainingSeconds(endsAtIso, nowMs)` (never negative),
      `formatCountdown(seconds)` (`h:mm:ss` / `mm:ss`), `questionStatus(chosen)` ("Answered"/"Not answered").
    - `hooks/use-storm-session.ts`:
      - `index` and a local `chosen` per question (`useState`, seeded from props);
      - a 1-second interval that re-derives `remainingSeconds(endsAt, Date.now())` (never from a client start time);
      - save = `useMutation(answerStormQuestion)`, sending the question's `contentHash`;
      - prev/next/jump navigation (skip and return);
      - `finish` = `useMutation(finishStorm)` then `router.refresh()`. At 0 s it calls `finish` once and locks the options.
    - view `storm-session.tsx` + children:
      - `components/storm-countdown.tsx`: `role="timer"`, `aria-live="off"`, a polite announcement at 5 min and 1 min;
      - `components/storm-navigator.tsx`: one `Button` per question with its status in words via `Badge`, not colour alone;
      - it reuses `QuestionCard` with `feedback={null}`;
      - Finish sits behind a shadcn `AlertDialog` ("N questions not answered count as wrong").
    - `__tests__/use-storm-session.test.tsx` (`renderHookWithProviders`, mocked actions and `next/navigation`, fake
      timers): saving sends the content hash; changing an answer re-saves; reaching 0 calls finish once; an `MF013`
      error locks the session.
43. `components/storm-report/` (presentational, no `"use client"`). Props: the engine `StormReport`, `shortfall`,
    `unreviewedIds` and the pack names. It shows a per-domain list (`Separator` rows, `percent` with `tabular-nums`,
    `Badge` "Survived" / "Not yet"), a per-skill list ("Proven" badge), the voided list and the short-storm note.
    No arithmetic.
44. `components/storm-review/` (`"use client"` leaf): every question in a locked `QuestionCard`, with `chosen` from the
    storm and `feedback` = `{ correct, correctOptionIds, rationales }`. The server builds `feedback` with the pure
    `src/features/storm/utils/review-feedback.ts` (+ test) from the pack `Question` and the stored `correct`. An
    "Unreviewed" badge marks the labelled questions.
45. Add `src/components/ui/alert-dialog.tsx` with `pnpm dlx shadcn@latest add alert-dialog`. If the CLI wants to change
    `package.json`, stop and report it: that is outside the plan.
46. Routes. Each default export renders a `w-full px-4 md:px-8` shell + `<Suspense>` with a real fallback around an
    async slot, uses `PageProps<…>`, redirects to sign-in with a safe `next`, and calls `notFound()` for an unknown pack.
    - `src/app/(app)/play/[packSlug]/storm/full/page.tsx`: `await finalizeExpiredStorms()`. If `getRunningStorm` finds
      one, `redirect(`/storms/${id}`)`. Otherwise render `StormStart kind="full"` with `questionCount = pack.exam.questions`
      and `durationSeconds = stormDurationSeconds(pack.exam, pack.exam.questions)`, plus links to each domain's Boss Storm.
    - `src/app/(app)/play/[packSlug]/storm/boss/[domain]/page.tsx`: the domain must exist in the pack (else `notFound()`).
      Same running-storm redirect. Render `StormStart kind="boss"` with `BOSS_STORM_SIZE` and its duration.
    - `src/app/(app)/storms/[id]/page.tsx`: `await finalizeExpiredStorms()`; `getStorm(id)` → `notFound()` when null;
      then `listStormQuestions`, `getPack`, `getPackQuestions`.
      - **Running** → `StormSession` with `toStormSessionQuestion` rows only (no key in the RSC payload).
      - **Finished** → `StormReport` from `scoreStorm(pack, toStormResult(...))` + `stormShortfall`, then `StormReview`.
        The key is read from the pack files only in this branch.
47. Sidebar: add `AppSidebarProps.stormHref` (`/play/<packSlug>/storm/full`) and a "Storm" `SidebarMenuItem` with lucide
    `CloudLightning` and `tooltip="Storm"`, active on `/play/<slug>/storm` and `/storms`. `src/app/(app)/layout.tsx`
    passes the href. `isActivePath` stays unchanged; extend `utils.test.ts` only if a helper is added.

### T5 — storm proof into the learner's forest (ui-builder)

48. `src/app/(app)/today/page.tsx`: `await finalizeExpiredStorms()` before the reads; add
    `listMyStormResults(user.id, packSlug)` to the `Promise.all`; call `memoryBySkill(countable, now, stormProof(results, review.rejected))`.
    `planWalk` is unchanged (it does not depend on the stage).
49. `src/app/(app)/groups/[groupId]/page.tsx`: the viewer's own forest gets the same proof. `getGroupHeatmap` is unchanged.

### T6 — gate sweep (service-builder; changes no source)

50. Record the advisors baseline before T1 is applied (from LOOP-VERIFY) and again after: `supabase db advisors --local`
    must add no warning. Run `pnpm typecheck && pnpm lint && pnpm test && pnpm test:db && pnpm build`. A failure goes
    back to the task that owns the file. T6 edits nothing under `src/`, `supabase/` or `scripts/`.

## Riskiest step

**T1 steps 7–11: the key and the grade must never be readable before the end, the content hash must bind every
answer, and only the DB enforces the deadline.**
- *Key/grade leak.* `storm_questions.correct` is written only inside `finalize_storm`, which sets `finished_at` in the
  same transaction. Attempts, which feed the visible forest, are written there too, so no answer-time signal exists
  (C-4). `answer_storm_question` returns `void`. The page serves `toPlayableQuestion` only and reads the key only in
  the finished branch. Proof: DB "SC-4" (row `correct` null, no key columns, a storm row free of "correct"),
  `to-storm-session-question.test.ts`, and the view-source check in SC-7.
- *Hash binding.* An answer must match the stored AND the current registry hash, and finish voids any question whose
  registry hash moved. Proof: DB "SC-3 hash" and "SC-5" (q3 voided, no attempt), and `mf-0013-storm-finalize.db.test.ts` (f).
- *Deadline.* Only `now() >= ends_at` in `answer_storm_question` decides, and the countdown is drawn from `ends_at`.
  Proof: DB "after ends_at an answer is refused".

**UI predicates and the server refusal that holds when they are bypassed:**

| UI predicate | Server refusal | Test |
|---|---|---|
| Start button hidden while a storm runs (redirect) | `start_storm` `23505` + partial unique index + advisory lock | DB "second running storm is refused" |
| Options locked at 0 s | `answer_storm_question` `MF013` on DB `now()` | DB "after ends_at" |
| Finish confirm / double click | `finalize_storm` locks the row and is a no-op when finished; unique `(storm_id, question_id)` on attempts | finalize test (c) |
| Answer and Finish racing | both lock the storm row `for update`; an answer after `finished_at` gets `MF013` | finalize test (c) + DB "SC-5" |
| Server-composed plan | `start_storm` checks the domain, count ≤ 12/53, no repeats, playable, unspoiled, current hash | DB "the DB refuses a storm it did not plan" |

## Rejected options

- **Composition in SQL**: the blueprint split, the tiers and the seeded shuffle are domain rules that need unit tests
  and the pack file (weights), which the DB does not hold. The DB only checks validity (start trust, decided 2026-11-04).
- **The secret key for start**: it would need `service_role` EXECUTE and a server-only client. The user chose
  "learner + DB checks" and accepted the residual. No new use of `SUPABASE_SECRET_KEY`.
- **Attempts written per answer**: answers change until the end, and an attempt row grows the forest, which would leak
  correctness mid-storm (C-4, decided).
- **A test-only clock**: it would ship a switch in app code. Expiry is proven by moving `ends_at` as the local superuser
  (C-6, decided).
- **`storm_proven` stored on a table**: proof is derived from finished storms, so a later rejection drops out (GOAL).
- **A client timer started on mount**: it drifts across reloads and tabs. The countdown is always `ends_at − now`.

## Verify

- VERIFY `MF-0013`: the receipt must say DONE for this tree.
- EVAL `MF-0013`: the process read back from these files.
- Fresh-context review (high-risk): `diff-reviewer` reads the diff against GOAL + this plan, before hand-off.
- Browser (port 3001, a signed-in learner):
  - Boss Storm D2: start → the countdown is within 2 s of `ends_at` (compare with `select ends_at` on the local DB) →
    answer, skip, return, change an answer → Finish → the report (per domain, per skill, unreviewed labels) → the
    review with keys.
  - View source of `/storms/<id>` while the storm runs: no `rationale`, no `correct`.
  - Full Storm: shorter than 53 today (D2 has 13), and the report says so.
  - Reload mid-storm: the answers and the clock are kept.
- Today, after a storm that proves a skill with stability ≥ 14 d, shows a Tree. If no such memory exists locally, the
  `stormProof` and `memory-by-skill` unit tests stand in.

## Tasks

`verifier` is not a valid plan agent (`PLAN_AGENTS` in `scripts/lib/ticket-eval.mjs`), so the final sweep T6 is a
`service-builder` task that edits no source. Frozen tests appear in `owns` only so that the scope check covers the
freeze diff. No builder edits them.

```json tasks
[
  {
    "id": "T1",
    "title": "storms migration, private exam timing and skill map, key sync, DB types, finalize DB test",
    "agent": "schema-builder",
    "owns": [
      "supabase/migrations/*_mf0013_storms.sql",
      "scripts/sync-question-keys.mjs",
      "src/server/db/database.types.ts",
      "src/server/db/__tests__/mf-0013-storms.db.acceptance.test.ts",
      "src/server/db/__tests__/mf-0013-storm-finalize.db.test.ts",
      "src/server/db/__tests__/mf-0005-grants.db.acceptance.test.ts"
    ],
    "depends_on": [],
    "closes": ["SC-3", "SC-4", "SC-5"],
    "done_when": [
      "pnpm test:db src/server/db/__tests__/mf-0013-storms.db.acceptance.test.ts",
      "pnpm test:db src/server/db/__tests__/mf-0013-storm-finalize.db.test.ts",
      "pnpm test:db src/server/db/__tests__/mf-0005-grants.db.acceptance.test.ts",
      "pnpm test:db",
      "pnpm typecheck"
    ],
    "context": [
      "skill:supabase",
      "skill:supabase-postgres-best-practices",
      "file:supabase/migrations/20261103083446_mf0003_attempts.sql",
      "file:supabase/migrations/20261103160000_mf0007_reviews.sql",
      "file:supabase/migrations/20261103150000_mf0004_create_group_guards.sql",
      "file:.planning/tasks/MF-0013/GOAL.md#Decided by the user (2026-11-04)",
      "memory:windows-dev-environment"
    ]
  },
  {
    "id": "T2",
    "title": "storm engine (compose, score, proof, shortfall), tree-stage rules, memory proof merge, MINDFORGE.md 2.2",
    "agent": "service-builder",
    "owns": [
      "src/engine/storm/**",
      "src/engine/forest/tree-stage.ts",
      "src/engine/forest/__tests__/**",
      "src/engine/memory/**",
      "docs/MINDFORGE.md",
      "CONTEXT.md"
    ],
    "depends_on": [],
    "closes": ["SC-1", "SC-2", "SC-5", "SC-6"],
    "done_when": [
      "pnpm test src/engine/storm/__tests__/mf-0013-storm.acceptance.test.ts",
      "pnpm test src/engine/forest/__tests__/mf-0001-stage.acceptance.test.ts",
      "pnpm test src/engine/forest/__tests__/mf-0011-group-heatmap.acceptance.test.ts",
      "pnpm test src/engine/storm src/engine/forest src/engine/memory",
      "grep -n \"storm-proven\" docs/MINDFORGE.md",
      "pnpm typecheck"
    ],
    "context": [
      "skill:typescript-strict",
      "skill:tdd",
      "skill:testing-strategy",
      "file:src/engine/content/review.ts",
      "file:src/engine/memory/countable.ts",
      "file:packs/ccdv-f/pack.yaml",
      "file:CONTEXT.md"
    ]
  },
  {
    "id": "T3",
    "title": "server storm reads, lazy finalisation, start helper, no-key session mapper",
    "agent": "service-builder",
    "owns": ["src/server/storm/**"],
    "depends_on": ["T1", "T2"],
    "closes": ["SC-4"],
    "done_when": [
      "pnpm test src/server/storm",
      "pnpm typecheck",
      "pnpm lint"
    ],
    "context": [
      "skill:nextjs-data",
      "skill:react-feature-architecture",
      "skill:typescript-strict",
      "file:src/server/attempts/grade-answer.ts",
      "file:src/server/memory/fetch-attempts.ts",
      "file:src/server/content/get-review-context.ts",
      "file:src/server/content/get-item-hashes.ts",
      "file:src/engine/questions/playable.ts"
    ]
  },
  {
    "id": "T4",
    "title": "storm feature (actions, start, session with countdown, report, review), three routes, sidebar entry",
    "agent": "ui-builder",
    "owns": [
      "src/features/storm/**",
      "src/app/(app)/play/[packSlug]/storm/**",
      "src/app/(app)/storms/**",
      "src/features/app-shell/components/app-sidebar/**",
      "src/app/(app)/layout.tsx",
      "src/components/ui/alert-dialog.tsx"
    ],
    "depends_on": ["T3"],
    "closes": ["SC-4", "SC-7"],
    "done_when": [
      "pnpm test src/features/storm src/features/app-shell",
      "pnpm typecheck",
      "pnpm lint",
      "pnpm build"
    ],
    "context": [
      "skill:server-client-components",
      "skill:nextjs-data",
      "skill:client-data-tanstack-query",
      "skill:forms-rhf-zod",
      "skill:react-client-patterns",
      "skill:react-component-split",
      "skill:ui-shadcn",
      "skill:accessibility",
      "file:src/app/(app)/play/[packSlug]/walk/page.tsx",
      "file:src/features/walk/components/walk-session/hooks/use-walk-session.ts",
      "file:src/features/groups/utils/rpc-errors.ts",
      "file:src/components/question-card/types.ts"
    ]
  },
  {
    "id": "T5",
    "title": "wire storm proof into the learner own forest (Today, group page)",
    "agent": "ui-builder",
    "owns": [
      "src/app/(app)/today/page.tsx",
      "src/app/(app)/groups/[groupId]/page.tsx"
    ],
    "depends_on": ["T2", "T3"],
    "closes": ["SC-6"],
    "done_when": [
      "pnpm test",
      "pnpm typecheck",
      "pnpm build"
    ],
    "context": [
      "skill:nextjs-data",
      "skill:server-client-components",
      "file:src/engine/memory/memory-by-skill.ts"
    ]
  },
  {
    "id": "T6",
    "title": "gate sweep: advisors, grants, full test, build (edits no source)",
    "agent": "service-builder",
    "owns": [".planning/evidence/MF-0013.md"],
    "depends_on": ["T1", "T4", "T5"],
    "closes": ["SC-8"],
    "done_when": [
      "supabase db advisors --local",
      "pnpm typecheck",
      "pnpm lint",
      "pnpm test",
      "pnpm test:db",
      "pnpm build"
    ],
    "context": [
      "skill:supabase",
      "memory:windows-dev-environment"
    ]
  }
]
```

## Divergences (recorded during BUILD)

- 2026-11-04 · T1 step 13 (`scripts/sync-question-keys.mjs`) done by the orchestrator: role agents may
  never write `scripts/**` (agent-scopes NEVER list).
- 2026-11-04 · T3: one `as string` in `src/server/storm/start-storm.ts` (`p_domain_code`). **Superseded by review 1 (N1): removed; both trailing parameters now have defaults.** `supabase gen types`
  types every SQL argument non-null, but a Full Storm must pass null. A `default null` would need a default
  on `p_questions` too (Postgres: parameters after a default need defaults) or an argument reorder that
  breaks the frozen `to_regprocedure('public.start_storm(text,text,text,jsonb)')` check. Kept as one
  commented line; flagged for the fresh-context review.
- 2026-11-04 · T6 (`.planning/evidence/**`, never writable by role agents) runs in the orchestrator.
