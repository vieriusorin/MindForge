---
ticket_id: MF-0001
outcome: complete
causes: [sc-wrong, tooling]
actions: [memory-add]
lesson_keys: [derived-facts-from-source, zsh-word-splitting]
applied: yes
written_by: main session (inline; no fresh-context retro agent was run)
---

## Right

- Freezing the acceptance tests before writing code caught a spec error. The SC-1 test encoded "27 skills", but the source-copied pack had 25. The test failed for a real reason rather than passing quietly.
- Proving each check could fail (the original copied hooks fail the checker; a type-error probe blocks the Stop gate) made SC-8 real, not just "exit 0".
- Delivering the thinnest slice first, with no DB, auth or AI, avoided blocking on the open ❓ decisions.

## Wrong

- **sc-wrong:** I computed "27 skills" myself when writing the spec and never checked it against the Exam Guide. It spread to the spec, GOAL, plan and a frozen test, and cost one re-freeze plus a user question.
- **tooling:** a zsh loop over `$F="a b"` didn't split the words. The formatter did nothing, yet a FROZEN.json history entry was written claiming a format change. It was caught and rewritten before use, but it was briefly a false record.

## Cause

`sc-wrong`: a derived number (a sum or count) was treated as a fact without re-deriving it from the source.
`tooling`: a shell idiom that behaves differently in zsh and bash.

## Actions

1. memory-add `feedback-verify-derived-facts`: before writing a count, sum or weight into a spec, SC or frozen test, re-derive it from the source document in that same step. *(applied)*
2. (none: the zsh lesson is generic. It goes in the same memory entry as "check that a write step actually changed what its record claims".)
