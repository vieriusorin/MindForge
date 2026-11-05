---
ticket: MF-0030
outcome: pass
causes: missing-context
actions: skill-edit, memory-add
applied: 2026-11-05
lesson_keys: generate-cli-ignores-env-local, design-preflight-sc-preconditions
---
## Numbers
`pnpm ticket:retro` does not exist in this repo (ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL), so facts come from the artifacts:
- tier normal, last_iteration: 0 (one iteration, no re-freeze), no reviewer.
- logs/: gate-planning, lint, test, typecheck. No failing receipt.
- goal_status complete-pending-manual-commit; Concerns C-1..C-4 all resolved with the user before freeze.

## Went right
- GOAL.md "Facts (re-derived at pickup)" listed cap default, estimates, CLI flags and the import-time `main()` problem with file:line, before any plan. One iteration, no re-freeze followed. — already is: the design-preflight-sc-preconditions lesson (reused key).
- Four collisions (cap overrun, scope, cost, network) went to the user as Concerns and were resolved before freeze, so no SC was reworked. — already is: gsd-goal-loop Concerns table.
- Reuse over restatement: `content:all` calls `maxBatchUsd` and `estimateBatchCost` and uses an injected runner, so the dry and refusal paths are proven offline with no API call. — keep: no change needed.

## Went wrong
- At PLAN it turned out no generate CLI loads `.env.local`. `MF_MAX_BATCH_USD=50` in `.env.local` is ignored unless exported, so the $25 default applies. This is a pre-existing fact. It was found by reading source, not given by any doc. README line 77 says "default $25" and does not say where the variable must be set. A user who set 50 in `.env.local` and saw $70.68 questions would be refused with no hint why. cause: missing-context.

## Actions (at most two)
1. memory-add: new entry `generate-cli-ignores-env-local` in the project memory (and a one-line pointer in MEMORY.md). Text: "No `scripts/generate/*` CLI loads `.env.local`. `MF_MAX_BATCH_USD`, `ANTHROPIC_API_KEY` and `MF_AUTHOR_EMAIL` take effect only when exported in the shell (`MF_MAX_BATCH_USD=50 pnpm content:all ...`). A value in `.env.local` is silently ignored and the $25 default applies. Checked: no memory entry covers env loading for the generate CLIs (MEMORY.md was not found at the index path, so the orchestrator should check for an existing entry first). Any ticket touching a generate CLI states the effective cap in its dry-run output." Would have saved: the PLAN-time rediscovery by source reading, and a later confusing refusal.
2. skill-edit: `/Users/stefan/Work/ddroidd/MindForge/code/README.md` line ~77, after "(default $25)", append: "Set it in the shell, not `.env.local`: the generate CLIs do not read that file." Would have saved: the same support question for every contributor. This is a doc fix, and a follow-up ticket could make `content:all` print the effective cap and its source in the dry-run plan.

## Not worth changing
- `pnpm ticket:retro` is missing in this repo. Retros here are built from artifacts, so there is no number to fix. If it is wanted, it is a tooling ticket of its own.
- The verifier batch is not bounded by `--max-total-usd` (C-2 residual). It is a known, accepted, recorded concern.
- No reviewer ran (normal tier) and nothing failed, so no tier change is proposed.

## Applied

- 2026-11-05 memory-add `generate-cli-ignores-env-local` (new file + MEMORY.md pointer; no existing entry covered it).
- 2026-11-05 README.md:77: additive sentence "set it in the shell, because the generate CLIs do not read `.env.local`" (the "skill-edit" action targets README, part of this ticket's diff).
- Held: none. Not taken: making `content:all` print the cap's source (a follow-up suggestion, not an action).
