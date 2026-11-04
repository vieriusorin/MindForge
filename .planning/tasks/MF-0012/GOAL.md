---
ticket_id: MF-0012
tier: normal                      # UI fixes + script validation; no schema, no authz change
stage: handoff
branch: feat/MF-0012
builds_on: [MF-0003, MF-0009]
last_iteration: 0
goal_status: complete-pending-manual-commit
track: G                          # seat Coder C — warm-up ticket for a new colleague
week: W1–W2
depends_on: [Phase 0]
---

> Drafted 2026-11-03 from the deferred MF-0003 review notes (`.planning/tasks/MF-0003/REVIEW.md`).
> Re-scoped 2026-11-04 at DESIGN: MF-0009 C-3 already built the shared `src/components/question-card/`
> (with `FieldSet`/`FieldLegend`, a focusable stem heading) and the shared `gradeAnswer`; this ticket
> moves the Duel onto them instead of patching the Duel's own markup.

## Objective

**Today.** The Duel works, but its MF-0003 review left debt:
- a double click on "Check answer" can call the action twice (`use-duel-session.ts:50` has no in-flight guard);
- the verdict `<output>` is mounted already filled, focus is lost on the check → next swap, and
  `aria-labelledby` sits on a plain `div`;
- the multi-select options use a raw `<fieldset>`/`<legend>`;
- "Back to your forest" goes to `/groups`, not the group the duel was opened from;
- `scripts/sync-question-keys.mjs` parses the YAML itself and syncs files the app's validator rejects
  (e.g. a `javascript:` source url, `select` ≠ number of correct options), writing pack by pack, so a
  bad file mid-run leaves the DB half-synced;
- `duel-session` is grandfathered on `useTransition` + a bare action (state-and-data §Migration).

**End state.** Those notes are closed, the Duel renders through the shared `QuestionCard` and
`useMutation` like the Walk, and it is the reference the other modes copy.

## Affected

- **Roles:** learner (keyboard and screen-reader users especially).
- **Surfaces:** `/play/[packSlug]/duel`, the "Play Scenario Duel" link on `/groups/[groupId]`;
  `src/features/duel/**`, `src/components/question-card/` (card labelling only),
  `scripts/sync-question-keys.mjs` (+ a resolve hook in `scripts/lib/`).
- **Tables:** none changed. `private.packs`, `private.question_keys`, `private.items` are written by the
  script (unchanged statements); `attempts` via the unchanged `record_attempt`.

## Constraints

- shadcn only; `FieldSet`/`FieldLegend` are already installed (`src/components/ui/field.tsx`).
- No behaviour in a presentational `.tsx` (react-client-patterns rule 1).
- Writes from a client component go through `useMutation` over a Server Action that re-parses `unknown`
  and returns `ActionResult` (state-and-data §1, §3). Touching `duel-session` means migrating it.
- URL state (the source group) is a nuqs parser in `src/features/duel/search-params.ts` (state-and-data §5).
- The sync script stays plain `node` (MF-0007: no TS toolchain at deploy time) and adds no dependency.
- Do not touch `src/features/seed-planting/**` (Coder D, KICKOFF) or the Walk's hook.

### Constraints → how met

| Constraint | How met |
|---|---|
| shadcn only | the shared `QuestionCard` (already `FieldSet` + `FieldLegend`); no new primitive |
| No behaviour in view | `use-duel-session.ts` holds state, mutation, focus effects; `duel-session.tsx` only binds props |
| `useMutation` + `ActionResult` | `answerQuestion(input: unknown)` re-parses with `@/lib/answer-input` (shared with Walk/Seed), returns `ActionResult<{ feedback }>` |
| nuqs for the source group | `duelSearchParams` (`from`, uuid) + `createLoader` in `search-params.ts`; the RSC page reads it; the group page builds its link with the serializer |
| Plain node, no new dep | `engines.node >= 24` → native type stripping; a ~15-line `module.register` resolve hook maps the engine's extensionless relative imports to `.ts`. Checked at DESIGN: it loads `ccdv-f` (53 questions, 1 card, 2 diagrams) |

## Decided without a question

- The back link returns to the group the duel was opened from (`?from=<groupId>`), else `/today`. A
  `from` that is not a UUID is ignored → `/today` (source: original GOAL draft; no open redirect).
  The page does not check membership: a non-member following a forged link lands on the group page's own
  `notFound()`, which leaks nothing.
- The sync script validates **every** pack (pack.yaml + questions + cards + diagrams through
  `loadPackFile` + `loadPackContent`, the app's own loaders) **before it opens the DB connection**, and
  exits 1 listing the issues. Row derivation and `contentHash` stay as they are: hashing the parsed
  objects instead of the raw YAML could change hashes and reset review state (MF-0007).
- Pack folder override for tests: `MINDFORGE_PACKS_DIR`. The script refuses it when `SUPABASE_DB_URL` is
  set (a partial folder would unregister hosted packs).
- Double-submit guard: a ref set synchronously in `submit` and cleared on settle, not only
  `mutation.isPending` (TanStack notifies observers on a later tick, so two clicks before the re-render
  both see `isPending === false`).
- Card labelling: `QuestionCard`'s `Card` gets `role="group"` so its `aria-labelledby` (the stem `h2`)
  is a valid name. A generic `div` cannot be named (ARIA 1.2 prohibits naming on `generic`).
- SC-7's "component-split gate" does not exist (`react-client-patterns.md`: "No gate enforces it yet");
  the split is checked in the diff review instead.

## Decided by the user

- 2026-11-04 C-1: Duel only. A follow-up GOAL for the same guard in Walk + Seed Planting is drafted at hand-off.
- 2026-11-04 C-2: `role="group"` goes on the shared `QuestionCard`; Walk and Seed Planting tests are re-run.
- 2026-11-04 C-3: all three deferred notes become drafted follow-up GOALs at hand-off (next free numbers).
- Preflight 2026-11-04: `pnpm typecheck`, `pnpm lint`, `pnpm test` (56 files / 213 tests) green on a5da410.
  No proof needs `db:reset` / `supabase stop|start`. SC-5's DB test writes to the local stack only in its
  RED run (registers a fixture pack `mf0012-broken`, bumps `updated_at` on real rows); `afterAll` deletes
  the fixture rows child-first.
- 2026-11-04 SC-6 withdrawn (conflicts with `server-side.md` §2; see the SC).

## Success Criteria

- [x] SC-1: Two `submit()` calls before a re-render call the answer action once. Proof: frozen hook test
  (`renderHookWithProviders`, action mocked at `@/features/duel/actions`) + browser: double click
  "Check answer", `attempts` row count for that user/question goes up by exactly 1.
- [x] SC-2: The verdict live region is in the DOM and empty before grading, holds the verdict after it;
  focus moves to the verdict after grading, and to the next question's stem after "Next question".
  Proof: frozen component test (`document.activeElement`, region text) + browser a11y snapshot.
- [x] SC-3: The options are a group named "Options" (`FieldSet` + `FieldLegend`), and the question card is
  a group named by its stem. Proof: frozen component test (`getByRole("group", { name })`) + a11y snapshot.
- [x] SC-4: A duel opened from `/groups/<id>` links back to `/groups/<id>` ("Back to the group"); opened
  without a valid `from`, it links to `/today` ("Back to your forest"). Proof: frozen unit test of the
  back-link decision + browser from a real group page.
- [x] SC-5: `pnpm db:sync-keys` over a pack folder holding one schema-invalid question file exits non-zero
  and leaves `private.packs`, `private.question_keys`, `private.items` byte-identical (every column,
  `updated_at` included). Proof: frozen DB test against the local stack.
- [x] ~~SC-6: `fetch-attempts.ts` imports `server-only`.~~ **Withdrawn 2026-11-04 by the user**: it conflicts
  with `server-side.md` §2, which names `fetch-attempts.ts` as an exception (`server-only` throws under
  Vitest; `fetch-attempts.db.test.ts` imports it). The MF-0003 note closes as accepted by that rule.
- [x] SC-7: `pnpm typecheck && pnpm lint && pnpm test && pnpm test:db && pnpm build` pass. Proof: receipt.

## Concerns

| # | Concern | Owner | Status |
|---|---|---|---|
| C-1 | The Walk (`use-walk-session.ts`) and Seed Planting have the same same-tick double-submit hole (guard is `isPending` only). Seed Planting is Coder D's; the Walk is this seat's. | user | resolved 2026-11-04: Duel only; follow-up GOAL |
| C-2 | `role="group"` on the shared `QuestionCard` changes the a11y tree of the Walk and Seed Planting too (an added, correctly named group). | user | resolved 2026-11-04: on the shared card |
| C-3 | Three deferred MF-0003 notes are not in this ticket: learn-the-key-then-answer (sprout only), the cross-pack `question_id` PK (a migration), orphaned keys of a removed pack. | user | resolved 2026-11-04: follow-up GOALs |

## Out of Scope

- Stale-key vs cached-feedback mismatch (goes away when MF-0004's runbook syncs keys on every deploy; revisit if seen).
- The three C-3 notes (follow-up GOALs).
- The Walk / Seed Planting double-submit guard (follow-up GOAL); their only change here is C-2's card role.

## Open questions

- none.

## Iteration Log

<!-- append-only -->
- 2026-11-04 iteration 1: DESIGN re-scoped onto MF-0009's shared card; C-1..C-3 + SC-6 settled by the user;
  3 files frozen red; BUILD per LOOP-PLAN (no divergence); TEST receipt DONE (tree db086d6a…). Follow-ups
  MF-0022..MF-0025 reserved.
