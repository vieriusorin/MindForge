# MF-0023 LOOP-VERIFY (it-1)

No `ticket:verify` / `ticket:freeze` scripts: run by hand (gsd-goal-loop defaults). Windows 11, Node 24.14.1.

## Baseline (before any change, `main` @ e3f4993)

- `pnpm typecheck` 0 · `pnpm lint` 0 (565 files) · `pnpm test` 125 files / 554 tests · `main` CI `success`.
- `node scripts/check-hooks.mjs` → crash: `ENOENT … scandir 'C:\\C:\\Users\\…\\MindForge\\.claude\\hooks'`.

## RED at freeze

`src/test/__tests__/mf-0023-spawn-spec.acceptance.test.ts` (sha256 65c6a207…, LF): 12 × `Error: not implemented`
against the typed `spawnSpec` stub; typecheck 0 at freeze.

## SC verdicts

| SC | Verdict | Evidence |
|---|---|---|
| SC-1 | PASS | driver feeds `track-changes.mjs` (PostToolUse Write `src/engine/forest/group-heatmap.ts`) then `stop-gate.mjs`: `stop-gate exit=0 in 4s` · `stderr: (empty)` · `✓ Stop gate green: typecheck · 0 gates · biome (1 files) · 6 tests (co-located tier, 1 files) — 1 changed file(s)` |
| SC-2 | PASS | scratch `src/engine/expedition/mf0023-probe.ts` (`export const probe: number = "not a number"`), deleted after: `decision=block` · `TYPECHECK failed (1 error(s)):` · `src/engine/expedition/mf0023-probe.ts:1 TS2322 Type 'string' is not assignable to type 'number'.` No ENOENT. |
| SC-3 | PASS | acceptance file: `Test Files 1 passed (1)` · `Tests 12 passed (12)` |
| SC-4 | PASS (Windows) · CI pending | `imports: 13 relative imports checked` · 7 × `ok` · `commands: 7 hook commands run` · `check-hooks: PASS` · exit 0. Linux CI runs on the PR. |
| SC-5 | PASS | typecheck 0 · lint 0 (566 files) · `pnpm test` 126 files / 566 tests |

## Receipt

DONE for tree `git diff HEAD` sha256 83680c8fab7d22a4… (6 files). Frozen hash unchanged (65c6a207…).

## Not verified

- macOS/Linux spawn at runtime: proven by SC-3's spec test only; the CI `checks` job (Linux) running
  `check-hooks.mjs` (which drives `stop-gate.mjs` on its Stop sample) is the runtime proof, after push.
- The timeout path (`taskkill /t /f` on win32, `kill(-pid)` on POSIX) was not exercised; unchanged from 2c98a53.
