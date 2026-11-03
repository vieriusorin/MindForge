---
ticket_id: MF-0005
tier: normal                      # CI config + a read-only DB test; no schema change
stage: design
branch: main
builds_on: []
last_iteration: 0
goal_status: reserved
track: P                          # seat Coder A
week: W1
depends_on: [Phase 0, MF-0018]   # MF-0018 (other session) pins the Supabase CLI as a devDependency
---

> Drafted 2026-11-03 from the planning grill. SCs are proposals; the claimant confirms and freezes them.

## Objective

Today nothing checks a PR except the author's own receipt, and with 5–6 coders working in parallel
that won't hold. The MF-0002 retro also asked for a guard: a new `public` table that forgets
`revoke all … from anon, authenticated` silently grants TRUNCATE, which bypasses RLS.

End state: every PR runs typecheck, lint, unit tests, DB tests on a local Supabase, the hooks check
and a build; a DB test fails when any `public` table grants more than its allow-list.

## Affected

- **Roles:** every coder.
- **Surfaces:** `.github/workflows/ci.yml` (new), `src/server/db/__tests__/grants.db.test.ts` (new), branch protection on `main`.

## Constraints

- CI uses only the local Supabase stack, never the hosted project.
- Pinned tool versions: pnpm from `packageManager`; Supabase CLI from the project devDependency added by MF-0018, called as `pnpm exec supabase` (no global install in CI).

## Decided without a question

- The grants gate is a DB test, not a lint, so it checks the real result of all migrations (MF-0002 retro, action 2).
- Changes to `packs/**/questions/**` only warn in CI (reminder to run `db:sync-keys` after merge); the sync itself is in the runbook (MF-0004).

## Success Criteria

- [ ] SC-1: On every PR to `main`: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `node scripts/check-hooks.mjs`, `pnpm build` run and must pass. Proof: a green run linked in evidence.
- [ ] SC-2: A DB job runs `supabase start`, `pnpm db:reset`, `pnpm test:db`. Proof: green run.
- [ ] SC-3: Grants gate: for every table in `public`, `anon` and `authenticated` hold no TRUNCATE/REFERENCES/TRIGGER, and INSERT/UPDATE/DELETE only where an allow-list in the test says so. Proof: the test is green on `main`, and red on a scratch migration that grants TRUNCATE (log in evidence, scratch reverted).
- [ ] SC-4: A PR touching `packs/**/questions/**` gets a CI annotation reminding the merger to run the key sync. Proof: test PR.
- [ ] SC-5: Branch protection on `main` requires SC-1 and SC-2 checks. Proof: settings recorded in evidence.

## Concerns

| # | Collision | Owner | Status |
|---|-----------|-------|--------|
| C-1 | DB job time with `supabase start` in CI; if it exceeds ~10 min, cache the Docker images. | Coder A | open |

## Out of Scope

- E2E (Playwright) in CI, deploy from CI.

## Open questions

- none.

## Iteration Log

<!-- append-only -->
