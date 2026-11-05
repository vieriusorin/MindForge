---
ticket: MF-0019
outcome: parked
causes: tooling, missing-context, scope
actions: gate, skill-edit
lesson_keys: ci-red-unobserved, placeholder-config-committed, hosted-scs-split-from-code
applied: 2026-11-05
---
## Numbers
No `ticket:retro` script exists; facts read by hand from GOAL.md, LOOP-VERIFY.md, evidence and `git diff HEAD`.
- Iterations: 1 (`last_iteration: 1`). `goal_status: blocked-on-user`, stage `handoff`. No REVIEW.md. No token metrics, so no median comparison.
- Freeze: none by design (no-code, user-owned ticket). RED came from two existing signals reproduced locally: `pnpm install --frozen-lockfile` -> `ERR_PNPM_IGNORED_BUILDS`, and frozen MF-0016 SC-2 -> 3 failed (ENOENT).
- Receipt (diff sha `f5fb1913...`): install, typecheck, lint, `pnpm test` 119 files / 522 tests, `check-hooks`, `pnpm build` all exit 0. `pnpm test:db` 64 passed / 7 failed, all 7 in `mf-0013-storms` (local `dev:seed` data, spun out as MF-0045).
- SCs: SC-4 ticked (db 2:10-2:28 over 4 runs, under 10 min). SC-1 met once on PR #6, re-proof pending. SC-2 negative half only. SC-3 open (`protected: false`).
- CI history: runs #12-#24 (13 runs, 2026-11-04 12:02 to 2026-11-05 08:29) all failed at `Install` in both jobs. 6 PRs merged on red (MF-0008, 0012, 0014, 0015, 0013, 0016), because `main` has no branch protection.

## Went right
- Both defects were reproduced RED locally before being fixed, with the exact CI error (`ERR_PNPM_IGNORED_BUILDS`; MF-0016 ENOENT), and each fix was a one-line, separate hunk (T0/T1) listed for the hand-off. A scratch-copy probe proved `esbuild: false` is safe (`tsx -e` still runs) without touching the working tree. Keep: already is, SKILL.md Stage 2 preflight (1) "fix it as task T0 (listed in the hand-off as a separate hunk)" (from the MF-0005 retro).
- CI history, job timings and protection state were read from the public GitHub REST API with no `gh` and no push, which turned "wait for the user" into 13 observed facts plus SC-4 met. Keep: already is, `.planning/evidence/MF-0019.md` (the URLs). Folded into the Action 2 text below so the next session reuses it.
- The hosted-proof split (MF-0004/0005 retros) worked as designed for MF-0005: it closed with local proof. See the wrong-side cost below.
- The spin-out of the local-only MF-0013 storms failure to MF-0045, rather than a quiet fix, kept this diff to two hunks. Keep: already is, escalation.md "pre-existing failure" bullet.

## Went wrong
- CI was red at `Install` for 13 consecutive runs and 6 PRs merged on it. Nothing in the process reads CI state: `main` has no protection, the Stop-hook gate is local, and the hand-off lists "developer commits, pushes" without a CI conclusion. The red was found only when MF-0019 finally read the API. cause: tooling (no binding check) and missing-context (no stage reads CI conclusion).
- pnpm's placeholder `esbuild: set this to true or false` was committed inside merge `71ac090` ("MF-0012: merge main"). A merge-conflict-time edit has no ticket and no gate. Locally, a non-frozen `pnpm install` does not fail the same way, so every builder's local gate was green; only `--frozen-lockfile` (what CI runs) fails. Static pattern, so a gate could have blocked it: `pnpm-workspace.yaml` containing `set this to true or false` (this exact file, commit `71ac090`). cause: tooling.
- The `readPackMeta` bug (`join(ROOT, ...)` ignoring `PACKS_DIR`) made frozen MF-0016 SC-2 RED, and survived because an earlier duplicate-function SyntaxError hid it, and then CI never got past Install. Each upstream red masked the next. Not a separate rule: same root as the first bullet. cause: tooling.
- MF-0019 sat `reserved` for the user for about two days (2026-11-03 to 11-05) while the proofs it owned (live CI, protection) were exactly what would have caught the above. The split is right, since an agent cannot push, but the split had no owner or date for the first live run, so "deferred" became "unobserved". cause: scope.

## Actions (at most two)
1. gate: draft a new ticket (claim the next free MF number; `GOAL.md` with `goal_status: reserved`, owner agent, tier T1). Build a static check `scripts/check-workspace.mjs` (add `"check:workspace"` to `package.json`, and call it from the Stop hook beside `check-hooks` and from the `checks` job, before Install). It fails when `pnpm-workspace.yaml` contains a value matching `/set this to true or false/i` (pnpm's `allowBuilds` placeholder) or any `allowBuilds` entry whose value is not literally `true` or `false`. One real file it would have caught: `pnpm-workspace.yaml` at merge `71ac090` (`esbuild: set this to true or false`). The ticket's SC must include a frozen RED test that runs the check against a fixture with the placeholder. Would have saved: 13 red CI runs and 6 PRs merged unverified (about 1.5 days of blind merging), plus this ticket's T0.
2. skill-edit: `/Users/sorinvieriu/Projects/mind-forge/.claude/skills/gsd-goal-loop/SKILL.md`. (a) In Stage 2, append to the preflight paragraph, after item (3) ending `...SC-7 "component-split gate").`, this item: "(4) Read the CI state of `main` and of this branch's last run (unauthenticated: `curl -s 'https://api.github.com/repos/vieriusorin/MindForge/actions/runs?branch=main&per_page=3'`, read each run's `conclusion`). If the latest `main` run is `failure`, record it under 'Decided by the user' with the failing step, and either fix it as T0 or park. A red `main` is a baseline red even when `pnpm test` is green locally. Also run `pnpm install --frozen-lockfile` in a scratch copy when `package.json`, `pnpm-lock.yaml` or `pnpm-workspace.yaml` changed: it is what CI runs, and plain `pnpm install` can pass where it fails." (b) In Stage 5, after the sentence ending `...what was **not** verified.`, add: "If the branch has a PR or the last `main` run failed, quote that run's `conclusion` in the hand-off; never present 'merge' as a next step on a failing run." Would have saved: the 13-run blind window (the first session after run #12 would have seen `failure` at Stage 2), and the six hand-offs that said "push and merge" with no CI conclusion.

## Not worth changing
- Branch protection on `main` (SC-3) is the real binding fix, but it is a GitHub admin setting the user owns; it is already this ticket's SC-3 and the runbook step. No skill or memory text can stand in for it.
- MF-0013 storms fixture vs `dev:seed` data: local-only, already MF-0045. No new rule.
- `pnpm db:reset` skipped to protect local data: already handled by the MF-0005 preflight (2) and recorded under "Decided by the user".
- No memory change: checked `feedback-local-first.md`, `project-supabase-migration-rules.md` and `feedback-verify-derived-facts.md`; none cover CI state, and the gate plus the skill edit are loaded at the moment it matters, which memory is not.
- No token-waste finding: one iteration, small diff; the reading cost was the proof.

## Applied

- 2026-11-05 gate → reserved ticket `.planning/tasks/MF-0046/GOAL.md` (check:workspace). Not built.
- 2026-11-05 skill-edit (additive) → `.claude/skills/gsd-goal-loop/SKILL.md`: Stage 2 preflight item (4) reads the
  `main` CI conclusion and runs a scratch frozen install. Stage 5 quotes the CI conclusion and never offers "merge" on `failure`.
- Held: nothing. Memory: none, as the retro found no entry covering CI state.
