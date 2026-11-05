---
applied: 2026-11-05
ticket: MF-0017
outcome: pass
causes: known-trap-repeated, missing-context, tooling
actions: skill-edit, memory-update
lesson_keys: aggregate-threshold-inference, windows-hook-spawn
---
## Numbers
(no `pnpm ticket:retro` script; taken from the task files)
- tier high-risk, 1 iteration (it-1), goal_status complete-pending-manual-commit
- freeze: 3 acceptance files (29 cases), 1 re-freeze of the DB acceptance (B1, user approved 2026-11-05)
- review: fresh-context diff-reviewer ran twice; first changes-requested (B1 join leak), re-review approve on b7a1fb53, 0 blocking
- receipt DONE; only pre-existing MF-0016 sync tests excepted
- concerns: C-1, C-2, C-3 resolved by the user at DESIGN; alt-account gate bypass accepted with a follow-up
- tokens: no session metrics in the files, no claim

## Went right
- Contract change "no table grant, read via definer function" was found in PLAN and sent to the acceptance writer before it froze, so MF-0005 was not re-frozen. -- keep: already is: `gsd-goal-loop` Stage 2/3 order (plan before freeze).
- C-1..C-3 (count RPC with parity test, >= 4 members gate, no destructive proof command) went to the user as options at DESIGN, with a recorded answer. -- keep: already is: SKILL.md Stage 2 Concerns and preflight.
- B1 fix was test-first: the regression went RED (`expected 8 to be 7`, twice) before the migration was edited in place, and the re-freeze recorded history. -- keep: already is: `tdd`, and the MF-0011 in-place migration memory.
- The MF-0011 DESIGN paragraph (others-only threshold, no count encoded) was followed: total - own and group size were covered, and the >= 4 gate came from it. -- keep: already is: SKILL.md line ~141.

## Went wrong
- B1: a join made the group total jump by exactly the joiner's past count, so two reads around a join gave a per-member figure. Only the fresh-context reviewer found it; it cost a user question, an SC-2 wording change, a DB acceptance re-freeze and an in-place migration edit. The MF-0011 paragraph covers single-snapshot inference (subtract self, group size, granularity) but not change between two reads. cause: known-trap-repeated (same family as `aggregate-threshold-inference`; the rule was written but its checklist stops at one snapshot).
- Stop hook `.claude/hooks/stop-gate.mjs` failed `spawn ENOENT` twice; the user approved a minimal MF-0023 fix (path.delimiter, shell on win32, quoted args). `scripts/check-hooks.mjs` still crashes on Windows (doubled `C:\C:\` path). Memory still tells sessions to "not chase the hook error" and says the fix is reserved. cause: tooling.
- Local DB was behind main (mf0016/mf0032 migrations pending), so `migration up --local` needed `--include-all`; `.env.local` lacked `SUPABASE_SECRET_KEY`, so the group page threw from the MF-0011 heatmap during the browser check (worked around in process env only). Facts were in the repo (runbook) but not in the session's preflight. cause: missing-context.

## Actions (at most two)
1. skill-edit: `C:\Users\Vlad-StefanParvana\Desktop\ccdv-f\MindForge\.claude\skills\gsd-goal-loop\SKILL.md`, Stage 2 DESIGN, the paragraph that begins around line 141 ("... leaderboard, "N of M" line) states under "Constraints -> how met" what the viewer can deduce"). Append at the end of that paragraph this sentence:
   > (d) Inference over time: the figure is read twice (before and after a join, a leave, a new attempt, an edit). State what a delta between two reads reveals. A figure that changes by exactly one member's contribution when membership changes is a per-member oracle; scope counted rows to the member's tenure (for example `answered_at >= joined_at`) or show that the change is indistinguishable from others' activity. Write the join/leave case in the SC's proof (MF-0017 B1: found only by the reviewer, cost a re-freeze).
   Would have saved: the B1 user question, the DB acceptance re-freeze and the in-place migration edit.
2. memory-update: `C:\Users\Vlad-StefanParvana\.claude\projects\C--Users-Vlad-StefanParvana-Desktop-ccdv-f-MindForge\memory\windows-dev-environment.md`. Replace the bullet starting "`.claude/hooks/stop-gate.mjs` fails with `spawn pnpm/biome/vitest ENOENT`" with:
   > `.claude/hooks/stop-gate.mjs` failed `spawn pnpm/biome/vitest ENOENT` until the MF-0023 hunk (path.delimiter + shell on win32, quoted args; probe exit 0, 2026-11-05, uncommitted on feat/MF-0017). On a branch without it, run `pnpm typecheck && pnpm lint && pnpm test` directly. `scripts/check-hooks.mjs` still crashes on Windows (doubled `C:\C:\` path), unfixed: do not rely on it. The agent-scope hook can reject a subagent Write to `.planning/tasks/<ID>/REVIEW.md` (absolute Windows path vs pattern): the orchestrator writes it from the reviewer's report.
   And append a bullet after it:
   > Before a browser check or `test:db` on a branch: if the local DB is behind main, `supabase migration up --local --include-all` (no `db reset`); and `.env.local` may lack `SUPABASE_SECRET_KEY`, which makes the group page throw from the MF-0011 heatmap. Set it in the dev server's process env, not in a committed file.
   Also edit the last sentence of the bullet that ends "Stop-hook fix is reserved as MF-0023 (MF-0021 on main is heatmap privacy)." to drop "Stop-hook fix is reserved as MF-0023" (now done).
   Would have saved: two failed hook runs, a heatmap crash diagnosis and a failed `migration up` during verification.

## Not worth changing
- Alt accounts filling a group to 4: accepted residual with a follow-up filed; not a process lesson.
- Header comment in the migration still said "every current member" after the B1 fix: comment only, touched up in place.
- Parity test applies the `joined_at` cut in the test because `countableAttempts` has no membership concept: pinned by the literal `EXPECTED_PROGRESS = 7`; reviewer judged it not blocking.
- Pre-existing MF-0016 sync test failures excepted in the receipt: not this ticket's.
- Hand-run freeze/verify (no `ticket:*` scripts): already a known gap (`hand-run-ticket-scripts`).
- Tokens: no metrics available, so no claim; ticket size was large (migration, engine, server, UI, two reviews).

## Applied

- 2026-11-05 skill-edit (additive) applied: `.claude/skills/gsd-goal-loop/SKILL.md` Stage 2, the
  other-people's-data paragraph gained (d) inference over time (join/leave deltas; tenure-scoped rows).
  On merging main (MF-0021 added its own (d) on viewer-controlled inputs) it became (e), scoped to
  OTHER members' joins and leaves.
- 2026-11-05 memory-update applied: `windows-dev-environment.md` stop-hook bullet rewritten (MF-0023 hunk,
  check-hooks.mjs still broken), new preflight bullet (`--include-all`, `SUPABASE_SECRET_KEY` in process env),
  "Stop-hook fix is reserved as MF-0023" dropped.
- Held: nothing.
