# Research mode — answer questions with evidence before asking them

`grill-with-docs` finds the questions. This decides **who answers each one**: evidence, or a person.
Use it in DESIGN (interactive: the user confirms instead of composing answers) and whenever a
question arises later (autonomous: the only way forward short of parking).

Turn it on with `/gsd-goal-loop <ID> --research`, or say "research mode" during a grill. It is
always on with `--autonomous`.

## 1. Triage every open question — the closed table

| kind | example | goes to |
|---|---|---|
| `code` | "how does the billing service split a charge across periods today?" | `researcher` (repo only) → `research-interpreter` |
| `library` | "does library X v2 support option Y?" | `researcher` (context7, installed version) → interpreter |
| `external` | "what does the applicable regulation say about Z?" | `researcher` (primary sources) → interpreter — legal answers are never more than `recommend` |
| `decision` | "should role A see records of type B?", "round per day or per month?" | **the user, directly** — evidence can inform it, never settle it |

If in doubt between `decision` and anything else, it is a `decision`. Without researcher agents,
do the gathering and interpreting yourself, but keep the two steps and the written note.

## 2. The pipeline per research question

```
Q-n  → Agent(researcher, kind)          writes research/Q-n.md: findings, sources, quotes, conflicts
     → Agent(research-interpreter)      appends: answer, class, confidence, what would change it
     → orchestrator applies the class:
         answered     → apply; GOAL.md "Decided without a question": <answer> — research/Q-n.md
         recommend    → interactive: ask the user with the recommendation pre-selected
                        autonomous: apply ONLY if reversible and not high-risk; GOAL.md
                        "Decided by research — review" (the run report lists these)
         needs-human  → interactive: AskUserQuestion with the interpreter's options + evidence
                        autonomous: PARK (references/autonomous.md)
```

Independent questions run as parallel researcher agents; each interpreter waits only for its own
researcher. Number questions in the order they were raised; never reuse a number.

## 3. Asking the user, when it comes to that

One AskUserQuestion per decision, built from the interpreter's block: the options it listed, its
recommendation first and marked "(Recommended)", and the evidence in the description — so the
user is choosing, not researching. Record the answer in GOAL.md with `— user, <date>`.

## 4. Keep the class line — the retro counts it

The retro (`references/retro.md`) reads the research notes' classes: many `needs-human` answers on
one ticket means DESIGN asked too late or the brief was a decision in disguise. Keep the
`- class:` line on every interpretation so it can be counted.

## 5. In PLAN — discovery without filling the orchestrator's context

Research is not only for DESIGN's questions. In Stage 3a, wide reads — "how does the repo do X
today", "which ticket solved this shape", "every caller of Y", "which gates cover these paths" —
go to `researcher` with `kind: code` and the question phrased so a list of file:line claims
answers it. Skip the interpreter: a code finding with a file:line is the answer.

The orchestrator still reads, itself and whole: every file the plan will change, and anything
HIGH_RISK (schema, authz, access policy, money and derived figures). A summary is how a detail
goes missing, and those are the files where a missing detail costs the most.

Number these `Q-n` like any other research question, so the retro can see what discovery cost.

## 6. What research mode never does

- Settle a business rule with two defensible answers. That is a configurable setting, and
  proposing it is the user's call.
- Override a Key Decision or an Out-of-Scope fence because a web page disagrees.
- Treat its own `recommend` as `answered` to save a park.
