---
ticket_id: MF-0019
tier: normal                      # GitHub settings + an observed run; T0/T1 one-line CI fixes (user, 2026-11-05)
stage: handoff
branch: feat/MF-0019
builds_on: [MF-0005]
last_iteration: 1
goal_status: blocked-on-user      # push this branch, open the PR, set branch protection (runbook B-C)
track: P
week: W1
depends_on: [MF-0005]
---

> Split out of MF-0005 in DESIGN on 2026-11-03 (user decision): the proofs that need a push and
> GitHub admin rights, which an agent can't do here (no push, no `gh` CLI). Runbook: `docs/runbook/ci.md`.

## Objective

MF-0005 delivers the CI workflow and the grants gate, proven locally. This ticket proves them live
and makes them binding.

## Success Criteria

- [~] SC-1: the first `CI` run on a PR to `main` is green for both jobs, `checks` and `db`. Proof: run URL in evidence.
- [~] SC-2: a test PR touching `packs/**/questions/**` shows the key-sync warning annotation, and a PR without such a change shows none. Proof: run URLs.
- [ ] SC-3: branch protection on `main` requires the `checks` and `db` status checks (and up-to-date branches). Proof: the settings recorded in evidence (screenshot or `GET /repos/vieriusorin/MindForge/branches/main/protection`).
- [x] SC-4 (MF-0005 C-1): the `db` job wall time is recorded. If it's over ~10 min, cache the Supabase Docker images in a follow-up ticket.

## Out of Scope

- Any change to the workflow itself: that's a new code ticket with its own tests.

## Decided by the user (2026-11-05)

- CI has been red at **Install** on `main` since run #12 (2026-11-04 12:02). Cause: `pnpm-workspace.yaml`
  committed pnpm's placeholder `esbuild: set this to true or false` → `ERR_PNPM_IGNORED_BUILDS`.
  Fix it here as **T0** (`esbuild: false`), a separate hunk. This sits outside the "no workflow change" fence:
  it changes pnpm config, not `ci.yml`.
- `scripts/sync-question-keys.mjs` `readPackMeta` ignored `PACKS_DIR` → frozen MF-0016 SC-2 RED (ENOENT).
  Fix it here as **T1**. The MF-0013 storms fixture fragility (local-only, from `dev:seed`) goes to **MF-0045**.
- Proofs skip `pnpm db:reset`, because it wipes local data. `test:db` ran against the running local stack, and CI does the fresh reset.

## Iteration Log

- 1 (2026-11-05): read CI history from the public API. SC-1 was seen green on PR #6 (run 41657844124), and SC-4
  measured 2:10–2:28. Then 13 red runs, protection off. T0 + T1 applied, and checks are green locally. Left for the user:
  push and open the PR (re-proves SC-1 on the current tree), SC-2 positive case, SC-3 settings.
