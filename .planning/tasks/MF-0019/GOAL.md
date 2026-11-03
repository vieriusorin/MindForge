---
ticket_id: MF-0019
tier: normal                      # GitHub settings + an observed run; no code
stage: intake
branch: main
builds_on: [MF-0005]
last_iteration: 0
goal_status: reserved             # owner: user (needs a push and repo-admin settings)
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

- [ ] SC-1: the first `CI` run on a PR to `main` is green for both jobs, `checks` and `db`. Proof: run URL in evidence.
- [ ] SC-2: a test PR touching `packs/**/questions/**` shows the key-sync warning annotation, and a PR without such a change shows none. Proof: run URLs.
- [ ] SC-3: branch protection on `main` requires the `checks` and `db` status checks (and up-to-date branches). Proof: the settings recorded in evidence (screenshot or `GET /repos/vieriusorin/MindForge/branches/main/protection`).
- [ ] SC-4 (MF-0005 C-1): the `db` job wall time is recorded. If it's over ~10 min, cache the Supabase Docker images in a follow-up ticket.

## Out of Scope

- Any change to the workflow itself: that's a new code ticket with its own tests.
