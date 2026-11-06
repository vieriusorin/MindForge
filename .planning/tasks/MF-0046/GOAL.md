---
ticket_id: MF-0046
title: "check:workspace guard for pnpm allowBuilds placeholder"
tier: high-risk                   # a new gate script + CI step + Stop-hook trigger (MF-0055: gates and hooks are high-risk)
stage: handoff
branch: feat/MF-0046
builds_on: [MF-0005, MF-0019]
last_iteration: 0
goal_status: complete-pending-manual-commit
---

> Gate action from the MF-0019 retro (2026-11-05). Picked up 2026-11-06.

## Objective

**Today.** pnpm writes a placeholder, `allowBuilds.esbuild: set this to true or false`, and one was committed in merge
`71ac090` ("MF-0012: merge main"). Only `pnpm install --frozen-lockfile` (what CI runs) fails on it
(`ERR_PNPM_IGNORED_BUILDS`). Every local gate stayed green while CI failed at `Install` for 13 runs, and 6 PRs merged
on red.

**End state.** A static check fails when `pnpm-workspace.yaml` contains `/set this to true or false/i`, or when any
`allowBuilds` value is not literally `true` or `false`. It runs:
- in CI's `checks` job **before** `Install`;
- in the Stop hook whenever `pnpm-workspace.yaml` changed.

## Facts (re-derived at pickup, 2026-11-06)

- F-1: `git show 71ac090:pnpm-workspace.yaml` line 5 reads `  esbuild: set this to true or false`. It is the proof
  case, and `git log -S` finds no other commit that adds it.
- F-2: the retro says "call it from the Stop hook beside `check-hooks`", but `check-hooks` is **not** run by the Stop
  hook (`.claude/hooks/stop-gate.mjs`). The Stop gate does run every `gate:*` script in `package.json` (line ~156),
  except `gate:client-bundle`.
- F-3: the Stop gate runs gates only when this session changed a *source* file (`isRelevantSource` in
  `.claude/hooks/lib/gate-core.mjs`: `.ts … .json .sql .css`). A `.yaml` file is not source, so an edit that touches
  only `pnpm-workspace.yaml` would not trigger the check.
- F-4: before `Install`, CI has node and pnpm but no `node_modules`, so the check may use node built-ins only (not
  the `yaml` package).
- F-5: `main` CI is red (run 42213004161, `cc79c34` "feat: MF-0058 (#95)", step "Unit + UI tests"). Local repro:
  `pnpm test` gives 2 failed, both from `gate:planning`: "MF-0059: tier, stage, goal_status repeated at column 0".
  The MF-0058 merge concatenated the MF-0044 retrofit reservation (first numbered MF-0059) into Sorin's MF-0059
  GOAL.md. Issue #96 already names the retrofit MF-0061.

## Success Criteria

- [x] SC-1: a fixture workspace whose `allowBuilds` has `esbuild: set this to true or false` → `gate:workspace` exits
  1, and stderr names `esbuild` and the file. Proof: frozen acceptance test (`MF_WORKSPACE_FILE` fixture).
- [x] SC-2: fails closed. Each of these exits 1, naming the entry or line:
  - a value that is not literally `true` or `false`: `yes`, `"true"`, or empty;
  - flow style: `allowBuilds: { esbuild: true }`;
  - an `allowBuilds` line the parser cannot read;
  - the placeholder text anywhere else in the file.

  A valid file with comments, quoted scoped names (`'@scope/pkg': true`) and other top-level keys exits 0. A missing
  file exits 1. Proof: frozen acceptance test.
- [x] SC-3: proof-case replay. `git show 71ac090:pnpm-workspace.yaml` → exit 1, and the repo's current
  `pnpm-workspace.yaml` → exit 0, with a stdout summary `gate:workspace: N allowBuilds entries, ok`. Proof: frozen
  acceptance test.
- [x] SC-4: CI. `.github/workflows/ci.yml` `checks` runs `node scripts/check-workspace.mjs` as a step before
  `Install`. Proof: the diff, plus the PR run showing the step green before Install (pending a push, owned by the
  user).
- [x] SC-5: Stop hook. `isRelevantSource("pnpm-workspace.yaml")` is true, so a session that edits only that file runs
  the gates, including this one. `node scripts/check-hooks.mjs` still passes. Proof: a unit test of
  `isRelevantSource`, plus check-hooks.
- [x] SC-6 (T0, separate hunk): `pnpm gate:planning` exits 0 again. MF-0059 GOAL.md holds one ticket, and the
  retrofit lives at `.planning/tasks/MF-0061/GOAL.md` (issue #96). Proof: `pnpm gate:planning`, plus the 2 frozen
  tests that were red on `main` (`mf-0028` SC-4, `mf-0053` SC-5) turning green.

## Constraints → how met

- Runs before Install → `scripts/check-workspace.mjs` imports only `node:` modules. A small line parser reads the
  `allowBuilds:` block, and any shape it cannot read is a problem (verification.md §4: fail closed).
- Gate scripts, CI and hooks are guarded → the user approves at this checkpoint, and each guarded edit asks again.
- Never commit → hand-off only.

## Decided without a question

- Line parser, not the `yaml` package (F-4).
- The checked file is `pnpm-workspace.yaml` at the repo root. `MF_WORKSPACE_FILE` overrides it for tests, the same
  way `MF_PACKS_DIR` works for check:packs.
- T0 (F-5) is my own collision (the MF-0044 retrofit reservation). It is fixed as a separate hunk by splitting the
  file back out under the number the issue already holds. The retrofit's content is unchanged, apart from a
  renumber note and the `key-length.mjs` comment pointer.

## Concerns

| # | Concern | Owner | Status |
|---|---|---|---|
| C-1 | Script name. `gate:workspace` gets picked up by the Stop gate with no hook edit (F-2). The draft's `check:workspace` would need a `stop-gate.mjs` edit. | user | resolved 2026-11-06 (user): `gate:workspace` |
| C-2 | Trigger (F-3). Add `pnpm-workspace.yaml` to `isRelevantSource` (one-line hook-lib edit plus a test), or accept CI as the only binding for a yaml-only change. | user | resolved 2026-11-06 (user): add it |
| C-3 | `ci.yml` step before Install: a guarded edit. | user | resolved 2026-11-06 (user): plan approved |

## Iteration Log

- 2026-11-06 · intake→design · claimed locally; `ticket:github --claim` failed: gh token lacks `read:project`.
  design preflight: `pnpm test` exit 1 (2 failed: mf-0028 SC-4, mf-0053 SC-5, both `gate:planning` on MF-0059,
  see F-5, so T0); `pnpm gate:planning` exit 1 → after T0 split exit 0 (60 folders); `pnpm typecheck` exit 0; `pnpm lint` exit 0;
  `node scripts/check-hooks.mjs` PASS; `pnpm gate:workspace` not run: does not exist yet (SC-1..3 create it).
  main CI: failure (run 42213004161, Unit + UI tests).
  proof-case replay: RED (71ac090 line 5 matches the placeholder pattern by grep; the drafted rule fails it).
- 2026-11-06 · design→plan · checkpoint: user resolved C-1 (`gate:workspace`), C-2 (add to isRelevantSource), C-3
  and approved the plan (high-risk). No proof command wipes shared state.
- 2026-11-06 · plan→build→test · baseline: only the frozen file red. Built check-workspace.mjs, gate:workspace,
  ci.yml step, isRelevantSource. Review round 1 changes-requested (3 blocking fail-open), round 2 (4 blocking), round 3
  (1 blocking class): each fixed with RED-first tests in check-workspace.test.ts; round 3 led to an allowlist parser.
  Round 4 approve (reviewed_hash ea4e6383…). Receipt: typecheck 0, lint 0, gate:planning + gate:workspace PASS,
  check-hooks PASS, pnpm test 177 files / 945 tests passed. Frozen sha unchanged (36f70636…).
- 2026-11-06 · test→handoff · SC-4 live CI run pending the developer's push.
