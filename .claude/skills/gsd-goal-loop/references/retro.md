# Retro — Stage 7: make the next ticket cheaper and more accurate (PT-0383)

A ticket's receipts say whether the code passed. The retro asks what the *process* cost and what
it should have known, and turns the answer into a change to what the next session loads. It runs
for every Normal and High-risk ticket that reached HAND-OFF **or was parked** — a park is usually
the most instructive outcome.

## Why a separate agent

The building session is the worst judge of its own run: it remembers what it meant to do. The
`retro` agent starts in a fresh context, reads `pnpm ticket:retro <ID>` (counts from receipts,
freeze history, research, review and per-ticket token metrics, compared with the median ticket)
plus the ticket's own files, and never the transcript. It runs on Sonnet; a retro costs a small
fraction of the ticket it reviews.

## Automatic — nobody starts it, nobody approves it

The `retro-trigger.mjs` Stop hook starts it. When a ticket this session touched is **finished
with evidence** (`goal_status: complete*` and a PASS receipt or `.planning/evidence/<ID>.md`) or
**parked** (`blocked-on-*`), and its RETRO.md is missing or not yet applied, the turn cannot end:
the hook hands back the steps below. It blocks twice at most for the same set, then releases with
a `✗ Retro not done` banner. Spikes are skipped. `P4T_RETRO=off` disables it for one session.

```
pnpm ticket:retro <ID>            facts + signals; writes .planning/tasks/<ID>/retro-facts.json
Agent(retro, "<ID>")             writes RETRO.md: right / wrong / cause / ≤ 2 actions
orchestrator applies, by the policy below — no AskUserQuestion
append "## Applied", set `applied: <YYYY-MM-DD>` in RETRO.md's front matter
```

### The apply policy — the closed table

| action | interactive session | night lane (`P4T_AUTONOMOUS`) |
|---|---|---|
| `memory-update`, `memory-delete` | apply; fix the MEMORY.md line too | defer |
| `memory-add` | apply, only if the agent named the entries it checked | defer |
| `skill-edit` that adds or sharpens a rule | apply — it is in the diff the developer commits | defer |
| `skill-edit` that removes or loosens a rule | **hold** — list it under "## Applied" as held | defer |
| `gate` | draft a new ticket: claim the number, `GOAL.md` with `goal_status: reserved` and the agent's pattern + the file it would have caught. Never build it here | defer |
| anything touching a frozen test, a gate script, a hook, settings, CLAUDE.md | **hold** | defer |

"Defer" = write RETRO.md, set `applied: deferred`, change nothing else: a sandboxed lane cannot
write memory, and the developer reads skill edits in a diff, not in a lane. The next interactive
session that does any work finds every `applied: deferred` RETRO.md and applies it then.

The developer's control point is the same as for code: the uncommitted diff. Every applied skill
edit and every drafted gate ticket is in it; memory changes are listed in "## Applied".

## The two rules that make it pay off

1. **Every lesson lands where it is loaded at the moment it matters** — a gate first, a skill or
   the per-path hook digest second, memory last. Memory is read every session; it is the most
   expensive place for a lesson and the easiest to ignore.
2. **Update or delete before adding.** A retro that only appends grows `MEMORY.md` until every
   session pays for it. The agent must name the entries it checked before proposing `memory-add`,
   and a duplicate or stale entry it finds is an action in its own right.

## Across tickets — every ~10 retros, or when the user asks

```bash
pnpm ticket:retro --across --since 2026-10-01
```

Counts causes and actions over every RETRO.md and lists each `lesson_keys` slug seen in two or
more tickets. **A lesson learned twice is the case for a gate**, not for a sharper sentence —
draft the gate as a new ticket. The same output is the data for tuning the stop-rule thresholds
(`P4T_MAX_ITERATIONS`, the same-failure limit) and `SIGNAL_THRESHOLDS` in
`scripts/lib/ticket-retro.mjs`, all of which are first guesses.

## A short retro is a correct retro

When `pnpm ticket:retro` shows no signal, the agent writes `causes: none` / `actions: none` and
the orchestrator sets `applied:` straight away — `--across` still counts the ticket. A park retro
is rewritten when the ticket later finishes (the hook asks for it), keeping its `lesson_keys`.
