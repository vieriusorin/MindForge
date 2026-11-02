---
name: ralph-loop
description: Bounded autonomous build loop. Takes an iteration ceiling and a freeform brief, derives a frozen contract, then runs the feature-loop engine unattended until PASS or an escape condition. Use when the user says "/ralph-loop", "ralph loop N <brief>", "keep building until done", or wants a fire-and-forget feature build with a hard iteration cap. Delegates orchestration to the feature-loop skill.
---

# Ralph Loop — Bounded Autonomous Build

Thin entrypoint to the **feature-loop** engine. Parses an iteration ceiling and a
freeform brief, then runs feature-loop's autonomous mode (steps 4 → 5 → 6)
unattended until the judge returns PASS or an escape condition fires.

This skill does **not** reimplement orchestration. All loop logic, hub-and-spoke
fan-out, coverage gates, and the judge live in
`.claude/skills/feature-loop/SKILL.md`. Read it before running.

## Invocation

```
/ralph-loop <N> <brief>
```

- `<N>` — integer iteration ceiling. Overrides feature-loop's default cap of 3.
  Required. If omitted, default to 3.
- `<brief>` — freeform natural-language description of what to build. The AI
  interprets it into the frozen contract; no template required.

Examples:

```
/ralph-loop 5 add a notifications popover with unread badge and mark-all-read
/ralph-loop 3 wire the classroom roster page to the live API and gate by teacher role
```

## Behavior

### Intake — fully autonomous (no confirm)

Derive the frozen contract from `<brief>` and start immediately. Do NOT ask the
user to confirm the contract first. Produce, in one pass:

- `ticket_id` (`<PREFIX>-####`, prefix from `ticket-traceability` bindings) — reuse existing or assign next free ID
- linked `requirements` IDs — map to `.planning/REQUIREMENTS.md`; create new req
  IDs there if the brief is not yet a requirement
- numbered, machine-checkable **acceptance criteria** (each provable by a command
  or explicit manual step)
- non-goals / out-of-scope
- risk tier (Normal or High-risk per the `ticket-traceability` skill)

Freeze the criteria. They are the exit condition. Do not relax or reinterpret
them mid-run — even though intake was autonomous, the contract is locked once the
loop starts.

> Trade-off accepted: autonomous intake means a mis-read brief can waste cycles.
> The N-cap and convergence guard bound that cost.

### Run — feature-loop autonomous mode

Hand the frozen contract to feature-loop and run steps 4 → 5 → 6 unattended.
Iterate build → assurance fan-out → judge with **iteration ceiling = N** instead
of the default 3. All other feature-loop rules stay intact.

### Escapes — stop and surface only on these

1. **PASS** — judge confirms all criteria + the three coverage gates green →
   write `.planning/evidence/<PREFIX>-####.md`, stop, present it as the result.
2. **N-cap reached without PASS** — stop. Report residual unmet criteria + the
   evidence gathered so far. Do NOT auto-extend; the user decides next steps.
3. **No convergence** — open findings did not shrink vs. the previous cycle →
   stop and report (criterion likely un-satisfiable or mis-specified).
4. **NEEDS-HUMAN** — visual/aesthetic judgment or ambiguous criterion → stop and
   ask the user. Never auto-decide UI aesthetics.

## Hard rules

- N raises the ceiling only. It never disables the convergence guard or the
  NEEDS-HUMAN escape. A larger N does not buy past those.
- Never commits (see `.claude/rules/no-commit.md`). On PASS, hand the file list +
  suggested commit message to the user.
- Spikes/chores do not use this loop — overhead not justified. Use `gsd-fast` or
  a direct edit.
- The orchestrator (main thread) is the only writer of the evidence file and the
  only authority that declares the ticket complete.
