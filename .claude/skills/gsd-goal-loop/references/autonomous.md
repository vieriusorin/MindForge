# Autonomous mode — `/gsd-goal-loop <ID> --autonomous`

The same lifecycle, run by an orchestrator session nobody is watching — started by the
NIGHT_RUNNER if the project has one (ideally in its own worktree on branch `agent/<ID>`), else by
hand. Three things change: nobody answers questions, the work is split across role agents (or
roles run inline), and **only a receipt can say done**.

## Before the run — with the user present

Autonomy starts after the human checkpoints, never instead of them:

1. INTAKE + DESIGN as usual, ideally with research mode (`references/research.md`) so the user
   confirms answers instead of producing them.
2. Stage 2b: `acceptance-writer` (or you, from the SCs alone) writes the acceptance tests; the user
   runs or approves FREEZE.
3. Add `autonomy: ready` to GOAL.md's front matter, set `stage: plan`, and queue the ID
   (`.planning/queue.txt` by default). A runner dry-run, if available, says whether it would run.
4. Lanes may run in parallel, but schema-changing lanes never overlap, and a ticket with no
   `LOOP-PLAN.md` counts as a schema lane. Plan in advance (a high-risk plan needs approval
   anyway). A lane ends on budget, the iteration stop rule, or prolonged inactivity, never a clock.

## The run — what the orchestrator session does

```
PLAN    → Agent(ticket-planner): LOOP-PLAN.md with the ```json tasks graph
          check: EVAL → the "plan" row must pass before any build
BUILD   → for each task whose depends_on are done, in graph order:
            Agent(<task.agent>) with: ticket ID, task id, the task JSON, its context list
            then RE-RUN the task's done_when commands yourself. The builder's STATUS is a claim;
            the exit codes are the fact. A task is done only when they exit 0.
            needs-scope → re-plan (ticket-planner), never widen a scope by hand.
          Tasks with disjoint owns and no dependency between them may run as parallel agents.
TEST    → set `stage: test`, then Agent(verifier) → it runs VERIFY
          VERDICT PASS   → REVIEW
          FAIL           → apply the stop rule:
                              new failures, under cap → back to BUILD with them as the brief
                              same failure twice      → PARK (the plan or the SC is wrong)
                              budget / iteration cap  → PARK
          INCOMPLETE     → the test stack is down: PARK as blocked-on-infra, never "pass"
REVIEW  → Agent(diff-reviewer) → REVIEW.md bound to the diff hash
          changes-requested with [blocking] → back to BUILD with the findings, then TEST again
DONE    → VERIFY says DONE for this tree, and EVAL is healthy.
          Then: goal_status: complete-pending-manual-commit, stage: handoff, Iteration Log entry.
RETRO   → after DONE and after a PARK: RETRO_FACTS, then Agent(retro). Apply nothing; set
          `applied: deferred`. The next interactive session applies it.
```

The iteration cap defaults to 6 (make it an env var if the project runs this often).

## Rules that replace the human

- **Never ask.** No AskUserQuestion. A question of fact goes through research mode; a question of
  business, access rules, money semantics, law, scope or a Key Decision PARKS the ticket.
- **PARK** = write the question into GOAL.md → Open questions (with options and a recommendation),
  set `goal_status: blocked-on-<owner>`, append the Iteration Log, end the session. Parking is a
  correct outcome; a guess is not.
- **A denied tool call is information, not an obstacle.** A denial on a frozen test, a gate, a
  hook, settings or a scope boundary means the plan needs a human — park. Never route around it
  through Bash.
- **Never write a receipt, a verdict, or "approved by the user".** Receipts come from VERIFY alone;
  a runner should re-run it after you exit, and that run is what the report shows.
- **Change product files only** — source, migrations, e2e specs, docs, public assets, and this
  ticket's planning dir. A change to scripts, configs, test setup, package files or `.gitignore`
  means it is not an unattended ticket: park it.
- **Never commit, push, or migrate beyond the test stack.** If a runner commits, it does so only
  when the developer opted in, and only after its own verify + eval pass.
- Pre-existing red (present in the baseline) is not yours. Note it; do not fix it.
- Stay inside the ticket. Work you discover is a new GOAL draft in the Iteration Log, not a diff.

## What the morning sees

A run report (`.planning/runs/<date>/MORNING.md` by default): per ticket the verify verdict, the
eval verdict with failing rows, the stop reason, goal_status, cost, time, open questions
(`needs-human` research and parked questions), refreezes to confirm, and the worktree path. Each
lane's `RETRO.md` carries `applied: deferred`; once the lane's work is in the main tree, the next
interactive session applies it without being asked.
