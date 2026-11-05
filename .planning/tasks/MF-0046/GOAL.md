---
ticket_id: MF-0046
tier: normal                      # a new gate script + CI step; touches guarded CI/hook config
stage: intake
branch:
builds_on: [MF-0005, MF-0019]
last_iteration: 0
goal_status: reserved             # owner: user (gate scripts, CI and hooks are guarded)
---

> Gate action from the MF-0019 retro (2026-11-05). Not built there.

## Objective

pnpm's placeholder `allowBuilds.esbuild: set this to true or false` was committed in merge `71ac090`.
Only `pnpm install --frozen-lockfile` fails on it, so every local gate stayed green while CI failed at Install
for 13 runs. End state: `scripts/check-workspace.mjs` (`pnpm check:workspace`) fails when `pnpm-workspace.yaml`
matches `/set this to true or false/i`, or when any `allowBuilds` value isn't literally `true` or `false`. It runs
in the Stop hook beside `check-hooks` and in the CI `checks` job before Install.

## Success Criteria (draft)

- SC-1: a fixture workspace file containing the placeholder → the check exits non-zero and names the package. Frozen RED test first.
- SC-2: the current `pnpm-workspace.yaml` → exit 0.
- SC-3: wired into the Stop hook and into `ci.yml` before `Install`. Proof: the hooks check plus a PR run.

## Open questions

- Editing the Stop hook and `ci.yml` is guarded, so the user approves.
