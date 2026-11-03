# MF-0005 LOOP-VERIFY

## RED at freeze (2026-11-03)

Both files formatted with Biome before hashing (`biome check --write`: no fixes applied). `pnpm typecheck` and
`pnpm lint` reported errors only in `src/features/groups/types.ts` (pre-existing on `main` at `ce500ea`, a
duplicate `FormActionResult` import). They didn't come from these files.

| File | SC | First failure |
|---|---|---|
| src/test/__tests__/mf-0005-ci.acceptance.test.ts | SC-1 ×3, SC-2, SC-4, SC-5, SC-6 ×2 | `Error: missing /…/.github/workflows/ci.yml` (8/8 red: the workflow doesn't exist) |
| src/server/db/__tests__/mf-0005-grants.db.acceptance.test.ts | SC-3 ×3 | **frozen green** (regression lock): `Tests 3 passed (3)` on 2 consecutive runs, read-only, so no fixtures. Red to be shown at TEST on scratch migrations |

## Baseline (before any code, 2026-11-03)

`pnpm test`: 9 failed / 84 passed. 8 = MF-0005 frozen (expected), **1 pre-existing**: `mf-0004-rotate-invite` SC-9,
`ReferenceError: rotateInviteRpcError is not defined` (`src/features/groups/actions.ts:83`). `pnpm typecheck` / `pnpm lint`
red on `src/features/groups/types.ts` (duplicate `FormActionResult` import). Both come from merge `bc61088`, which
reverted part of MF-0004 in those two files (diff vs `c2f2bd5`). `pnpm test:db`: 17/17 green. Logs: `logs/baseline-*.log`.

Fix (outside the ticket's SCs, needed for CI's first green): both files restored to their `c2f2bd5` content with
targeted edits (`git diff c2f2bd5 -- src/features/groups/` is empty afterwards). Regression proof: the frozen
MF-0004 test that was red above is green now (`src/features/groups`: 8/8).

## Iteration 1, local (stage: test)

| Check | Result | Log |
|---|---|---|
| frozen `mf-0005-ci` | `Tests 8 passed (8)`. The 1st run failed SC-6 on the workflow comment "no secrets." (the banned substring `secrets.`); the comment was reworded, the test unchanged | logs/ci-acceptance.log |
| `actionlint` 1.7.7 (Docker, with shellcheck) | exit 0, no findings | logs/actionlint.log |
| frozen `mf-0005-grants.db` | green; red on scratch 1 (`grant truncate on public.groups to authenticated`) and scratch 2 (table without `revoke all` → 8 lines `anon/authenticated MAINTAIN/REFERENCES/TRIGGER/TRUNCATE`); green after each revert | logs/sc3-red.log |
| SC-4 step, simulated (scratch git repo) | src-only diff: no output; `packs/ccdv-f/questions/q1.yaml` diff: `::warning title=Answer keys::… 'pnpm db:sync-keys' …` | logs/sc4-reminder-sim.log |
| `pnpm typecheck` · `pnpm lint` · `pnpm test` · `check-hooks` · `pnpm build` (CI env) · `pnpm test:db` | all exit 0; lint `Checked 199 files … No fixes applied.`; test `28 files / 93 passed`; db `6 files / 17 passed`; `check-hooks: PASS`; build `✓ Compiled successfully` | logs/{typecheck,lint,test,check-hooks,build,test-db}.log |
| **clean checkout** (fresh worktree at HEAD + this diff, no `.env.local`, no `node_modules`): `pnpm install --frozen-lockfile` → typecheck → lint → test → check-hooks → build | exit 0; `Lockfile is up to date`; `pnpm v12.3.4`; `93 passed`; `check-hooks: PASS`; `✓ Compiled successfully`; pinned CLI installed `2.122.0` | logs/clean-checkout.log |

| SC | Verdict | Evidence |
|---|---|---|
| SC-1 | PASS (local) | frozen test + actionlint + clean-checkout run. Live run → MF-0019 |
| SC-2 | PASS (local, partial) | frozen test; `pnpm test:db` 17/17 on the running stack. **Not run:** cold `supabase start -x …` and `pnpm db:reset`, to keep the shared local data (user didn't approve a reset). The first CI run proves these (MF-0019 SC-1) |
| SC-3 | PASS | green on current migrations, red on both scratches, reverted |
| SC-4 | PASS (local) | frozen test + simulation. Live PR → MF-0019 SC-2 |
| SC-5 | PASS | frozen test (job ids `checks`, `db` = runbook names) |
| SC-6 | PASS | frozen test |

## Receipt

- No `ticket:verify` script exists (same as MF-0004), so this is the default receipt: the checks above for this tree.
- `git diff HEAD | shasum -a 256` (tracked): `14ed5d0aafbb18112abf6b98c9a149d8fcf8778a0e924d136d528fce8b1ded50`
- untracked product files: `ci.yml 29771fc4…`, `docs/runbook/ci.md cd598813…`, frozen files unchanged (`b3a78456…`, `7f549f81…` = FROZEN.json).
- **Verdict: DONE for the local slice of this tree.** SC-2's cold start + reset and all live proofs are in MF-0019.
