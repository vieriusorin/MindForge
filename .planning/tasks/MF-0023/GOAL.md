---
ticket_id: MF-0023
tier: normal                      # dev tooling: Claude Code hooks + the hook checker; no app code
stage: handoff
branch: feat/MF-0023
builds_on: [MF-0001, MF-0013]
last_iteration: 1
goal_status: complete-pending-manual-commit
track: P
week: W2
depends_on: []
---

> Reserved by the MF-0008 retro (2026-11-04, lesson `stop-hook-windows-spawn`). Claimed 2026-11-05 on
> `feat/MF-0023` from `main` @ e3f4993. The minimal fix already landed as commit 2c98a53 (approved by the
> user during MF-0017 and merged with PR #20). This ticket records it, moves the per-platform spawn
> decision to `gate-core.mjs` where a test can reach it, adds the missing proofs, and fixes
> `scripts/check-hooks.mjs`, which still crashes on Windows.
> Baseline 2026-11-05: `pnpm typecheck` 0, `pnpm lint` 0 (565 files), `pnpm test` 125 files / 554 tests;
> `main` CI `success` on e3f4993.

## Objective

Before 2026-11-05, `.claude/hooks/stop-gate.mjs` failed on Windows before checking anything (`spawn pnpm
ENOENT` and the same for biome and vitest), so every turn showed a red gate that hid real failures. The
fix (shell on win32, quoted args, taskkill for the tree) is on `main` but untested: the spawn decision is
inline in `run()`, so nothing guards macOS/Linux from a later Windows edit. Separately,
`node scripts/check-hooks.mjs` (MF-0001 SC-8, run by CI) crashes on Windows: its root is
`new URL(import.meta.url).pathname` = `/C:/…`, which `resolve` turns into `C:\C:\…` (`scandir` ENOENT).

End state: the spawn spec is a pure, tested function per platform; the Stop gate reports real
typecheck/lint/test results on Windows; `check-hooks.mjs` passes on Windows and still passes in CI.

## Affected

- **Roles:** developers running Claude Code on this repo (Windows and macOS/Linux). No app users.
- **Surfaces:** `.claude/hooks/lib/gate-core.mjs` (new pure `spawnSpec`), `.claude/hooks/stop-gate.mjs`
  (`run()` uses it), `scripts/check-hooks.mjs` (root via `fileURLToPath`), a test under
  `src/test/__tests__/`.

## Constraints

- Hooks and `scripts/check-*.mjs` are guarded (`PROTECTED` in `gate-core.mjs`): the user approves the edit.
- macOS/Linux behaviour of the Stop gate unchanged: direct spawn, own process group, `kill(-pid)` on timeout.
- No new dependency; hook files stay plain `.mjs` with no build step.

## Constraints → how met

- Guarded → approval asked at this checkpoint (one approval for the three guarded files); the guard hook
  will still prompt per edit.
- Unchanged on POSIX → SC-3 pins the linux/darwin spec literally (`shell: false`, `detached: true`, args
  passed as an array, unquoted); CI (Linux) runs `check-hooks.mjs`, whose Stop sample drives `stop-gate.mjs`.
- No dependency → `node:url` `fileURLToPath` (built in).

## Decided without a question

- Shell spawn vs explicit `.cmd` resolution (the draft's open question): shell spawn, as already merged in
  2c98a53 with the user's approval during MF-0017. `supabase-bin.mjs` resolves one known binary; the gate
  spawns pnpm, biome, vitest, eslint and arbitrary `gate:*` commands, so a shell is the general answer.
- The test lives in `src/test/__tests__/` because vitest only collects `src/**/__tests__/**`; precedent
  `src/test/__tests__/gate-io-to-rel.test.ts` (MF-0013). The draft's "scripts/__tests__" path does not exist.
- SC-1/SC-2 proofs are hook run logs produced by driving `track-changes.mjs` then `stop-gate.mjs` with one
  synthetic `session_id` on stdin (the same contract Claude Code uses). SC-2's type error goes in a scratch
  file under `src/` that is deleted after the run.
- No proof command wipes shared local state (no DB involved).

## Success Criteria (frozen 2026-11-05)

- [x] SC-1: On Windows, with one changed `.ts` file and a clean tree, the Stop gate exits 0 and prints a
  green banner naming typecheck, biome and tests; no `ENOENT`. Proof: hook run log in LOOP-VERIFY.
- [x] SC-2: With a deliberate type error in a changed file, the gate's output is a TYPECHECK block naming
  that file and line, not a spawn failure. Proof: hook run log in LOOP-VERIFY.
- [x] SC-3: `spawnSpec` (gate-core) returns, for linux and darwin, `{ command: cmd, args, shell: false,
  detached: true }`; for win32, `{ command: <one quoted command line>, args: [], shell: true, detached:
  false }`, quoting an argument that has a space, `(`, `)`, `&`, `|`, `<`, `>`, `^` or `"`, and leaving a
  plain one bare. Proof: acceptance test `src/test/__tests__/mf-0023-spawn-spec.acceptance.test.ts`.
- [x] SC-4: `node scripts/check-hooks.mjs` prints `check-hooks: PASS` and exits 0 on Windows. Proof: run log;
  CI `checks` job on the PR (Linux) still green.
- [x] SC-5: `pnpm typecheck`, `pnpm lint`, `pnpm test` exit 0. Proof: receipt.

## Concerns

| # | Collision | Owner | Status |
|---|-----------|-------|--------|
| C-1 | `check-hooks.mjs` was not in the draft. It is the same bug family (a Windows path in a hook tool), a one-line fix, and the memory flags it as broken. | user | resolved 2026-11-05: include it (SC-4) |

## Out of Scope

- The agent-scope hook rejecting a subagent Write to `REVIEW.md` on Windows (memory note): separate ticket if it recurs.
- `pnpm db:reset`'s `SUPABASE_DB_URL= node …` failing under cmd.

## Decided by the user

- 2026-11-05 (during MF-0017): minimal stop-gate fix approved and committed (2c98a53).
- 2026-11-05: SCs approved and frozen; C-1 → include `check-hooks.mjs`; edits to the three guarded files
  (`gate-core.mjs`, `stop-gate.mjs`, `check-hooks.mjs`) approved.

## Open questions

- none.

## Iteration Log

<!-- append-only -->
- 2026-11-05 it-1: claimed on `feat/MF-0023`; DESIGN drafted; baseline green; probe: `check-hooks.mjs` with
  a `fileURLToPath` root passes all 7 hook commands on Windows.
- 2026-11-05 it-1: acceptance frozen red (12 × not implemented); BUILD spawnSpec + stop-gate + check-hooks; SC-1..SC-5
  PASS on Windows (LOOP-VERIFY); receipt DONE for tree 83680c8f…; Linux runtime left to PR CI. Hand-off.
