# Escalation

The playbook: *humans remain accountable for every decision that requires judgment*, and a
concern reaches engineering only once its owner has resolved it. The course leaves stopping
rules to each team. These are the defaults; a project may add its own.

Escalating is cheap: one question, a recommendation, nothing changed yet. Guessing is expensive:
a wrong figure gets exported, paid, billed or audited before anyone notices.

## Stop and ask — the triggers

| Trigger | Why it is not yours to decide | Owner |
|---|---|---|
| A business rule with two defensible answers (rounding, which period counts, the basis of a rate) | the answer is usually a configurable setting, and choosing that is a product call | user |
| The brief crosses a PROJECT_DOC **Out of Scope** fence | a fence is a recorded decision | user |
| The change needs a new **Key Decisions** entry: a privileged / unscoped DB client, a public token route, a new integration, a new allowlist entry | allowlists are ceilings, and every addition must be justified | user |
| ACCESS_DOC is silent or ambiguous for the case | access rules are acceptance criteria someone else owns | stakeholder, via the user |
| Something recorded as an open stakeholder question | stakeholder answer | stakeholder, via the user |
| An SC turns out wrong or impossible as written | SCs are frozen at DESIGN | user |
| The same SC fails twice in a row | the plan is missing something the code will not reveal | user |
| Passing would mean editing a test, a gate, or an allowlist | that defeats the feedback loop | user |
| A derived figure changes for data already exported or reported | retroactive change to something people acted on | user |
| Any write to a dev, staging or prod DB; a destructive operation on shared test data | shared state | user |
| A required step needs a secret, a real external send, or the user's browser session | outward-facing or not yours | user |
| The ticket number, or a file you must change, is being worked by another session | sessions may share one worktree | user |
| A blocking ticket is not done (`builds_on` uncommitted and broken) | ordering | user, or that ticket |

## Do NOT escalate — decide and record

- Anything that follows from an existing decision, ticket or code fact. Write it under GOAL.md
  "Decided without a question" with its source.
- Naming, file placement, test shape, a refactor confined to the ticket's files.
- Which of two equivalent implementations to use — pick, put the other under Rejected options.
- A pre-existing failure outside the diff — note it in LOOP-VERIFY, carry on.
- A conventional default the project's skills already state.

## How to escalate

1. Stop at a clean point: nothing half-applied. Record `stage:` and the state in GOAL.md.
2. Set `goal_status: blocked-on-<owner>` (`user`, `stakeholder`, or the blocking `<ID>`).
3. Ask once, with the shape in `templates.md`: the blocker in one sentence, the evidence, two or
   three options with consequences, your recommendation. Use `AskUserQuestion` when the options
   are discrete; recommended option first.
4. For a stakeholder question, write it as they will read it — plain terms, in their language if
   it will be forwarded — and add it to GOAL.md Open questions with that owner.
5. On the answer: record it under "Decided without a question" (with the date and who answered),
   set `goal_status: in-progress`, and resume at the recorded stage. If the answer is a lasting
   rule, propose a PROJECT_DOC Key Decisions entry; the developer commits it.

## Severity of findings (from a reviewer, or found while testing)

| Severity | Meaning | Action |
|---|---|---|
| **Important** | breaks behaviour, leaks data (PII, sensitive financial fields, another role's rows), wrong figure, breaches a CLAUDE.md invariant | fix in this ticket, or escalate if out of scope |
| **Nit** | style, naming | at most five; fix only if cheap |
| **Pre-existing** | real, not this diff | name it in the hand-off; propose a ticket |

## After the hand-off — WATCH

Anything found after the push becomes a **new ticket's GOAL.md**, drafted and handed to the user
to triage (fix now / schedule / dismiss). Never patch it in place under the old ticket, and never
act on prod: no rollback, migration or env change. Rollback is the developer's call.
