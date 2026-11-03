# MF-0005 LOOP-PLAN (iteration 1)

## Discovery

- No `.github/` exists. Repo `vieriusorin/MindForge` is public, default `main`.
- `package.json`: `packageManager: pnpm@12.3.4`, `engines.node >=24`, devDependency `supabase@2.122.0`
  (postinstall allowed in `pnpm-workspace.yaml`). `db:reset` = `supabase db reset && node scripts/sync-question-keys.mjs`.
- `pnpm build` needs `NEXT_PUBLIC_SUPABASE_URL` / `_PUBLISHABLE_KEY` (`src/server/supabase/env.ts` throws).
  `SITE_URL` is optional outside production runtime (MF-0004 built with it unset).
- `node scripts/check-hooks.mjs` runs with node only: `check-hooks: PASS` locally.
- DB tests use db + auth + rest + kong only (`src/test/local-stack.ts`, `supabase status -o json`).
- Local `pg_default_acl` (postgres, public, r): `anon=Dxtm, authenticated=Dxtm`. That's the trap the gate exists for.
- Pre-existing break on `main` (`ce500ea`): `src/features/groups/types.ts` imports `FormActionResult` twice, so
  typecheck and lint fail. Fixed here as a separate one-line hunk (the user said continue without
  answering; flagged in the hand-off).
- Action SHAs (GitHub API, 2026-11-03): checkout v7.0.1 `3d3c42e5…`, setup-node v7.1.0 `949feb24…`, pnpm/action-setup v6.1.0 `ea17c68d…` (v6.1.1 `73e46992…` skipped: published 2026-11-03, too new).

## SC → steps

| SC | Step |
|---|---|
| SC-1, SC-2, SC-4, SC-6 | T1 `.github/workflows/ci.yml` |
| SC-5 | T2 `docs/runbook/ci.md` |
| SC-3 | T0 grants test (already frozen green); red proof at TEST |
| — | T3 types.ts duplicate import (pre-existing; unblocks SC-1 locally) |

## Riskiest step

The `db` job on a clean runner: `supabase start` image pulls (time, C-1 → MF-0019) and `db:reset` running the
key sync without `.env.local`. `sync-question-keys.mjs` resolves the DB URL from `supabase status` when
`SUPABASE_DB_URL` is empty, so it works in CI (verified locally by the MF-0018 setup).

## Rejected options

- `dorny/paths-filter` for SC-4: a third-party action for a single `git diff`. A shell step does it.
- `supabase/setup-cli` action: a global install, which goes against the pinned-devDependency constraint.
- One job: the DB job is slow and independent. Two jobs run in parallel and give two clear required checks.
- Caching Docker images now: not measured yet (C-1 → MF-0019).

```json tasks
[
  {"id": "T1", "agent": "inline", "owns": [".github/workflows/ci.yml"], "depends_on": [], "closes": ["SC-1", "SC-2", "SC-4", "SC-6"], "done_when": "mf-0005-ci acceptance green; actionlint clean", "context": "SHAs above; placeholder NEXT_PUBLIC env for build"},
  {"id": "T2", "agent": "inline", "owns": ["docs/runbook/ci.md"], "depends_on": ["T1"], "closes": ["SC-5"], "done_when": "SC-5 test green", "context": "branch protection steps for MF-0019"},
  {"id": "T3", "agent": "inline", "owns": ["src/features/groups/types.ts"], "depends_on": [], "closes": [], "done_when": "pnpm typecheck && pnpm lint exit 0", "context": "pre-existing break"},
  {"id": "T4", "agent": "inline", "owns": [".planning/**"], "depends_on": ["T1", "T2", "T3"], "closes": ["SC-3"], "done_when": "local run of every job command logged; scratch-grant red logged and reverted", "context": "no db:reset (shared local data)"}
]
```
