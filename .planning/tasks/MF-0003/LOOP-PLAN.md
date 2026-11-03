---
phase: 1-planning
ticket_id: MF-0003
status: executing
verdict: IN_PROGRESS
started_at: "2026-11-03"
resume_with: /gsd-goal-loop
---

# Loop Plan — Iteration 1

## Discovery summary

- Precedents: MF-0001 pack loader (`src/engine/pack/load-pack.ts`: YAML → Zod → path-named errors; `PackValidationError`) is the shape for the question loader. MF-0002 migration (`supabase/migrations/20261103064106_mf0002_groups.sql`) is the shape for private definer + public invoker wrapper + `revoke all` first. Its test harness is `src/test/local-stack.ts`.
- `ts-fsrs` 5.4.2 probed with `enable_fuzz: false`: w[0..3] = 0.212, 1.2931, 2.3065, 8.2956; one Good → S 2.307 (R@60d 0.603); Good at 0/3/10/25 → S 87.04; one Again → S 0.212, reps 1. API: `createEmptyCard(date)`, `fsrs(generatorParameters(...)).next(card, date, Rating.Good|Again).card`, `get_retrievability(card, now, false)`.
- Memory `project-supabase-migration-rules`: `revoke all` first; `connection()` already sits in `createServerSupabase()`.
- Frozen: `mf-0003-questions.acceptance.test.ts` (77081ab09eb2), `mf-0003-replay.acceptance.test.ts` (91cabad8f95f), `mf-0003-attempts.db.acceptance.test.ts` (aaaeeb3cef14). Content `packs/ccdv-f/questions/*.yaml` is being drafted by a background agent to the GOAL's format.

## SC coverage

| SC | Steps | Proof |
|----|-------|-------|
| SC-1, SC-2, SC-6 | 1, 2 (+content) | frozen questions acceptance |
| SC-3, SC-7 | 3 | frozen replay/selection acceptance |
| SC-4, SC-5 | 4, 5 | frozen DB acceptance |
| SC-8 | 6–8 | browser + HTML grep |
| SC-9 | all | receipt, advisors, REVIEW.md |

## Steps

1. `src/engine/questions/schema.ts` (Zod: file `{skill, questions[]}`, question `{id, status ∈ official|unreviewed, stem, select ≥ 1, options[2..6]{id,text,correct,rationale non-empty}, source{title,url}}` + `superRefine`: select = #correct at `questions.i.select`; duplicate option id at `questions.i.options.j.id`); `load-questions.ts`: `parseQuestionFiles(files, pack)` parses each file (errors prefixed `<file>: <path>: msg`), checks `skill` ∈ pack (path `skill`) and pack-wide id uniqueness (path `questions.i.id` in the later file); `loadPackQuestions(pack, dir)` reads `*.yaml` sorted. A missing dir → `[]`. `QuestionValidationError` mirrors `PackValidationError`.
2. `playable.ts`: `toPlayableQuestion` builds a NEW object field by field (an allow-list, never spread-and-delete).
3. `src/engine/memory/replay.ts`: sort by `answeredAt`, `createEmptyCard(first)`, `next(card, at, correct ? Good : Again)`, then `{successfulRecalls, stabilityDays: card.stability, retrievability: get_retrievability(card, now, false), feynmanPassed: false, stormSurvived: false}`. `memory-by-skill.ts`: group attempts per skill → `Map<skill, MemorySnapshot>`. `select.ts`: rank every skill by `weight × (1 − R)` (R = 0 if unseen), skip skills with no questions, sort desc (stable by pack order on ties), take `size` (default 5), then per skill the question with the oldest last-attempt (never-seen first, then file order). Inner tests for ties, empty skills, and fewer skills than `size`.
4. Migration `supabase migration new mf0003_attempts`:
   - `private.question_keys(question_id text pk, pack_slug text, skill_code text, correct_options text[] not null check (cardinality ≥ 1), updated_at)`, RLS on, `revoke all … from anon, authenticated` (no policies, no grants).
   - `public.attempts(id bigint identity pk, user_id uuid not null default auth.uid() → auth.users on delete cascade, pack_slug, skill_code, question_id text not null, chosen text[] not null check (cardinality between 1 and 10), correct boolean not null, answered_at timestamptz not null default now())` + index `(user_id, pack_slug, answered_at)`. RLS: select `user_id = (select auth.uid())` TO authenticated. `revoke all` then `grant select` only.
   - `private.record_attempt(p_question_id text, p_chosen text[]) returns boolean` (`security definer`, `set search_path = ''`): `auth.uid()` null → 42501; key lookup or raise `unknown question` (P0002); `correct := array(select distinct x from unnest(p_chosen) x order by 1) = array(select x from unnest(k.correct_options) x order by 1)`; insert the attempt with the key's pack/skill (never the client's); return `correct`. `public.record_attempt` = invoker wrapper. Revoke execute from `public, anon`; grant to `authenticated`.
   - `supabase db reset` → `pnpm db:types`.
5. `scripts/sync-question-keys.mjs`: DB URL from `SUPABASE_DB_URL`, else `supabase status -o json` (local). For each `packs/*/questions/*.yaml`, in one transaction per pack: upsert `(question_id, pack_slug, skill_code, correct_options)` and delete that pack's rows that are no longer in the files. It prints counts. `package.json`: `db:sync-keys`. README: run it after `db reset` and after editing questions.
6. Server reads: `src/server/questions/get-pack-questions.ts` (`"use cache"` + `cacheLife("days")`; same for everyone); `src/server/memory/list-my-attempts.ts` (user client, RLS, uncached → `Attempt[]`).
7. Duel: `src/app/play/[packSlug]/duel/page.tsx` (container under `<Suspense>`: user or redirect → pack, questions, attempts → `pickSessionQuestions` → `toPlayableQuestion[]` → `<DuelSession>`); `src/features/duel/actions.ts` `answerQuestion(packSlug, questionId, chosen)`: auth → zod → question must belong to the pack → `rpc('record_attempt')` → returns `{correct, correctOptionIds, rationales, source}` **after** grading (missing key → friendly error); `src/features/duel/components/duel-session/` (client: one question at a time, radio/checkbox by `select`, submit, feedback with every option's rationale, the correct ones marked, source link, "Unreviewed" or "Official" badge, Next, end summary + link back).
8. Group page: replace `buildForest(pack)` with `buildForest(pack, memoryBySkill(attempts, now))` for the signed-in learner, and add a "Play Scenario Duel" link to `/play/<pack>/duel`. The public `/` stays all seeds.

## Divergences from the plan (recorded after review)

- A parallel UI session moved routes into `src/app/(app)/…` and made shadcn + tokens normative (`.claude/rules/ui-design.md`). So the duel lives at `src/app/(app)/play/[packSlug]/duel/page.tsx`, was restyled with shadcn `Card/Badge/Button/RadioGroup/Checkbox` (the last two added via the CLI), and memory was also wired into the UI session's `(app)/today/page.tsx`. Coordinated by message; the sidebar link was done by the UI session.
- Review fixes added `src/server/memory/fetch-attempts.ts` (paging) and three regression tests.

## Riskiest step

Step 4/7: the honesty boundary. If any path lets the client decide `correct`, or exposes the key before answering, the forest lies. Guards: `attempts` has no INSERT/UPDATE grant (frozen SC-4b forges both); `correct` is computed only inside `private.record_attempt` from `private.question_keys` (SC-4a: exact, wrong and superset); the key table is unreadable (SC-5); pack/skill on the attempt come from the key row, not the client; the browser gets only `PlayableQuestion` (frozen SC-6) and the page HTML is grepped for rationale text (SC-8). Server refusal behind the UI: the submit button is disabled until `select` options are chosen, but the DB grades any array (a wrong count is just incorrect), and `chosen` is bounded to 1..10 by a CHECK.

## Rejected options

- Grading in the Next server and writing attempts with the secret key: puts a privileged key in app code.
- Grading in the Next server and passing `correct` to an RPC: any user could forge `correct = true` with their own token.
- Storing `memory_states`: a second source of truth that can drift or be written; replay is cheap at this scale.
- Questions in the DB with a content admin UI: it's the review workflow ticket, and files are PR-reviewable now.
- `ts-fsrs` 6.0.0: published 2026-10-28, too new for the release-age policy.

## Verify

VERIFY: typecheck · lint · `pnpm test` · `pnpm db:reset && pnpm db:sync-keys && pnpm test:db` · build · check-hooks · frozen hashes (MF-0001/2/3) · tree hash. `supabase db advisors --local`. Browser SC-8. Fresh-context `diff-reviewer`.

## Tasks

```json tasks
[
  { "id": "T1", "title": "question schema, loader, playable DTO", "agent": "inline",
    "owns": ["src/engine/questions/**"], "depends_on": [], "closes": ["SC-1", "SC-6"],
    "done_when": ["pnpm vitest run --project unit src/engine/questions"], "context": ["skill:typescript-strict"] },
  { "id": "T2", "title": "content (background agent) + validation", "agent": "inline",
    "owns": ["packs/ccdv-f/questions/**"], "depends_on": ["T1"], "closes": ["SC-2"],
    "done_when": ["pnpm vitest run --project unit src/engine/questions"], "context": [] },
  { "id": "T3", "title": "FSRS replay, memory by skill, session selection", "agent": "inline",
    "owns": ["src/engine/memory/**", "package.json", "pnpm-lock.yaml"], "depends_on": ["T1"], "closes": ["SC-3", "SC-7"],
    "done_when": ["pnpm vitest run --project unit src/engine/memory"], "context": [] },
  { "id": "T4", "title": "migration attempts + question_keys + record_attempt; sync script", "agent": "inline",
    "owns": ["supabase/migrations/**", "scripts/sync-question-keys.mjs", "src/server/db/database.types.ts", "README.md", "package.json"], "depends_on": ["T2"], "closes": ["SC-4", "SC-5"],
    "done_when": ["supabase db reset", "pnpm db:sync-keys", "pnpm test:db", "supabase db advisors --local"], "context": ["skill:supabase"] },
  { "id": "T5", "title": "server reads, duel route + action + UI, group forest with memory", "agent": "inline",
    "owns": ["src/server/questions/**", "src/server/memory/**", "src/app/(app)/play/**", "src/features/duel/**", "src/app/(app)/groups/[groupId]/page.tsx", "src/app/(app)/today/page.tsx", "src/components/ui/radio-group.tsx", "src/components/ui/checkbox.tsx"], "depends_on": ["T3", "T4"], "closes": ["SC-8"],
    "done_when": ["pnpm build", "browser SC-8"], "context": ["skill:nextjs-data", "skill:react-client-patterns"] },
  { "id": "T6", "title": "verify, review, evidence", "agent": "inline",
    "owns": [".planning/tasks/MF-0003/**", ".planning/evidence/MF-0003.md"], "depends_on": ["T1", "T2", "T3", "T4", "T5"], "closes": ["SC-9"],
    "done_when": ["receipt PASS", "REVIEW.md approve for the receipt tree"], "context": [] }
]
```
