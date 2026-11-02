# Autonomous mode — `/gsd-goal-loop <ID> --autonomous`

The same lifecycle, run by an orchestrator session nobody is watching — normally started by
`pnpm agents:night`, in its own worktree on branch `agent/<ID>`. Three things change: nobody
answers questions, the work is split across role agents, and **only a receipt can say done**.

## Before the night — with the user present

Autonomy starts after the human checkpoints, never instead of them:

1. INTAKE + DESIGN as usual, ideally with research mode (`references/research.md`) so the user
   confirms answers instead of producing them.
2. Stage 2b: the `acceptance-writer` agent writes the acceptance tests from the SCs alone; the
   user runs (or approves) `pnpm ticket:freeze`.
3. Add `autonomy: ready` to GOAL.md's front matter, set `stage: plan`, and add the ID to
   `.planning/queue.txt`. `pnpm agents:night --dry-run` says whether it would run and, if not, why.
4. (PT-0363) Lanes run in parallel, but a ticket with no `LOOP-PLAN.md` counts as a schema lane,
   and schema lanes never overlap. Run `ticket-planner` in the evening (a high-risk plan needs the
   user's approval anyway), and the dry run marks which tickets will serialise. A lane ends on
   budget, the iteration stop rule, or 20 min with no transcript activity, never on a clock.

## The night — what the orchestrator session does

```
PLAN    → Agent(ticket-planner): LOOP-PLAN.md with the ```json tasks graph
          check: pnpm ticket:eval <ID> → the "plan" row must be ✓ before any build
BUILD   → for each task whose depends_on are done, in graph order:
            Agent(<task.agent>) with: ticket ID, task id, the task JSON, its context list
            then RE-RUN the task's done_when commands yourself. The builder's STATUS is a claim;
            the exit codes are the fact. A task is done only when they exit 0.
            needs-scope → re-plan (ticket-planner), never widen a scope by hand.
          Tasks with disjoint owns and no dependency between them may run as parallel agents.
TEST    → set `stage: test`, then Agent(verifier) → it runs `pnpm ticket:verify <ID>`
          VERDICT PASS   → REVIEW
          FAIL           → read STOP RULE:
                              continue → back to BUILD with the new failures as the brief
                              stuck    → PARK (same failure twice: the plan or the SC is wrong)
                              budget   → PARK
          INCOMPLETE     → the test stack is down: PARK as blocked-on-infra, never "pass"
REVIEW  → Agent(diff-reviewer) → REVIEW.md bound to the diff hash
          changes-requested with [blocking] → back to BUILD with the findings, then TEST again
DONE    → pnpm ticket:verify <ID> --status must print DONE, and pnpm ticket:eval <ID> HEALTHY.
          Then: goal_status: complete-pending-manual-commit, stage: handoff, Iteration Log entry.
RETRO   → after DONE and after a PARK (the retro-trigger Stop hook insists): pnpm ticket:retro
          <ID>, then Agent(retro). Apply nothing; set `applied: deferred`. The next interactive
          session applies it automatically.
```

The iteration cap is `P4T_MAX_ITERATIONS` (default 6); `--status` prints the stop rule.

## Rules that replace the human

- **Never ask.** No AskUserQuestion. A question of fact goes through research mode; a question of
  business, RBAC, money semantics, law, scope or a Key Decision PARKS the ticket.
- **PARK** = write the question into GOAL.md → Open questions (with options and a recommendation),
  set `goal_status: blocked-on-<owner>`, append the Iteration Log, end the session. Parking is a
  correct outcome; a guess is not.
- **A denied tool call is information, not an obstacle.** Permission prompts are answered "no"
  automatically. A denial on a frozen test, a gate, a hook, settings or a scope boundary means the
  plan needs a human — park. Never route around it through Bash.
- **Never write a receipt, a verdict, or "approved by the user".** Receipts are appended by
  `ticket:verify` alone; the runner re-runs it after you exit and that run is what the morning
  report shows.
- **Change product files only.** The night session is sandboxed to its lane, and after it exits
  the runner judges a clean room that receives only `src/`, `drizzle/`, `e2e/flows/`,
  `e2e/**/*.spec.ts`, `docs/`, `public/` and this ticket's planning dir. A change anywhere else —
  scripts, configs, test or e2e setup, package files, any `.gitignore` — fails the night outright.
  A ticket that genuinely needs such a change is not a night ticket: park it.
- **Never commit, push, or migrate beyond the test stack.** The runner commits only when the
  developer passed `--pr`, and only after its own verify + eval pass.
- Pre-existing red (`~ preexisting` in the receipt) is not yours. Note it; do not fix it.
- Stay inside the ticket. Work you discover is a new GOAL draft in the Iteration Log, not a diff.

## What the morning sees

`.planning/runs/<date>/MORNING.md`: per ticket the runner's verify verdict, the process-eval
verdict with its failing rows, the stop reason, goal_status, cost, time, open questions
(`needs-human` research and parked questions), refreezes to confirm, and the worktree path.
Each lane's `.planning/tasks/<ID>/RETRO.md` carries `applied: deferred`; once the lane's work is
in the main tree, the next interactive session applies it without being asked.
`pnpm metrics:report --by ticket` compares runs.
