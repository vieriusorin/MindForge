---
ticket_id: MF-0012
tier: normal                      # UI fixes + script validation; no schema
stage: design
branch: main
builds_on: []
last_iteration: 0
goal_status: reserved
track: G                          # seat Coder C — warm-up ticket for a new colleague
week: W1–W2
depends_on: [Phase 0]
---

> Drafted 2026-11-03 from the deferred MF-0003 review notes (`.planning/tasks/MF-0003/REVIEW.md`).
> Good first ticket: small, well-defined, touches the whole stack lightly.

## Objective

The Duel works, but its review left debt: a double click can submit twice, screen-reader users lose
their place, the form uses raw HTML instead of shadcn, the back link goes to the wrong page, and the
key-sync script trusts files it hasn't validated.

End state: those notes are closed, and the Duel is the reference implementation the other modes copy.

## Affected

- **Roles:** learner (keyboard and screen-reader users especially).
- **Surfaces:** `src/features/duel/**`, `scripts/sync-question-keys.mjs`, `src/server/memory/fetch-attempts.ts`.

## Constraints

- shadcn only: add `field` sub-components via the CLI if `FieldSet`/`FieldLegend` are missing.
- No behaviour in the presentational `.tsx` (react-client-patterns).

## Decided without a question

- The back link returns to the group the duel was opened from (passed as a search param), else `/today`.
- The sync script runs the same loader/validator as the app and aborts before writing on any error.

## Success Criteria

- [ ] SC-1: A double click on "Check" records one attempt. Proof: hook logic in a tested util + browser check of DB row count.
- [ ] SC-2: Feedback is announced by a live region that is mounted empty and then filled; focus moves to the feedback, then to the next question. Proof: browser + a11y snapshot.
- [ ] SC-3: The options group uses shadcn `FieldSet` + `FieldLegend`; the card is labelled by its stem. Proof: code + a11y snapshot.
- [ ] SC-4: Back link goes to the source group. Proof: browser.
- [ ] SC-5: `pnpm db:sync-keys` with a broken question file exits non-zero and changes no row. Proof: script test.
- [ ] SC-6: `fetch-attempts.ts` imports `server-only`. Proof: code.
- [ ] SC-7: Component-split gate, typecheck, lint, tests, build pass. Proof: receipt.

## Concerns

- none.

## Out of Scope

- Stale-key vs cached-feedback mismatch (goes away when MF-0004's runbook syncs keys on every deploy; revisit if seen).

## Open questions

- none.

## Iteration Log

<!-- append-only -->
