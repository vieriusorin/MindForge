# CI runbook (MF-0005)

`.github/workflows/ci.yml` runs on every pull request to `main` and on every push to `main`. It
needs no secrets and never touches the hosted project. The repo admin does sections B to D once,
tracked as MF-0019.

## A. What runs

| Job (= required check name) | Steps | Typical cause of a red |
|---|---|---|
| `checks` | `pnpm install --frozen-lockfile` → `pnpm typecheck` → `pnpm lint` → `pnpm test` → `node scripts/check-hooks.mjs` → `pnpm gate:planning` → `pnpm build`, then (PRs only) the answer-key reminder | lockfile out of date, missing `<Suspense>` (build), a hook that fails to load, two tickets in one GOAL.md (planning check) |
| `db` | `pnpm install --frozen-lockfile` → `pnpm exec supabase start -x …` (pinned CLI, unused services excluded) → `pnpm db:reset` → `pnpm test:db` | an RLS test, or **the grants gate** |

**The grants gate** (`src/server/db/__tests__/mf-0005-grants.db.acceptance.test.ts`) fails whenever the
privileges `anon`, `authenticated` or `PUBLIC` hold in `public` / `private` differ from its
allow-list. A new table that skipped `revoke all … from anon, authenticated` shows up as
`TRUNCATE` / `REFERENCES` / `TRIGGER` / `MAINTAIN` lines (Supabase's default privileges). To fix
it, add the `revoke all` to the migration. When a grant is intended, add its line to the
allow-list in the same PR. That test file is frozen, so the reviewer sees the contract change.

**The planning check** (`pnpm gate:planning`, MF-0028) fails when a `.planning/tasks/<ID>/GOAL.md` has more
than one `ticket_id:` line, none, or one that is not its folder name. It usually means two branches reserved
the same ticket number and the merge concatenated them: renumber one ticket into a free folder (check every
branch with `git grep`) and split the file. The Stop gate runs it too, like every `gate:*` script.

**Answer-key reminder:** when a PR changes `packs/**/questions/**`, the `checks` job prints a
warning annotation. After merge, run the key sync for each environment (`docs/runbook/deploy.md`, B3).

## B. First run (MF-0019 SC-1)

1. Push the branch and open a PR to `main`.
2. In the PR's **Checks** tab, confirm that `CI / checks` and `CI / db` are both green. Paste the run URL into
   `.planning/evidence/MF-0019.md`, with the `db` job's wall time.

## C. Branch protection on `main` (MF-0019 SC-3)

The check names exist only after one run (B), so do B first.

1. GitHub → repo **Settings → Branches → Add branch ruleset** (or *Add classic branch protection
   rule*), target branch `main`.
2. Enable **Require a pull request before merging**.
3. Enable **Require status checks to pass**, tick **Require branches to be up to date before
   merging**, and add exactly these checks: `checks` and `db`.
4. Enable **Block force pushes**. Save.
5. Record the settings in evidence: a screenshot, or
   `curl -s -H "Authorization: Bearer <token>" https://api.github.com/repos/vieriusorin/MindForge/branches/main/protection`
   (with a token from your password manager, never pasted into the repo).

Renaming a job in `ci.yml` renames its check: update the rule in the same PR, or every PR blocks
on a check that never reports.

## D. A slow `db` job (MF-0005 C-1)

`supabase start` pulls about 1–2 GB of images on a cold runner. If the `db` job regularly takes more
than ~10 minutes, open a ticket to cache the images (e.g. `docker save` keyed on the CLI version in
`package.json`). Don't drop the job and don't make it optional.

## E. Running the same checks locally

```sh
pnpm install --frozen-lockfile && pnpm typecheck && pnpm lint && pnpm test \
  && node scripts/check-hooks.mjs && pnpm gate:planning && pnpm build
pnpm exec supabase start && pnpm db:reset && pnpm test:db   # db:reset wipes LOCAL data
```
