---
ticket: MF-0014
outcome: pass
causes: missing-context, tooling
actions: gate, skill-edit
lesson_keys: ticket-number-collision-across-branches, load-external-api-skill-before-sc, read-frozen-tests-in-plan
applied: 2026-11-04
---
## Numbers
No `pnpm ticket:retro` script exists; facts come from GOAL.md, LOOP-PLAN.md, LOOP-VERIFY.md, FROZEN.json and the orchestrator.
- Tier normal, 8 SCs, 7 red tests at freeze (2 files), 4 plan tasks, receipt DONE on the first iteration (255/255, build green). No fresh-context review.
- 0 plan divergences, 0 SC changes after the user confirmed the SCs.
- 1 user question during DESIGN, about the MF-0022/MF-0023 collision (C-2), plus the C-1 move. Both resolved before freeze.
- 20 tracked files changed (+393/-219) plus new untracked files. No paid run (no `ANTHROPIC_API_KEY`), so the real runs, real-model eval and PRs sit in MF-0022 SC-5..SC-7.

## Went right
- The MF-0008 retro lesson was applied. The claude-api skill was loaded at DESIGN, before the SCs were written. It found that structured outputs cannot enforce `minItems`/`minLength`, and the SCs put counts and non-empty checks in code. That is why there were 0 SC changes after confirmation (MF-0008 had 1). Keep: already is, in `.claude/skills/gsd-goal-loop/SKILL.md` Stage 2 (added by the MF-0008 retro).
- Reading the frozen MF-0008 SC-4 test during PLAN showed that it reads every top-level `evals/golden/*.yaml`. The new golden files therefore went into subfolders before any code was built, and no frozen test was touched. Keep: add the line to Stage 3 PLAN in SKILL.md ("read the frozen acceptance tests of `builds_on` tickets that touch the same directory"). I did not make it an action because it worked and the cost of missing it would have been small.
- Redrafting the SCs on the MF-0008 offline shape (injected mock client, paid proofs moved to a reserved ticket) gave a first-pass DONE. Keep: already is, in the Stage 2 rule for SCs that need a runbook (SKILL.md line ~133).
- The preflight (`typecheck`, `lint`, `test` before the freeze) gave a clean baseline, and the freeze used typed stubs so that typecheck and lint stayed green while the tests were red. Keep: already is, in LOOP-VERIFY.

## Went wrong
- `.planning/tasks/MF-0022/GOAL.md` and `MF-0023/GOAL.md` each held two tickets. MF-0008 and MF-0012 reserved the same numbers in parallel, and merge commit `71ac090` glued the files together. Stage 0's `grep -rn <ID> .planning src` could not catch it, because each session saw the number free in its own worktree at claim time. MF-0014 found it only because it needed to cite MF-0022 as the paid-runs ticket. It cost a user question, a renumbering of MF-0012's tickets to MF-0026/0027, and edits to MF-0012's GOAL, RETRO and evidence. Cause: missing-context. The claim check looks at one working tree, and nothing checks the merged result. Nothing static ran at merge to flag that one GOAL.md holds two `ticket_id:` lines.
- A shell loop failed because zsh does not word-split `for pair in "A B"` and `set -- $pair`. It was rerun under `bash -c`. Cause: tooling. The trap is already in memory `feedback-verify-derived-facts.md` (zsh does not split `$VAR`, bitten in MF-0001 and MF-0018), and this is the third time. It cost one rerun and nothing else, so I did not spend an action on it.

## Actions (at most two)
1. gate: reserve a ticket for a new check `scripts/check-planning.mjs`, to run in the stop gate's GATES step (the hook is guarded config, so the orchestrator reserves it and does not build it). It scans `.planning/tasks/*/GOAL.md` and fails when (a) a file has more than one `ticket_id:` line, or (b) its `ticket_id` differs from its directory name. It would have flagged `.planning/tasks/MF-0022/GOAL.md` and `.planning/tasks/MF-0023/GOAL.md` (two tickets each) at merge `71ac090`, not at MF-0014's DESIGN. Would have saved: one user question, the renumbering across MF-0012 files, and roughly one design-stage pause on MF-0014.
2. skill-edit: `.claude/skills/gsd-goal-loop/SKILL.md`, Stage 0, the bullet at line 70-71 ("Check the number is free first"). Replace it with: "Check the number is free first, in every branch and worktree, not only this tree: `grep -rn "<PREFIX>-0042" .planning src; git grep -n "<PREFIX>-0042" $(git for-each-ref --format='%(refname)' refs/heads refs/remotes); git worktree list`. Sessions run on separate branches and a number free in your tree can already be reserved in another. A merge then concatenates two tickets into one GOAL.md (MF-0022/MF-0023, 2026-11-04). Taken in any of them: pick the next number and say so. When a branch merges, re-run `grep -c '^ticket_id:' .planning/tasks/*/GOAL.md` and fix any count above 1 before starting work." Would have saved: the collision at claim time wherever the other reservation was committed. A reservation that is still uncommitted in another worktree stays visible only to the `git worktree list` step, so action 1 remains the backstop.

## Not worth changing
- The zsh `for pair in "A B"` word-split rerun: already in memory `feedback-verify-derived-facts.md`, cost one command. A static gate cannot see it, and a longer memory line would not change the next session's behaviour.
- The SC-4 golden-folder constraint found by reading the frozen test: it worked as the PLAN stage is written, so there is nothing to fix.
- No fresh-context review at tier normal: policy, not a defect.
- No paid run or real-model eval: the same offline split as MF-0008, tracked in MF-0022.

## Applied

2026-11-04, automatic policy:
- Action 1 (gate): reserved as **MF-0028** (`.planning/tasks/MF-0028/GOAL.md`, goal_status: reserved). Free in this
  tree, in every branch ref and in the single worktree. Not built: hooks are guarded config.
- Action 2 (skill-edit): applied additively in `.claude/skills/gsd-goal-loop/SKILL.md` Stage 0. The existing grep
  stays, and the cross-branch `git grep` / `git worktree list` check and the post-merge `ticket_id` count are added
  under it. Nothing was removed or loosened.
- Held: nothing.
