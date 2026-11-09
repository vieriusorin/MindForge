---
ticket: MF-0051
outcome: pass
causes: missing-context, tooling
actions: gate, memory-update
applied: 2026-11-09
lesson_keys: tracked-symlink-dangles-on-linux, junk-task-folder-name, windows-tooling-traps, proof-case-replay-before-freeze, review-fix-delta-reread, red-first-regression-test, reserved-ticket-premise-recheck
---
## Numbers
- FROZEN.json: 1 file frozen, 1 re-freeze (651738c9 to 459864b1), user-approved, reason review B-1 (statSync on a dangling symlink). Assertions unchanged.
- LOOP-VERIFY.md: RED at freeze 5/5 (SC-2 and SC-3 own reds). Proof-case replay found 18 real hits on today's tree. Final: SC-1..SC-3 pass; the only red in `pnpm test` is the baseline `mf-0065` SC-8 (Windows path separator).
- REVIEW.md: first review changes-requested with 1 blocking (B-1, symlink `.claude/skills/brag-slim` crashes the statSync walk on Linux CI). The delta review approved.
- GOAL.md Iteration Log: SC-4 (sharing a constant with `goal-proofs.mjs`) withdrawn by the user because it loosened another gate. One premise failure at pickup (MF-0045 already delivered by MF-0052).
- Before the ticket: the junk folder `.planning/tasks/[ELIFECYCLE] Command failed with exit code 1./` blocked `git pull` on Windows.

## Went right
- Proof-case replay before freeze: the drafted rule was run over today's tree and found the 18 real hits, so the SC-3 red was real. Review-fix parser changes each got a test shown RED first. — keep: already is (`proof-case-replay-before-freeze`, `red-first-regression-test` in earlier retros).
- MF-0045 was withdrawn at pickup after a premise recheck, which cost no build. — keep: already is (`reserved-ticket-premise-recheck`).
- A review that was sent to a fresh context caught a bug the Windows builder could not see (dangling symlink only fails on Linux). — keep: already is (diff-reviewer).

## Went wrong
- A tracked symlink that dangles on Linux was invisible to every test run on Windows. The new walk used `statSync` and would have crashed CI. Only the fresh-context review caught it. `check-hooks.mjs:32` still uses `statSync` in its own walk. Cause: missing-context (no written note that a Windows run cannot see Linux-dangling links).
- The MF-0059 merge committed a task folder with a Windows-invalid name (trailing dot), so `git pull` failed on Windows. `check-planning.mjs` lists `.planning/tasks/*` but does not check names. A static check would have blocked it. Cause: tooling.
- SC-4 (share a constant) loosened a gate and had to be withdrawn. One occurrence, see below.

## Actions (at most two)
1. gate: `scripts/check-planning.mjs` — where it lists `TASKS` directories (around line 78, before the `statSync` filter), add a check that every entry name matches `/^MF-\d{4}$/` (a non-directory entry such as a README is skipped). Report `FAIL .planning/tasks/<name>: task folder must be MF-####` and exit 1. It runs in `pnpm gate:planning`, which CI already runs. It would have caught `[ELIFECYCLE] Command failed with exit code 1.` before merge #107. Add a unit test with a fixture root holding a folder named `bad.` and expect a failure. Would have saved: the broken `git pull`, the plumbing commit, and the first-hour detour.
2. memory-update: `windows-dev-environment.md` — append this bullet: "Tracked symlinks: `.claude/skills/brag-slim` points at the untracked `.agents/`, so it dangles on Linux CI but Windows shows nothing wrong. Any directory walk in `scripts/**` or `src/test/**` must use `lstatSync` and skip `isSymbolicLink()` entries. `statSync` throws ENOENT on CI only. `scripts/check-hooks.mjs:32` still uses `statSync` and needs the same change when it is next touched (MF-0080). Test with `symlinkSync(missing, link)` in a temp dir (see `check-hooks-walk.test.ts`)." Would have saved: review B-1, one re-freeze and one user approval.

## Not worth changing
- SC-4 withdrawn (shared constant loosened another gate): it was one ticket, and the review plus the user caught it. The final note in `pnpm-refs.mjs:6-9` says the two sets are different facts.
- The baseline `mf-0065` SC-8 Windows path red: already known, tracked in the Iteration Log.
- Parser limits (flag before the script name, array-form `run("pnpm", [...])`, spans over two lines): accepted in GOAL Concerns and handed to MF-0080.
- Review note that `FENCE` accepts any indent: harmless today, no file in scope hits it.
- Token use: the ticket's real size (gate script, 4 agent texts, 3 test files); no repeated failing iteration.

## Applied

- 2026-11-09 memory-update: applied to `windows-dev-environment.md` (tracked symlinks dangle on Linux CI, use lstat; trailing-dot paths break git pull) and its MEMORY.md line. Corrected the retro text: the remaining statSync walk is check-hooks step 1 over `.claude/hooks`, not a pending MF-0080 item.
- 2026-11-09 gate: reserved as MF-0081 (#129), `.planning/tasks/MF-0081/GOAL.md`, `goal_status: reserved`. Not built.
- Held: none.
