---
ticket_id: MF-0024
tier: high-risk                   # migration: CHECK on private.question_keys / private.items (option B)
stage: handoff
branch: feat/MF-0024
builds_on: [MF-0003, MF-0007, MF-0012]
last_iteration: 0
goal_status: complete-pending-manual-commit
---

> Reserved 2026-11-04 by MF-0012 (user decision C-3), from the MF-0003 review note "cross-pack
> `question_id` PK". Picked up 2026-11-05 (`/gsd-goal-loop MF-0024`).

## Objective

**Today.** `private.question_keys` is keyed by `question_id` alone and `private.items` by `item_id`. Ids follow
`<pack>.<skill>.<name>` by convention only: the zod pattern (`src/engine/questions/schema.ts:22`,
`src/engine/content/schema.ts:14`) checks the shape, never that `<pack>` is the pack the file lives in. Uniqueness
is checked pack-wide (`parseContent` `claim`), not across packs. The sync (`scripts/sync-question-keys.mjs:214-245`)
upserts `on conflict (question_id) do update set pack_slug = excluded.pack_slug`, and takes `pack_slug` from the
**folder name**, which nothing ties to `pack.yaml`'s `slug`. So a pack B file reusing pack A's id moves A's key to
B (A's question is then graded under B's key, attempts carry B's slug/skill), and whichever pack syncs second
wins, silently.

**End state.** An id can only belong to the pack whose slug it starts with, and the folder a pack syncs from is its
slug. Then two packs can never claim one id, the global PK is correct as it is, and the sync's `on conflict` can
only ever hit the same pack. The validator refuses a violation (app load, `check:packs`, and the sync before it
connects, per MF-0012), so nothing is written. (`check:packs` is cuckoo grounding only; it does not run this
validator — review correction 2026-11-05.)

## Affected

- Roles: none at runtime (content authors and the sync operator only).
- Code: `src/engine/content/load-content.ts` (`parseContent`), `src/engine/questions/load-questions.ts`
  (`parseQuestionFiles`), `scripts/lib/validate-packs.mjs` (folder ↔ slug). Option B adds a migration.
- Tables: `private.question_keys`, `private.items` (option B: CHECK constraint).

## Constraints

- MF-0012: the sync validates every pack before connecting and writes nothing on any problem; keep that order.
- Never edit an applied migration; option B is a new one, local stack only.
- Frozen acceptance tests are not edited without the user.
- Ids are stable keys for attempts, memory and reviews: no shipped id may need to change.

## Probes (2026-11-05, read-only)

- Every shipped item (7 packs, 504 items: questions, cards, diagrams, cuckoos) already starts with
  `<pack.yaml slug>.`, and even with `<slug>.<file skill>.`; every folder name equals its `slug`; no id appears in
  two packs. `team-onboarding-sample` has 0 items. The rule finds nothing in shipped content.
- Rule applied in a scratch worktree (`parseContent` + `parseQuestionFiles` refuse a prefix ≠ slug): `unit` + `ui`
  568/568 pass, so no frozen engine test breaks. `db`: 19 fail, identical to the untouched tree (see Baseline).
- `record_attempt` (MF-0032) and `finish_storm` (MF-0013) take `pack_slug` / `skill_code` from the key row, never
  from the client, so once a key cannot move packs, attempts cannot be mis-filed. No RPC change is needed.
- Option B probe: `mf-0017-expedition.db.acceptance.test.ts:30,373` (frozen) inserts `private.items` rows with id
  `mf0017-<run>-…` under pack `ccdv-f`; a DB CHECK would make it fail, i.e. one re-freeze.

## Baseline (preflight 2026-11-05)

- `pnpm typecheck`, `pnpm lint`: exit 0. `pnpm test`: 127 files, 568 tests pass.
- `pnpm test:db`: 19 fail in `mf-0013-storms` and `mf-0017-expedition` with `PGRST202` (RPC not found), same on
  the untouched tree. Cause: local stack lacks migration `20261105100000_mf0017_expeditions` (`migration list
  --local`: remote column empty). Pre-existing, not this ticket.
- `main` CI: latest run (fa7e6fa) `in_progress`; previous two `success`. No `ticket:*` scripts in `package.json`:
  FREEZE/VERIFY/EVAL run by hand (skill defaults, LF-normalised hashes).

## Options (decision for the user at the checkpoint)

- **A. Validator only (recommended).** Prefix rule in both loaders + folder = slug in the sync's validation. No
  migration, no re-freeze. Residual: a writer that bypasses the sync (a test, a hand `psql`) can still insert a
  mismatched row; today only tests do.
- **B. A + DB CHECK** `split_part(question_id, '.', 1) = pack_slug` on `question_keys` and the same on `items`.
  Defence in depth; costs a migration and a re-freeze of MF-0017's frozen fixture.
- **C. Composite key `(pack_slug, question_id)`** — rejected: touches attempts, reviews, flags, storms, expeditions,
  heatmap joins and every RPC signature, and buys nothing once ids carry their pack.

## Success Criteria (frozen 2026-11-05, option B)

- [x] SC-1: `parseContent` refuses an item of each kind (question, card, diagram, cuckoo) whose id's first segment is
  not the pack's `slug`, with an issue `<file>: <kind>.<i>.id: id "<id>" must start with "<slug>."`, and keeps
  accepting a correctly prefixed one. Proof: frozen unit test `src/engine/content/__tests__/mf-0024-id-prefix.acceptance.test.ts`.
- [x] SC-2: `parseQuestionFiles` (still used by `get-pack-questions.ts` and `scripts/generate/questions.ts`) applies
  the same rule with the same message. Proof: same frozen file.
- [x] SC-3: the sync refuses a pack whose folder name differs from its `pack.yaml` slug, and a pack B whose question
  reuses pack A's id; in both cases it exits 1 with "Not syncing", names the folder/id, and the DB snapshot
  (packs, keys, items) is byte-identical before and after; pack A's key keeps `pack_slug = A`. Proof: frozen DB test
  `src/server/db/__tests__/mf-0024-id-prefix.db.acceptance.test.ts` (MF-0012 fixture shape: temp copy of `packs/`
  + `MINDFORGE_PACKS_DIR`).
- [x] SC-4: every shipped pack still validates (504 items, 0 issues). Proof: regression lock in the SC-1 file over the
  real `packs/` folder (frozen green, stated reason) + the real `pnpm db:sync-keys` run. (Review correction: the draft
  also named `pnpm check:packs`, which never calls the validator; dropped as a proof, not a change of intent.)
- [x] SC-5: migration `<ts>_mf0024_id_prefix_check.sql` adds the CHECK to both tables; inserting a `question_keys` or `items` row whose id prefix ≠ `pack_slug` fails with `23514`;
  a matching row inserts. Proof: frozen DB test (same file as SC-3); MF-0017's frozen DB fixture re-frozen with
  prefixed ids (`PREFIX = ${PACK}.mf0017-${RUN}.`; reason recorded in MF-0017 `FROZEN.json` history).

### Constraints → how met

- Validate before connect: the rule lives in the loaders `validatePacks` already calls; folder check added there.
- No shipped id changes: probe shows 0 hits; SC-4 locks it.
- Frozen tests: the validator breaks none (probe); the CHECK re-freezes one (MF-0017 DB), approved with option B.
- Hosted data: `add constraint` validates existing rows and fails the migration loudly on any mismatch; hosted rows
  come only from the sync of shipped packs (0 mismatches), so it applies cleanly. Riskiest step; see LOOP-PLAN.

## Decided without a question

- Rule checks the **pack** segment only, not `<slug>.<skill>.`: the pack segment is what makes ids disjoint across
  packs (a slug has no dot, so the first segment is unambiguous). Tying the id to its skill would force a new id
  (and lose attempt history) whenever a question moves skill — out of this ticket's goal.
- No RPC or attempts change: they derive pack and skill from the key (probe above).
- `parseQuestionFiles` gets the rule too (it has live callers), with one shared helper so the message has one owner.
- Proof needs no `db:reset` / `supabase stop|start`: the DB test seeds and removes its own fixture slugs.

## Decided by the user (2026-11-05 checkpoint)

- K-1 → **option B** (validator + DB CHECK), including the MF-0017 fixture re-freeze.
- K-2 → apply the MF-0017 migration locally: done (`supabase migration up --local`, then `pnpm db:sync-keys`).
  `pnpm test:db` baseline is now 77/84; the 7 reds are all `mf-0013-storms` (`22023 not a playable question for
  this storm`: its fixture takes the first 3 ccdv-f D2 keys without filtering flagged/rejected items; local seed
  state, unverified hypothesis). Pre-existing, not this ticket.

## Concerns (owner)

- K-1, K-2: resolved (above).
- K-3 (agent, done): `MF-0031/GOAL.md` held two tickets after a merge; the reserved plan-check gate was split out to
  `MF-0048/GOAL.md` and the MF-0013 retro pointer updated. Separate hunk in the hand-off.

## Out of Scope

- Composite keys (option C). Orphaned keys (MF-0025). Learn-the-key (MF-0027).
- A `<slug>.<skill>.` rule (see Decided).

## Iteration Log

- 2026-11-05 intake + design drafted; probes run; checkpoint: user chose B and the local migration.
- 2026-11-05 iteration 0: frozen (2 files + MF-0017 re-freeze), plan approved, built (T1-T3 inline), TEST green
  except 7 baseline storm reds; fresh-context review: approve, 0 blockers, 2 GOAL-text should-fix applied. Hand-off.
