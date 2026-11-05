---
verdict: approve
reviewed_hash: cf7fbb3365010f716b670be4e1d7e8e7ba1f7c915094c6e8bdc00e4017e701ac
reviewed_at: 2026-11-05T12:22:56Z
---
## Scope and checks

- Diff: `git diff HEAD` plus the untracked files, hash recomputed locally (matches). The MF-0031, MF-0048 and
  MF-0013/RETRO hunks were out of scope.
- Frozen hashes recomputed with LF normalisation. All three match: MF-0024 engine `3a85e4ee…`, MF-0024 DB `640e50a7…`,
  MF-0017 DB re-freeze `49372fa5…`.
- Run (no DB writes): the vitest unit project on the MF-0024 acceptance file and `id-prefix.test.ts` passed 12/12.
  `pnpm typecheck` exited 0. `biome check` on the changed engine, scripts and test files was clean. `pnpm test:db`
  was not run because it writes the shared local DB.

## Findings

- [should-fix] .planning/tasks/MF-0024/GOAL.md:85: SC-3 (and SC-5 through "same file as SC-3") names the proof
  `src/server/db/__tests__/mf-0024-sync-prefix.db.acceptance.test.ts`, which does not exist. The frozen file is
  `mf-0024-id-prefix.db.acceptance.test.ts`, which is the name in LOOP-PLAN and FROZEN.json. As written, the
  SC-to-proof trace for SC-3 and SC-5 points at nothing, so a traceability or eval pass keyed on the GOAL path cannot
  find the proof.
- [should-fix] .planning/tasks/MF-0024/GOAL.md:27 and :87: the Objective says the validator refuses a violation in
  "app load, `check:packs`, and the sync". `scripts/check-pack-grounding.mjs` never calls `validatePacks`,
  `parseContent` or `idPrefixIssue`. It only grounds cuckoos, and it exits 0 without checking anything when
  `.cache/corpus` is missing. So the "`pnpm check:packs` exits 0" half of SC-4 shows nothing about this rule. The
  intent is still met: the SC-4 lock in the frozen unit file runs under `pnpm test`, and so in CI. The wording should
  stop claiming `check:packs` enforces the rule.
- [note] supabase/migrations/20261105120000_mf0024_id_prefix_check.sql:8-11: the hosted pre-check query exists only
  in this comment and in LOOP-PLAN. `docs/runbook/deploy.md:68-69` (B1/B2, a manual `db push`) does not mention it.
  A mismatched hosted row would abort the migration in its transaction (safe, but it blocks the deploy). Git history
  shows no pack folder ever renamed or deleted, and the sync deletes each pack's stale rows, so the risk is low. Put
  the query in the hand-off or in a runbook follow-up (docs/ is outside this ticket's `owns`).
- [note] Divergence between the DB rule and the app rule. The SQL CHECK `split_part(id,'.',1) = pack_slug` accepts a
  dot-less id equal to the slug (e.g. `ccdv-f`). `idPrefixIssue` (src/engine/pack/id-prefix.ts:7) refuses it. The
  zod id patterns already require dots, so no real writer can produce one. The DB guard is just slightly weaker than
  the app rule.
- [note] src/server/db/__tests__/mf-0024-id-prefix.db.acceptance.test.ts:112-115: teardown runs a full real sync
  whenever `VICTIM` is not `ccdv-f`, and that includes a local DB that was never synced (`undefined`). In that case
  the SC-3 cases fail with "run pnpm db:sync-keys" and teardown then performs that sync itself. The sync also deletes
  `private.packs` rows with no folder, which cascades to `pack_skills` and storms. That is harmless under the serial
  DB project, and it matches the documented setup step, but it is a side effect beyond the fixture slugs. On a green
  run only fixture-slug rows are touched (lines 107-108 and 116, with `pack_skills` cascading from `packs`). The
  child env drops `SUPABASE_DB_URL` (line 70), so the restore sync can only hit the local stack.
- [note] Writer coverage checked, no gap found. The only production writer of `question_keys`/`items` is
  `scripts/sync-question-keys.mjs:214,229`. It runs `validatePacks` before connecting (line 172), and validation now
  covers prefix and folder = slug for all four kinds, cuckoos included. `src/dev-seed/load-seed-inputs.ts:17` and
  `scripts/generate/{items,questions}.ts` load through `loadPackContent`/`loadPackQuestions`. The content pipeline
  mints ids as `${packSlug}.…` (`src/content-pipeline/render.ts:70`, `item-render.ts:60`), and no migration or RPC
  inserts into either table. The DB tests that insert rows (mf-0007-review :30, mf-0007-content-hash :17,
  mf-0032 :17-19) already use `${PACK}.…` ids. The sync's folder-derived `pack_slug` can no longer diverge from
  `pack.yaml`'s slug (scripts/lib/validate-packs.mjs:24-29), and the CHECK backs that up.
- [note] src/server/db/__tests__/mf-0017-expedition.db.acceptance.test.ts:30: the re-freeze changes one line and
  leaves every assertion's meaning intact. Ids stay under the same pack (`ccdv-f`), the teardown and PostgREST
  `like ${PREFIX}%` (lines 398-399 and 681) still match only this run's rows (no `_` or `%` in the prefix), and no
  SQL derives pack or skill from `question_id`. Neither the file nor `.planning/tasks/MF-0017/FROZEN.json` is in any
  LOOP-PLAN task's `owns`, but both are the re-freeze approved at the checkpoint and recorded in the FROZEN history.
- [note] src/engine/content/load-content.ts:5, src/engine/questions/load-questions.ts:4: these import
  `../pack/id-prefix` past the `src/engine/pack` barrel, which they do have to do. That matches the existing
  `../pack/types` imports in the same files, so no new pattern.
- [note] scripts/lib/validate-packs.mjs:28: the `continue` after a folder/slug mismatch skips content validation for
  that pack, so its content problems surface only after the rename. The sync still refuses the run, so this is fine.
