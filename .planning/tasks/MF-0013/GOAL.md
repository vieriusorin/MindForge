---
ticket_id: MF-0013
tier: high-risk                   # schema + server-side deadline + changes what "Tree" means
stage: handoff
branch: feat/MF-0013
builds_on: [MF-0003, MF-0006, MF-0007]
last_iteration: 0
goal_status: complete-pending-manual-commit
track: E + G                      # seat Coder D (helped by Coder F)
week: W3
depends_on: [MF-0006]             # review state via the getReviewContext seam; empty = all unreviewed
blocks: []                        # MF-0015 consumes StormDomainScore; the second to merge wires them
---

> Drafted 2026-11-03 from the planning grill (Q8, Q10). Design resumed 2026-11-04 on `feat/MF-0013`
> (main at `bd4e1dc`). SCs are proposals until the user confirms them at the checkpoint.

## Objective

Today nobody can practise under exam conditions, and with Feynman cut no tree can grow past Sapling
(`src/engine/forest/tree-stage.ts:31-36` needs `feynmanPassed`, which `replayMemory` hard-codes to
`false` at `src/engine/memory/replay.ts:34-35`).

End state: **Full Storm** (53 questions, 120 minutes, blueprint-weighted) and **Boss Storm** (one
domain, 12 questions, ~27 minutes) run with a server-side deadline and no feedback until the end,
then a per-domain and per-skill report and a full review. Storm answers become normal attempts. A
skill **proven in a storm** can reach Tree; Full-Storm-proven can reach Ancient.

## Affected

- **Roles:** learner (own storms only). No group or other-learner surface.
- **Surfaces:** new migration: `public.storms`, `public.storm_questions` (+ `attempts.storm_id`), storm
  RPCs in `private` with `public` invoker shims; `src/engine/storm/**` (composition, scoring, report,
  proof); `src/engine/forest/tree-stage.ts` + `src/engine/memory/{replay,memory-by-skill}.ts`;
  `src/server/storm/**`; `src/features/storm/**`; routes `/play/[packSlug]/storm/full`,
  `/play/[packSlug]/storm/boss/[domain]`, `/storms/[id]`; `docs/MINDFORGE.md` §2.2 (Tree row).

## Constraints

- Terms: Storm, Boss Storm, Full Storm, Storm-proven skill, Survived domain, Playable, Spoiled (CONTEXT.md).
- The deadline is enforced by the DB (`ends_at`, DB clock); answers after it are refused; unanswered = wrong.
- One running storm per learner. Key and rationale never reach the browser before the storm ends.
- Revoke-all-first, `auth.uid()` checks, grants gate green; migrations follow the parallel rule (ROADMAP §4).
- The report exports per-domain results as MF-0015's `StormDomainScore[]` (`{ domainCode, percent, finishedAt }`).
- Report figures come from `src/engine/storm/` only.
- A storm answer records a judgement about synced content: it names the content hash the learner read
  (MF-0007 rule, SKILL.md DESIGN).

### Constraints → how met

| Constraint | How met |
|---|---|
| DB deadline | `storms.ends_at = started_at + duration` set inside `start_storm` from `now()`; `answer_storm_question` raises when `now() > ends_at`. The client countdown is drawn from `ends_at`, never from a client timer start. |
| One running storm | partial unique index on `storms (user_id) where finished_at is null`; `start_storm` first finalises the caller's expired storm, then inserts. |
| Key never in browser before the end | storm pages serve `toPlayableQuestion` (allow-list copy, `src/engine/questions/playable.ts:3-13`); `answer_storm_question` returns nothing about correctness; the report route reads keys only when `finished_at is not null`. |
| Grants | revoke all on new tables/functions from public, anon, authenticated; `authenticated` gets SELECT on own `storms`/`storm_questions` rows via RLS; new lines in `mf-0005-grants.db.acceptance.test.ts` allow-lists are an allowlist addition → listed for the user at the checkpoint (C-5). |
| Content hash | `storm_questions.content_hash` is stored at compose time from the pack file; `answer_storm_question(p_storm_id, p_question_id, p_chosen, p_content_hash)` refuses when it differs from the stored hash or from `private.items.content_hash`; at finish, a question whose current hash differs from the stored one is **voided** (not scored, no attempt). |
| Figures from the engine | `scoreStorm` (the report), `stormDomainScores`, `stormProof` in `src/engine/storm/`; pages only render. |
| Other people's data (MF-0011 rule) | Not applicable: a storm and its report are visible only to their learner (RLS `user_id = auth.uid()`); nothing is aggregated across learners. |

## Decided without a question

- Full Storm split: largest-remainder by domain weight, then by skill weight inside a domain
  (planning grill Q8). For ccdv-f this gives D1 8, D2 17, D3 2, D4 1, D5 9, D6 6, D7 4, D8 6 (= 53).
  Quotas use the skill's share of its domain's summed skill weights; a remainder tie goes to the
  earlier entry in `pack.yaml` order (none occurs in ccdv-f).
- Boss Storm: 12 questions (or all playable if fewer), 120/53 min per question → 12 × 7200/53 s,
  rounded up = 1631 s.
- Question choice: approved first; unreviewed only to fill a short domain, labelled in the report;
  never flagged/rejected; exclude questions the learner spoiled; prefer questions not seen in an earlier
  storm. A skill short of questions passes its seats to the other skills of the same domain (largest
  remainder again); a domain short even with unreviewed makes the storm shorter, and the report says so.
  Randomness is a parameter (seeded), so the engine stays pure.
- Skip and return allowed; no pause; closing the tab doesn't stop the clock; unlimited storms; the
  learner may end early ("Finish").
- Tree = stability ≥ 14 d and (Feynman passed or storm-proven); Ancient = stability ≥ 45 d and
  Full-Storm-proven. The MF-0001 stage test is re-frozen here, approved 2026-11-03.
  `MemorySnapshot.stormSurvived` is renamed `stormProven` + `fullStormProven` (CONTEXT.md: "Survived"
  is a domain term, not a skill term).
- Storm-proven is **derived**, not stored: computed from finished storms' scored questions on demand, so
  a question rejected later drops out of the proof the same way it drops out of the replay (CONTEXT.md
  "Attempt").
- `docs/MINDFORGE.md` §2.2 Tree/Ancient rows are corrected to CONTEXT.md (CONTEXT wins).
- `StormDomainScore` is defined by MF-0015 (`src/engine/readiness/types.ts`), not on main yet. Per
  ROADMAP §4.3 this ticket exports `stormDomainScores()` with that exact shape
  (`percent` 0–100, `finishedAt` ISO string); the second to merge wires them.
- Survived domain threshold 72% is a constant in `src/engine/storm/` (`SURVIVE_PERCENT`).

## Success Criteria

- [x] SC-1: `composeFullStorm` for ccdv-f with a pool of ≥ 10 approved questions per skill returns 53
  questions with per-domain counts D1 8, D2 17, D3 2, D4 1, D5 9, D6 6, D7 4, D8 6, and per-skill counts
  D1 2/3/3 · D2 2/1/4/4/4/2 · D3 2 · D4 1 · D5 3/3/1/2 · D6 2/3/1 · D7 2/1/0/1 · D8 3/1/2 (largest
  remainder by skill weight inside each domain, worked by hand on 2026-11-04). Same seed → same storm.
  Proof: engine acceptance test.
- [x] SC-2: A domain with too few approved questions is filled from unreviewed and those are marked
  `unreviewed`; flagged, rejected and spoiled questions never appear; questions from an earlier storm
  appear only when the pool is otherwise short. Boss Storm returns 12 questions of one domain (or all
  playable if fewer) with a 1631 s duration. Proof: engine acceptance test.
- [x] SC-3: On the local stack with real user tokens: an answer after `ends_at` is refused; a second
  running storm is refused; another user can neither read nor answer my storm; an answer naming a
  content hash other than the stored one is refused. Proof: DB acceptance test.
- [x] SC-4: Before finish, neither `answer_storm_question`'s response, nor any `storms`/`storm_questions`
  row the learner can select, nor the storm page HTML contains a correct option or rationale. Proof: DB
  acceptance test + browser check (view source).
- [x] SC-5: `scoreStorm` gives per-domain % (unanswered = wrong, voided excluded), survived = % ≥ 72,
  per-skill proven = all its scored questions correct and ≥ 2 of them; `stormDomainScores` returns
  `{ domainCode, percent, finishedAt }[]`. After finish, each answered storm question is one `attempts`
  row with `storm_id` set, graded by the DB key. Proof: engine acceptance test + DB acceptance test.
- [x] SC-6: Stage rules as decided: stability 20 d + storm-proven → Tree; stability 20 d without →
  Sapling; stability 50 d + Full-Storm-proven → Ancient; stability 50 d + Boss-only proven → Tree.
  Proof: re-frozen MF-0001 stage acceptance test.
- [x] SC-7: A Boss Storm and a Full Storm are playable end to end on the local stack (start, skip and
  return, finish, report, review), and the visible countdown matches `ends_at` within 2 s. Proof:
  browser check on port 3001.
- [x] SC-8: `supabase db advisors --local` adds no new warning, grants gate (`pnpm test:db`) green,
  component split rules, typecheck, lint, test, build. Proof: receipt.

## Concerns

| # | Collision | Owner | Status |
|---|-----------|-------|--------|
| C-1 | D3 (2 seats) and D4 (1 seat) have 1 skill each; D4 can never be proven in a Full Storm and D3 only when both answers are right. Accept: Boss Storms are the way to prove them. | Coder D (user) | resolved 2026-11-04 (user): accepted |
| C-2 | The approved pool is thin today (only `official` items start approved), so most storm questions will be unreviewed and labelled until H-3. Accept. | Owner | resolved 2026-11-04 (user): accepted |
| C-3 | Unanswered questions: wrong in the score, but do they also create a failed attempt (FSRS lapse)? `attempts.chosen` needs 1–10 options today. | user | resolved 2026-11-04 (user): score only, no attempt row → SC-5 |
| C-4 | When answers become attempts: each answer is changeable until finish, so attempts are written at finish (`answered_at` = time of the final choice). Writing at answer time would leak correctness through the forest. | user | resolved 2026-11-04 (user): at finish → SC-5 |
| C-5 | New grants need lines in the frozen MF-0005 grants allow-list (`mf-0005-grants.db.acceptance.test.ts`), an allowlist addition. | user | resolved 2026-11-04 (user): approved; re-freeze MF-0005 with that reason |
| C-6 | Draft SC-7 used a "test-only clock setting". Replaced: expiry is proven in the DB test (SC-3, by moving `ends_at` into the past as the local superuser), so no test switch ships in app code. | user | resolved 2026-11-04 (user): approved |
| C-7 | Proof commands that touch shared local state: applying the migration. Plan uses `supabase migration up --local` (non-destructive; also applies main's MF-0011 migration not yet applied here), no `db:reset`. | user | resolved 2026-11-04 (user): approved |

## Decided by the user (2026-11-04)

- Unanswered = wrong in the storm score only; no attempt row (an attempt stays "a graded answer").
- Storm answers are stored on the storm, changeable until it ends, and graded into `attempts` at finish
  with `answered_at` = time of the final choice and `storm_id` set.
- A storm that expired while the learner was away is finalised lazily, by the next storm read or start
  of that learner (the DB deadline already froze its answers; finalising only writes the attempts).
- C-1 and C-2 accepted; MF-0005 allow-list lines approved (re-freeze); no test-only clock; migration
  applied with `supabase migration up --local`, no `db:reset`.
- **Start trust (asked after the SCs were confirmed):** `start_storm` is granted to `authenticated`;
  the server composes the storm, and the DB checks it: duration from the pack's exam timing and the
  count (`ceil(n × minutes × 60 / questions)`), at most the exam's question count for a Full Storm and
  12 for a Boss Storm, one domain for a Boss Storm, no repeated question, every question synced,
  playable (not flagged or rejected), not spoiled by the caller, with the current content hash.
  Residual (accepted): the choice among valid questions is trusted, so a learner calling the RPC by
  hand could pick questions they know; it changes only their own private forest (the group heatmap's
  "healthy" ignores the Tree stage, `group-heatmap.ts:83`). No new use of the secret key.
- Consequence for the schema: the sync script also writes exam timing to `private.packs`
  (`exam_questions`, `exam_minutes`) and a skill → domain map (`private.pack_skills`), because the DB
  must check the domain and set the clock itself.

## Facts found at freeze (2026-11-04)

- ccdv-f ships **53 questions** (2–3 per skill; D1 6, D2 13, D3 2, D4 2, D5 8, D6 6, D7 9, D8 7). An
  earlier count of 270 included option ids. So a Full Storm today is **shorter than 53** (D2 needs 17,
  has 13): the "short domain → shorter storm, report says so" rule applies until MF-0008/MF-0022 add
  questions. SC-1 proves the split on a synthetic pool, as written.
- Order of preference inside a seat, from SC-2: approved unseen → unreviewed unseen → approved seen →
  unreviewed seen (questions from an earlier storm only when the pool is otherwise short).

## Out of Scope

- Readiness weather (MF-0015), group storms, timed leaderboards.
- Content hash on practice attempts (`record_attempt`); only storm answers get it here.

## Open questions

- none (C-1…C-7 resolved 2026-11-04).

## Iteration Log

<!-- append-only -->
- 2026-11-04 · design · Resumed on `feat/MF-0013`. Baseline: typecheck ✓, lint ✓ (365 files), test 233/233.
  Discovery via researcher: grading in `src/server/attempts/grade-answer.ts`, key allow-list in
  `src/engine/questions/playable.ts`, `isPlayable` ignores mode, grants gate =
  `mf-0005-grants.db.acceptance.test.ts`. SCs rewritten with literal splits; C-3…C-7 added.
- 2026-11-04 · design → plan · User resolved C-1…C-7, confirmed the SCs, chose "learner + DB checks"
  for starting a storm. Frozen: `mf-0013-storm.acceptance.test.ts`, `mf-0013-storms.db.acceptance.test.ts`;
  re-frozen MF-0001 stage (SC-6), MF-0005 grants (C-5), MF-0011 heatmap (fixture rename). RED lines in
  LOOP-VERIFY.md. `MemorySnapshot.stormSurvived` → `stormProven` + `fullStormProven` (type only).
- 2026-11-04 · plan → build · LOOP-PLAN.md written by ticket-planner (saved by the orchestrator: the
  agent-scope hook denied the agent's Windows path); `validatePlan` → no errors, SC-1…SC-8 closed. User
  approved the plan. Hook fix approved by the user: `toRel` in `.claude/hooks/lib/gate-io.mjs` uses
  `isAbsolute` (regression test `src/test/__tests__/gate-io-to-rel.test.ts`, RED then green; smoke run:
  ui-builder → supabase/ deny, → src/features/ allow; schema-builder → supabase/ allow). Its own hunk in
  the hand-off.
- 2026-11-04 · build → test → handoff · T1–T5 built by role agents (hook fixed first); T6 run by the
  orchestrator. Review 1: changes requested (B1 client clock finishes the storm, B2 answer echoes the
  stored hash; N1–N5); each fix RED first. Review 2: approve (hash `b0023f12…`). User accepted N4 (a
  hand-built Full Storm can reach Ancient; own forest only). Receipt DONE (LOOP-VERIFY.md). A builder's
  stray `git stash pop` conflicted MF-0008/GOAL.md; restored to HEAD with the user's approval, stashes kept.
