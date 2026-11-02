# Retro — Stage 7: make the next ticket cheaper and more accurate

A ticket's receipts say whether the code passed. The retro asks what the *process* cost and what
it should have known, and turns the answer into a change to what the next session loads. It runs
for every Normal and High-risk ticket that reached HAND-OFF **or was parked** — a park is usually
the most instructive outcome.

## Why a separate agent

The building session is the worst judge of its own run: it remembers what it meant to do. The
`retro` agent starts in a fresh context, reads RETRO_FACTS (counts from receipts, freeze history,
research, review and token metrics, compared with the median ticket if available) plus the
ticket's own files, and never the transcript. A smaller model is enough; a retro should cost a
small fraction of the ticket it reviews. Without a retro agent, spawn a fresh general subagent
with the same brief.

## Automatic — nobody starts it, nobody approves it

Best wired as a Stop hook: when a ticket this session touched is **finished with evidence**
(`goal_status: complete*` and a PASS receipt or `.planning/evidence/<ID>.md`) or **parked**
(`blocked-on-*`), and its RETRO.md is missing or not yet applied, the turn cannot end. Cap the
blocks (e.g. twice per set), skip spikes, allow an env var to disable it for a session. Without
the hook, run it yourself after Stage 5 or a park.

```
gather RETRO_FACTS               → .planning/tasks/<ID>/retro-facts.json
Agent(retro, "<ID>")             writes RETRO.md: right / wrong / cause / ≤ 2 actions
orchestrator applies, by the policy below — no AskUserQuestion
append "## Applied", set `applied: <YYYY-MM-DD>` in RETRO.md's front matter
```

### The apply policy — the closed table

| action | interactive session | unattended lane |
|---|---|---|
| `memory-update`, `memory-delete` | apply; fix the MEMORY.md line too | defer |
| `memory-add` | apply, only if the agent named the entries it checked | defer |
| `skill-edit` that adds or sharpens a rule | apply — it is in the diff the developer commits | defer |
| `skill-edit` that removes or loosens a rule | **hold** — list it under "## Applied" as held | defer |
| `gate` | draft a new ticket: claim the number, `GOAL.md` with `goal_status: reserved` and the pattern + the file it would have caught. Never build it here | defer |
| anything touching a frozen test, a gate script, a hook, settings, CLAUDE.md | **hold** | defer |

"Defer" = write RETRO.md, set `applied: deferred`, change nothing else: a sandboxed lane cannot
write memory, and the developer reads skill edits in a diff, not in a lane. The next interactive
session that does any work finds every `applied: deferred` RETRO.md and applies it then.

The developer's control point is the same as for code: the uncommitted diff. Every applied skill
edit and every drafted gate ticket is in it; memory changes are listed in "## Applied".

## The two rules that make it pay off

1. **Every lesson lands where it is loaded at the moment it matters** — a gate first, a skill or
   a per-path hook digest second, memory last. Memory is read every session; it is the most
   expensive place for a lesson and the easiest to ignore.
2. **Update or delete before adding.** A retro that only appends grows `MEMORY.md` until every
   session pays for it. The agent must name the entries it checked before proposing `memory-add`,
   and a duplicate or stale entry it finds is an action in its own right.

## Across tickets — every ~10 retros, or when the user asks

Count causes and actions over every RETRO.md since a date and list each `lesson_keys` slug seen in
two or more tickets. **A lesson learned twice is the case for a gate**, not for a sharper
sentence — draft the gate as a new ticket. The same counts are the data for tuning the stop-rule
thresholds (iteration cap, same-failure limit), all of which start as guesses.

## A short retro is a correct retro

When the facts show no signal, the agent writes `causes: none` / `actions: none` and the
orchestrator sets `applied:` straight away — the across-ticket count still includes it. A park
retro is rewritten when the ticket later finishes, keeping its `lesson_keys`.
