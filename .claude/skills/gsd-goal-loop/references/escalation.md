# Escalation

The playbook: *humans remain accountable for every decision that requires judgment*, and a
concern reaches engineering only once its owner has resolved it. The course leaves stopping
rules to each team. These are this repo's.

Escalating is cheap: one question, a recommendation, nothing changed yet. Guessing is expensive:
a wrong pontaj or cost figure gets exported, paid and audited before anyone notices.

## Stop and ask — the triggers

| Trigger | Why it is not yours to decide | Owner |
|---|---|---|
| A business rule with two defensible answers (pay basis, rounding, which day counts) | P4T may be sold to other companies — the answer is usually an Administrator setting, and choosing that is a product call | user |
| The brief crosses a `PROJECT.md` **Out of Scope** fence | a fence is a recorded decision | user |
| The change needs a new **Key Decisions** entry: a `getServiceDb` caller, an unscoped `db` caller, a public token route, a receiver-initiated transfer, a new integration | the allowlists are ceilings, and every addition must be justified | user |
| The RBAC matrix is silent or ambiguous for the case, or one of its open items (Șef Flotă "DOAR AUTO", "DOAR CE FOLOSEȘTE") | `RBAC-MATRIX.md` is client-provided acceptance criteria | client, via the user |
| Something listed as open in `QA-STAKEHOLDER.md` (concediu accrual, carry-over) | stakeholder answer | client, via the user |
| An SC turns out wrong or impossible as written | SCs are frozen at DESIGN | user |
| The same SC fails twice in a row | the plan is missing something the code will not reveal | user |
| Passing would mean editing a test, a gate, or an allowlist | that defeats the feedback loop | user |
| A pontaj / cost / diurnă figure changes for data already exported | retroactive change to a report someone was paid from | user |
| Any write to the dev clone, staging or prod DB; a destructive operation on the test stack's shared data | shared state; the dev clone is the source of truth | user |
| A required step needs a secret, a real external send, or the user's browser session | outward-facing or not yours | user |
| The ticket number, or a file you must change, is being worked by another session | sessions share one worktree | user |
| A blocking ticket is not done (`builds_on` uncommitted and broken) | ordering | user, or that ticket |

## Do NOT escalate — decide and record

- Anything that follows from an existing decision, ticket or code fact. Write it under GOAL.md
  "Decided without a question" with its source.
- Naming, file placement, test shape, a refactor confined to the ticket's files.
- Which of two equivalent implementations to use — pick, put the other under Rejected options.
- A pre-existing failure outside the diff — note it in LOOP-VERIFY, carry on.
- A conventional default the skills already state (Field family for forms, TanStack Table, the
  shadcn CLI, `MonthPicker` over a month input).

## How to escalate

1. Stop at a clean point: nothing half-applied. Record `stage:` and the state in GOAL.md.
2. Set `goal_status: blocked-on-<owner>` (`user`, `client`, or the blocking `PT-####`).
3. Ask once, with the shape in `templates.md`: the blocker in one sentence, the evidence, two or
   three options with consequences, your recommendation. Use `AskUserQuestion` when the options
   are discrete; recommended option first.
4. For a client question, write it as the client will read it — in plain terms, in Romanian if
   it will be forwarded — and add it to GOAL.md Open questions with owner `client`.
5. On the answer: record it under "Decided without a question" (now decided, with the date and
   who answered), set `goal_status: in-progress`, and resume at the recorded stage. If the
   answer is a lasting rule, it belongs in `PROJECT.md` Key Decisions — propose the entry; the
   developer commits it.

## Severity of findings (from a reviewer, or found while testing)

| Severity | Meaning | Action |
|---|---|---|
| **Important** | breaks behaviour, leaks data (PII, `tarif_orar`, another role's rows), wrong figure, breaches a CLAUDE.md invariant | fix in this ticket, or escalate if out of scope |
| **Nit** | style, naming | at most five; fix only if cheap |
| **Pre-existing** | real, not this diff | name it in the hand-off; propose a ticket |

## After the hand-off — WATCH

Anything found on staging after the push becomes a **new ticket's GOAL.md**, drafted and handed
to the user to triage (fix now / schedule / dismiss). Never patch it in place under the old
ticket, and never act on prod: no rollback, migration or env change. Rollback is the developer's
call through Vercel.
