---
ticket_id: MF-0018
tier: normal                      # tooling + docs; no schema, auth or app logic
stage: handoff
branch: feat/MF-0001
builds_on: [MF-0003]
last_iteration: 1
goal_status: complete-pending-manual-commit
---

## Objective

Today a contributor who runs `pnpm install` gets the app's dependencies but not the local stack:
the Supabase CLI must be installed globally by hand, nothing says Docker is required, and
`.env.local`, the schema and the answer keys need manual steps from the README. Contributors end up
with different CLI versions, or with an app that boots but can't sign in or grade answers.

End state: the only separate installs are **Node 24** and **Docker**. `pnpm install` brings a
pinned Supabase CLI, and **`pnpm dev:setup`** produces the same local functionality the maintainer has:
the Supabase stack (Postgres, Auth, Studio, Mailpit) running, all migrations applied, answer keys
synced and `.env.local` filled in. It's safe to re-run and never wipes data.

## Affected

- **Roles:** every contributor (and MF-0005 CI, which can reuse the pinned CLI).
- **Surfaces:** `package.json` (devDependency, scripts, engines), `pnpm-workspace.yaml` (allow the CLI postinstall), `scripts/dev-setup.mjs` (new), `scripts/lib/env-file.mjs` (new), `scripts/lib/supabase-bin.mjs` (new), `scripts/sync-question-keys.mjs`, `src/test/local-stack.ts`, `README.md`.

## Constraints

- Local only: setup never touches a hosted project (memory `feedback-local-first`) → it uses `--local` commands and the local DB URL only.
- Non-destructive: `pnpm dev:setup` applies **pending** migrations (`supabase migration up --local`), never `db reset` → SC-3.
- `.env.local` may hold the contributor's own values → setup only adds or updates the two Supabase keys and keeps every other line → SC-2.
- Only the publishable key goes into `.env.local`, never the secret key (MF-0002 constraint).
- Pinned versions; pnpm release-age policy → `supabase@2.122.0` (2026-10-23), not 2.122.1 (1 day old).

## Decided without a question

- User asked for it: "let's make those to have the same functionality locally" (2026-11-03).
- The ID MF-0004 was already reserved by the planning session (hosting) → this is MF-0018. Overlap with MF-0005 (CI pins the CLI) was messaged to that session.
- Docker stays a manual prerequisite (Docker Desktop / OrbStack / Colima); the setup script checks for it and explains.
- The dev server stays on Next's default port 3000. Redirect URLs already allow 3000 and 3001.

## Success Criteria

- [x] SC-1: After `pnpm install`, `pnpm exec supabase --version` prints `2.122.0` from `node_modules/.bin`, and the package scripts (`db:reset`, `db:types`, `db:sync-keys`, `dev:setup`) plus `src/test/local-stack.ts` and `scripts/sync-question-keys.mjs` run with **no global `supabase` on PATH**. Proof: run with a PATH that excludes Homebrew; log pasted.
- [x] SC-2: `mergeEnv(existingText, values)` adds missing keys, replaces existing values for those keys, and keeps every other line (comments, blanks, other keys) in order; an empty input yields exactly the given keys. Proof: acceptance `src/test/__tests__/mf-0018-env-file.acceptance.test.ts` (vitest collects only `src/**`).
- [x] SC-3: `pnpm dev:setup` on the maintainer's running stack is idempotent and non-destructive: exit 0 twice in a row; the `attempts`/`groups` row counts are unchanged; `.env.local` holds the two `NEXT_PUBLIC_SUPABASE_*` values and no secret. Proof: command log + before/after counts.
- [x] SC-4: With Docker unavailable, `pnpm dev:setup` exits non-zero with a message naming Docker and how to start it, before doing anything else. Proof: run with Docker absent from PATH; output pasted.
- [x] SC-5: README has "Prerequisites" (Node 24, Docker) and "Quick start" (`corepack enable`, `pnpm install`, `pnpm dev:setup`, `pnpm dev`) at the top, and `package.json` has `engines.node >= 24`. Proof: file.
- [x] SC-6: typecheck, lint, unit, db, build, check-hooks green; evidence file. Proof: receipt.

## Concerns

| # | Collision | Owner | Status |
|---|-----------|-------|--------|
| C-1 | MF-0005 (CI, reserved by the planning session) also pins the CLI. | agent | messaged; MF-0018 provides the pin, MF-0005 consumes it |

## Out of Scope

- Installing Docker for the contributor; Windows-specific scripts (WSL works like Linux); CI (MF-0005); hosted setup (MF-0004).

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

**Result:** PASS: SC-1..SC-6. The command was renamed `pnpm dev:setup` (`pnpm setup` is a pnpm built-in).
**Suggested commit message:** `MF-0018 chore: one-command local setup (pnpm dev:setup) with pinned Supabase CLI`
