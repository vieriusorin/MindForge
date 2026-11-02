---
name: feature-loop
description: Orchestrate a hub-and-spoke team of specialist agents to deliver a feature against fixed acceptance criteria, looping until a judge confirms every criterion is met. Use when the user says "feature loop", "/feature-loop", "orchestrate agents to build X", or wants a Ralph-style understand→delegate→implement→verify loop with FE/security/QA/a11y/UI reviewers. For non-trivial, multi-concern features only — skip for spikes and single-file chores.
---

# Feature Loop — Orchestrated Specialist Team

A deterministic understand → decompose → delegate → implement → verify loop.
The orchestrator (you, the main thread) owns the feature, the acceptance
criteria, the task graph, and the final decision. Specialists run as **isolated
subagents** and return summaries — they do **not** talk to each other. This is
**hub-and-spoke**, not a mesh. The orchestrator is the only coordinator and the
only merge authority.

> Real-primitive note: Claude Code subagents return to the orchestrator; there is
> no peer-to-peer agent channel and no `TaskCreated`/`SubagentStart` hook. Loop
> control lives in this skill + the `Stop`/`PostToolUse` hooks in
> `.claude/settings.json`. Agent-teams (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`,
> already enabled here) can replace the subagent fan-out later, but start with
> subagents.

## Preconditions

- Feature is Normal or High-risk tier (see the `ticket-traceability` skill).
  Spikes do not use this loop.
- A `ticket_id` (`<PREFIX>-####`, prefix from `ticket-traceability` bindings) exists or is assigned in step 1.

## The loop

### Step 1 — Intake (orchestrator, no subagent)

Produce a frozen contract. Do NOT proceed until these exist:

- `ticket_id` (`<PREFIX>-####`, prefix from `ticket-traceability` bindings)
- linked `requirements` IDs from `.planning/REQUIREMENTS.md` (create new req IDs
  there first if the feature is not yet a requirement)
- **acceptance criteria** as a numbered, machine-checkable list (each must be
  provable by a command or an explicit manual step)
- non-goals / out-of-scope
- risk tier

Ask the user with `AskUserQuestion` if scope, criteria, or tier are ambiguous.
Do NOT freeze yet — Step 1.5 hardens the draft first, then freezes.

### Step 1.5 — Grill & doc-harden (orchestrator, interactive)

Before freezing the criteria, run the `grill-with-docs` skill against the draft
contract. It pulls relevant library docs and stress-tests the design with
edge-case questions:

- surfaces unstated assumptions, missing error/empty/loading states, RBAC gaps,
  and contract holes (`// TODO(BE):` endpoints that don't exist yet)
- pulls current docs for any library the feature touches (via `context7` /
  `context7-docs-lookup`) so the plan is built on real APIs, not stale memory
- asks the user the edge-case questions it raises (use `AskUserQuestion`)

Fold the answers back into the acceptance criteria, then freeze. One grill round
is cheap insurance — it beats discovering a missing criterion three build cycles
in.

Skip only for the smallest Normal-tier tasks where the contract is already
unambiguous. Never skip for High-risk tier.

### Step 2 — Impact analysis (subagent)

Spawn `Explore` (or `cavecrew-investigator` for a compressed file:line map) to
determine what must be **added / changed / deleted** across:

FE (`apps/web`), BE (`apps/api`), shared (`packages/shared`), auth/RBAC, DB
schema, tests, docs. Output: a change map keyed to acceptance criteria.

### Step 3 — Plan (subagent)

Spawn `gsd-planner` (or run `/gsd:plan-phase`) to turn the change map into a
PLAN.md. Enforce the ticket invariant: frontmatter MUST contain `ticket_id`,
`requirements`, and a runnable `verify:` block. Gate the plan through
`gsd-plan-checker` if available.

### Step 4 — Build (subagent, ownership-bounded)

Spawn `gsd-executor` to implement the plan. **One owner per file** — never run
two implementing subagents on overlapping files in the same wave; that causes
clobbering. Parallelize only across disjoint file sets.

`PostToolUse` hook on `Edit|Write` runs typecheck + targeted tests automatically
(see settings.json). Fast feedback before review.

### Step 5 — Assurance fan-out (parallel subagents — review only, no edits)

Dispatch the specialist reviewers **in parallel** (single message, multiple Task
calls). Reviewers emit findings; they do NOT edit code:

| Concern | Agent / Skill |
|---------|---------------|
| Code quality / bugs | `gsd-code-reviewer` |
| Security (auth, input, secrets, OWASP) | `gsd-security-auditor` + `owasp-security` skill |
| Accessibility (WCAG 2.1 AA) | `accessibility` skill / `web-design-guidelines` |
| UI/UX visual standards | `gsd-ui-auditor` |
| Test/criterion coverage | `gsd-nyquist-auditor` |

Each returns findings in `path:line: severity: problem. fix.` form.

### Step 6 — Judge (subagent) → loop or exit

Spawn `gsd-verifier`. It compares **evidence vs. the frozen acceptance criteria**
and the three coverage gates (requirement / test-evidence / reviewer). Verdict:

- **PASS** — every criterion has evidence, all gates green → write
  `.planning/evidence/<PREFIX>-####.md`, exit loop, hand to user for manual commit.
- **FAIL** — list unmet criteria + blocking findings → orchestrator routes each
  finding back to its owner (step 4 for code, step 3 if the plan was wrong) and
  re-runs from there.
- **NEEDS-HUMAN** — visual/aesthetic judgment or ambiguous criterion → stop, ask
  user. UI aesthetics are NOT auto-decidable.

### Loop control — mandatory

- **Max iterations: 3.** After 3 FAIL cycles, stop and escalate to the user with
  the residual gap. No infinite spin.
- Each iteration must reduce open findings; if findings do not shrink, stop and
  escalate (un-satisfiable or mis-specified criterion).
- Orchestrator is the only writer of the evidence file and the only authority
  that declares the ticket complete.

## Autonomous mode (governed Ralph)

Once Step 1 produces a frozen contract, run steps 4 → 5 → 6 **unattended** —
do NOT ask the user between cycles. Iterate build → assurance → judge until the
judge returns PASS, then present the evidence file as the only result the user
reviews.

Interrupt the autonomous run and surface to the user **only** on these escape
conditions:

1. **PASS** — judge confirms all criteria + gates green → stop, show evidence.
2. **Iteration cap** — 3 FAIL cycles reached → stop, report residual gap.
3. **No convergence** — open findings did not shrink vs. previous cycle → stop,
   report (criterion likely un-satisfiable or mis-specified).
4. **NEEDS-HUMAN** — visual/aesthetic judgment or ambiguous criterion → stop,
   ask user. Never auto-decide UI aesthetics.

This is Ralph-style "keep going until done" **bounded** by the four exits above —
not unbounded fire-and-forget. The orchestrator still owns the criteria, never
relaxes them mid-run, and never commits (see `.claude/rules/no-commit.md`).

## What this loop does NOT do

- Does not commit (see `.claude/rules/no-commit.md`).
- Does not make final UI aesthetic calls — routes to NEEDS-HUMAN.
- Does not let reviewer agents edit code — review and build are separate roles.
- Does not run for spikes/chores — overhead not justified.

## Minimal first run

Don't deploy the full roster day one. Start: orchestrator + `Explore` +
`gsd-executor` + 3 reviewers (`gsd-code-reviewer`, `gsd-security-auditor`,
`accessibility`) + `gsd-verifier` judge. Add `gsd-ui-auditor` /
`gsd-nyquist-auditor` once the core loop is stable and you see repeated failure
modes worth a dedicated specialist.
