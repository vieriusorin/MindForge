---
ticket_id: MF-0052
tier: high-risk                   # privileged DB client + auth users (local only), as MF-0029/MF-0034
stage: handoff
branch: feat/MF-0052
builds_on: [MF-0029, MF-0034, MF-0013]
last_iteration: 0
goal_status: complete-pending-manual-commit
---

> Claimed 2026-11-05. User (RO): "actualizeaza seed sa contina toate informatiile necesare ca unul din
> utilizatori sa poata umple pe toate paginile, sa interactioneze cu ce e acolo. Pe un setup local nou pe alt
> laptop pagina storm da 404 dupa seed-ul curent."

## Objective

**Today.** `pnpm dev:seed` builds one demo group per pack with questions, all inserted in ONE transaction, so every
`group_members.joined_at` is the same `now()`. The sidebar follows `primaryPackSlug(groups)` = the newest-joined
group (`listMyGroups` orders by `joined_at desc`), so on a tie Postgres picks any pack. Only `ccdv-f` has an
`exam:` block; for any other pack `/play/<slug>/storm/full` calls `notFound()` → the Storm link 404s, and which
pack wins differs per machine. Beyond that, the seed writes no storms, storm questions or expeditions, so
`/storms/[id]`, the readiness card and the group expedition card start empty.

**End state.** After `pnpm dev:setup && MF_AUTHOR_EMAIL=… pnpm dev:seed` on a fresh machine, the seeded "you"
user lands on a deterministic primary pack, every sidebar link resolves (no 404), and every signed-in page shows
seeded data and offers its interaction.

## Facts (re-derived 2026-11-05)

- `src/server/packs/primary-pack.ts`: `groups[0]?.packSlug ?? "ccdv-f"`.
- `src/server/groups/list-my-groups.ts:12`: `.order("joined_at", { ascending: false })`; no tie-breaker.
- `src/dev-seed/seed-demo-world.ts:182-235`: all worlds inside one transaction; no explicit `joined_at`.
- `packs/*/pack.yaml`: only `ccdv-f` has `exam:`; only `ccdv-f` has `cuckoos/`; `team-onboarding-sample` has no
  questions (not seeded).
- Seeded tables today: groups, group_members, attempts, private.item_reviews (approve + flag),
  private.content_maintainers. Not seeded: storms, storm_questions, expeditions, analogy_approvals,
  flag_resolutions.
- MF-0029 GOAL:63: trees top out at sapling because replay never sets Storm results.

## Decided without a question

- Your own items never enter your review queue (`list_reviewable` excludes the author by design, MF-0007); SC-6
  therefore names the account whose queue is non-empty instead of changing authorship.
- Cuckoo for packs without cuckoos already renders an empty state; no change.
- `joined_at` is backdated by the seed (not by changing `listMyGroups`), so the app's ordering stays as it is.

## Decided by the user (2026-11-05)

- **Storm 404: seed + app.** The seed makes `ccdv-f` the user's newest group, deterministically; the app stops
  offering Storm (sidebar link + page) for a pack without `exam:` instead of a 404.
- **Seed scope: all four.** Finished Storms (full + boss, you + demo learners), an active Expedition per demo
  group, a non-empty review queue / flags / pending analogies for you, and due cards for Walk + plantable skills.
- **Ancient is out of scope:** SC-4 asks for Tree; the seed's 3-week history is not stretched to reach Ancient.
- **Recent storms list:** the Storm start page lists your finished storms of that pack (date, kind, survived /
  not survived badge from the engine) linking to `/storms/<id>` (SC-11).
- **Storm verdict (SC-11):** a storm is "Survived" when every scored domain survived (>= 72%); the rule lives in
  `src/engine/storm` with its unit test. A Boss Storm equals its one domain's verdict.
- **Expedition domain (SC-5):** counted over all members (you included), exactly as `expedition_progress` counts.
- **Freeze approved** (5 files, FROZEN.json). SC-6 and SC-7 already pass at freeze; kept as regression locks.
- **`pnpm db:reset` allowed** on the user's local stack for the fresh-machine proof.

## More facts (read-only research, 2026-11-05)

- Grading: `private.finalize_storm` (mf0013:123-172) voids stale questions, sets `correct`, **inserts the
  attempts** (`storm_id` set, `answered_at = chosen_at`) and sets `finished_at = least(now(), ends_at)`. There is no
  score column; `src/engine/storm/score-storm.ts` derives it. `storms_one_running_idx`: at most one unfinished storm
  per user (a leftover unfinished one redirects the Storm page).
- Stages (`src/engine/forest/tree-stage.ts:28-46`): tree = stability >= 14 d AND storm-proven (>= 2 unvoided
  questions of the skill in one finished storm, all correct); ancient = stability >= 45 d AND proven in a FULL storm.
- Expeditions (mf0017): `ends_at = starts_at + 7 days`, no overlap per group, >= 4 members, target 10..1000;
  progress counts correct attempts in the window **with `answered_at >= joined_at`**. The seed's `joined_at` is
  `now()`, so a seeded expedition would show 0 today.
- Review: `list_reviewable` hides items authored by the caller. Every non-ccdv-f item is authored by
  `sorin.vieriu@ddroidd.com`; vlad authors 53 ccdv-f items. All 55 cards are non-official, so pending analogies
  exist without seeding anything; the seed writes no `analogy_approvals`.
- Walk: `planWalk` waters wilting skills (R < 0.85) and offers at most one never-attempted skill. Plant is linked
  only from seed-stage trees on the group page. Cuckoo renders an empty state (not a 404) for packs without cuckoos.
- Nothing links to a finished storm (`/storms/[id]`): the only entry is the redirect after a start.

## Constraints

- Local stack only; the seed keeps its guard (`assertLocalSeedTarget`) and refuses `SUPABASE_DB_URL`.
- Grading has one owner: seeded storms are graded by the DB's own `private.finalize_storm`, never by seed arithmetic.
- Re-runnable: a run replaces only what the seed owns (demo world + rows recorded in the manifest for `youId`).
- Displayed figures still come from `src/engine/**`; the app change adds no arithmetic.

## Success Criteria

- **SC-1 Deterministic primary pack.** After `dev:seed` (all packs), `listMyGroups(you)[0].packSlug === "ccdv-f"`
  on every run. Every member's `joined_at` is backdated before the first seeded attempt, with `ccdv-f`'s group
  the most recent. Proof: unit test on `planDemoWorld` join times + DB acceptance test reading `group_members`.
- **SC-2 No Storm 404.** The sidebar renders the Storm item only when the primary pack has an `exam:` block.
  `/play/<slug>/storm/full` and `/storm/boss/<d>` for a pack without an exam render an explanatory empty state
  (link back to Duel), status 200, not `notFound()`. An unknown slug still 404s. Proof: ui test of the sidebar
  (with / without storm href) + `pnpm build` + browser on `prod-prompting`.
- **SC-3 Finished Storms.** For every seeded pack with an exam: you have 1 finished Full Storm and 1 finished Boss
  Storm, each demo learner 1 finished Full Storm; all graded by `private.finalize_storm` (`finished_at` in the
  past, attempts carry `storm_id`); no unfinished storm is left for anyone. Your Full Storm proves >= 3 skills
  (>= 2 questions each, all correct) and has >= 1 wrong answer. Proof: DB acceptance test.
- **SC-4 Readiness and Tree stage.** After the seed, the ccdv-f readiness card shows a "last storm" value for >= 1
  domain, and your ccdv-f forest has >= 1 skill at stage `tree`. Proof: DB acceptance test that runs the same
  server reads + engine calls as Today (`fetchStormResults` → `stormProof` → `memoryBySkill`/`readiness`).
- **SC-5 Expedition.** Each demo group has one active expedition (`starts_at` 3 days ago), on the domain with the
  most correct demo attempts in the window, with a target that makes `expedition_progress` strictly between 0 and
  the target. Proof: DB acceptance test calling `expedition_progress` as you.
- **SC-6 Review surfaces.** For every seeded pack: >= 1 open flag in `list_open_flags`, >= 1 card in
  `list_pending_analogies` with `can_approve = true` for you, and `list_reviewable` non-empty for at least one
  seeded learner (for you in ccdv-f when you are not the author). The seed's closing output names, per pack, the
  account that has a non-empty review queue. Proof: DB acceptance test.
- **SC-7 Walk and Plant.** In ccdv-f your Walk plan has >= 1 `water` skill and >= 1 `new` skill, and your group
  forest has >= 1 seed-stage tree (a Plant link). Proof: unit test (planned world through `planWalk` with a fixed
  `now`) + browser.
- **SC-8 Re-run and reset safety.** (a) A second run replaces the seeded storms and expeditions and leaves exactly
  the SC-3 counts; (b) a storm you played by hand (not in the manifest) survives a re-run; (c) after `db:reset`, a
  manifest from the old database deletes nothing (ids bound to `youId`); (d) a bad input (a stale pack) fails
  before any delete. Each shown RED first. Proof: DB acceptance tests.
- **SC-9 Fresh-machine walkthrough.** `pnpm db:reset && MF_AUTHOR_EMAIL=… pnpm dev:seed`, signed in as you:
  Today, Groups, Group detail, Duel, Walk, Plant, Cuckoo, Storm (full + boss), a finished `/storms/<id>`, Review,
  Flags each render seeded data with no 404 or error, and one interaction works on each (answer, start, approve).
  Proof: browser check on port 3001, observations in evidence.
- **SC-11 Recent storms.** `/play/<slug>/storm/full` lists your finished storms of that pack, newest first, at most
  5, each row a link to `/storms/<id>` with its date, kind (Full / Boss + domain) and a Survived / Not survived
  badge whose verdict comes from `src/engine/storm` (no component arithmetic); none → no list. Proof: unit test of
  the row mapping in `utils.ts`, ui test of the list, browser.
- **SC-10 Gates.** `pnpm typecheck && pnpm lint && pnpm test && pnpm test:db && pnpm build` exit 0.

## Iteration Log

- 2026-11-05 intake: root cause of the Storm 404 found by reading (tie on `joined_at`); not yet reproduced on the
  local stack.
- 2026-11-05 design preflight: `pnpm typecheck && pnpm lint && pnpm test` exit 0 (134 files, 617 tests) on 0daf557.
- 2026-11-05 design: SC-1..SC-11 drafted from the user's answers (seed+app, all four seed areas, Tree not Ancient, recent-storms list, db:reset allowed). Awaiting the SC checkpoint before RED/freeze.
- 2026-11-05 checkpoint: user confirmed SC-1..SC-11 ("da, confirm, mergi mai departe"). SCs frozen; changes go through the user.
- 2026-11-05 plan pre-check: frozen-test collision risk in MF-0029 SC (per-learner attempts in DB == planned `world.attempts`) because `finalize_storm` inserts attempts. Plan: storm answers are part of `world.attempts` (tagged with their storm) and are inserted only through finalize_storm, so no re-freeze. MF-0034 re-run multiset check unaffected if the plan stays deterministic.
- 2026-11-05 freeze: user approved FROZEN.json (5 files, hashes re-checked). Decisions: whole-storm verdict = every domain survived; expedition domain over all members.
- 2026-11-05 plan: LOOP-PLAN.md written (7 tasks, graph valid by `validatePlan`). No migration and no re-freeze. The
  MF-0029/MF-0034 frozen tests use the single-pack `planDemoWorld` (kept storm-free), so the pre-check collision does
  not arise.
  - Storm answers stay out of `world.attempts`, because the frozen MF-0052 SC-7 adds them on top and would double count.
    This needs the user's ack.
  - `finalize_storm(uuid)` was verified: it has no `auth.uid()`, and `attempts.storm_id` is `on delete set null`, so a
    re-run deletes a storm's attempts by `storm_id` first.
  - Probe: only D4.S1 wilts for you, and 8 skills are already at stability ≥ 45 d. So the Tree comes from a
    Boss-only proof.
  - `src/dev-seed/**` and `scripts/**` are in no role agent's scope, so the orchestrator runs T5–T7.
  - Awaiting the user's plan approval.
- 2026-11-05 plan approved by the user (incl. storm answers outside world.attempts; all-voided storm = not survived; T5-T7 run in the main session). stage: build.
- 2026-11-05 test: gates exit 0 (typecheck, lint, test 141/653, test:db 25/109, build). MF-0013 fixture re-frozen with user approval (playable questions only; history in MF-0013/FROZEN.json). db:reset + dev:seed run twice; page walkthrough by curl with a minted local session (shared browser locked by another session).
- 2026-11-05 handoff: review approve (0 blocking); plan amended (T0b MF-0013 re-freeze); SC-11 ui test added; SC-9 browser half not verified (browser locked).
