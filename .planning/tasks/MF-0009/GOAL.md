---
ticket_id: MF-0009
tier: normal                      # engine selection + UI; reuses MF-0003 grading, no schema
stage: handoff
branch: feat/MF-0009
builds_on: []
last_iteration: 1
goal_status: complete-pending-manual-commit
track: G                          # seat Coder C
week: W2
depends_on: [Phase 0]
independent: true                # playable filter via MF-0006 seam; MF-0010 embeds its seed step later
---

> Drafted 2026-11-03 from the planning grill (Q11). Claimed 2026-11-04; SCs refined in DESIGN
> (see "Decided without a question" for every change to the draft).

## Objective

Today a learner has to choose the Duel and gets 5 questions picked by weight; nothing tells them
"these trees need water today", which is the core habit of the product (MINDFORGE §2.2).

End state: `/today` has one main action, "Start today's walk", showing how many trees need water.
The walk serves up to 10 questions: trees that need water first, then at most one new skill as an
inline Seed Planting step, then the weakest skills not yet due. When nothing needs water and every
skill has been met, `/today` says "Your forest is healthy today" and offers the Duel instead.

## Affected

- **Roles:** learner.
- **Surfaces:** `src/engine/memory/plan-walk.ts` (walk selection), `src/features/walk/**`,
  `src/app/(app)/today/page.tsx`, `src/app/(app)/play/[packSlug]/walk/page.tsx`, the briefing
  banner (`src/features/dashboard/components/today-briefing/`), shared grading
  (`src/server/attempts/`), a shared question card (`src/components/question-card/`).

## Constraints

- Every figure (trees that need water, walk length) comes from the engine → `planWalk` returns the
  counts; the page passes them as props; no arithmetic in components (ui-design §3.7).
- Answers go through the existing `record_attempt`; the key never reaches the browser before
  answering → the walk serves `toPlayableQuestion` copies and grades through the same server
  function as the Duel.
- Serves only playable items (CONTEXT.md) → candidates filtered with `isPlayable(…, "practice")`
  as the Duel page does; unreviewed items show the badge; memory still replays every attempt.
- New client code follows `state-and-data.md` → `useMutation` over a Server Action, `useState` only
  for the walk's step; no `useTransition` + action.

## Decided without a question

- Walk = up to 10 questions, **one question per skill**, the least recently seen question of that
  skill (same rule as `pickSessionQuestions`). Repeat walks allowed; no streak or bonus (Q11).
- Order: (1) skills that need water, ranked by weight × (1 − R), ties in pack order; (2) at most one
  unseen skill (the heaviest, ties in pack order); (3) seen skills not due, ranked by
  weight × (1 − R). Filled in that order until 10; if (1) fills 10, no new skill is served.
- Tier (3) only pads a walk that already has a tier-(1) or tier-(2) item; otherwise the plan is
  empty (draft SC-1: "empty plan when nothing is due and every skill is seen").
- A skill with no playable question is skipped in every tier and is not counted as needing water
  (the button's number promises questions the walk can serve).
- The plan is fixed when the walk page renders; answering during the walk does not re-plan.
- SC-1 signature changed from `planWalk(memory, questions, now)` to
  `planWalk({ pack, questions, attempts, now })`: weights and pack order live in the pack, and the
  per-skill question choice needs attempts (precedent: `pickSessionQuestions`, `select.ts:20`).
- After each answer: feedback with every option's rationale, as in the Duel.
- Until MF-0010 lands, the new-skill slot is a plain question from that skill, labelled "New seed".
- `needWaterCount` counts every need-water skill with a playable question, uncapped (14 trees can
  need water while the walk serves 10); the walk length is the plan's item count.
- Walk progress (which question) is ephemeral `useState`: a reload re-plans from the DB, which is
  correct because answered skills have moved.
- Baseline at DESIGN (2026-11-04): `pnpm typecheck` 0, `pnpm lint` 0, `pnpm test` 30 files /
  103 tests pass. No proof needs `db:reset`, `supabase stop/start`: SC-3/SC-4 write attempts for
  dedicated local test users only.

## Success Criteria

- [x] SC-1: `planWalk` (fixed clock) returns: need-water skills (wilting, or attempted but never
  recalled) first by weight × (1 − R); ≤ 1
  unseen skill, after them; then not-due skills; ≤ 10 items, one per skill; skips skills without a
  playable question; and an empty plan (counts 0) when nothing needs water and every skill with a
  question is seen. Proof: `src/engine/memory/__tests__/mf-0009-plan-walk.acceptance.test.ts`.
- [x] SC-2: `/today`'s briefing banner shows "Start today's walk" with "N trees need water", N from
  `planWalk`, linking to `/play/<pack>/walk`. Proof: browser on local stack, N compared to the
  engine's count for that user.
- [x] SC-3: A full walk on the local stack records every answer as an attempt (row count grows by
  the walk length) and `/today` reflects it afterwards. Proof: browser + DB row count.
- [x] SC-4: With nothing to water and every skill seen, `/today` says "Your forest is healthy
  today" and offers the Duel; `/play/<pack>/walk` says the same. Proof: browser with a fixture user.
- [x] SC-5: Keyboard-only walk works; feedback is announced by a live region mounted empty then
  filled; focus moves to the feedback after "Check answer" and to the next question after "Next".
  Proof: browser + a11y snapshot; `ui` test of the walk component.
- [x] SC-6: typecheck, lint, tests, build pass; component folders follow react-client-patterns.
  Proof: receipt in LOOP-VERIFY.md.

## Concerns

| # | Collision | Owner | Status |
|---|-----------|-------|--------|
| C-1 | The walk exposes a "new skill" slot that renders a plain question. Whichever of MF-0009 / MF-0010 merges **second** swaps that slot for the Seed Planting component (a few lines). | Coder C + Coder D | resolved 2026-11-03 |
| C-2 | "Needs water" = forest `wilting` excludes seeds, so a skill attempted but never recalled is neither due nor new: a learner who failed everything would be told "healthy". | user | resolved 2026-11-04: needs water = wilting trees **plus** attempted-but-never-recalled seeds (`treeStage` wilting, or stage seed with memory). The banner's N may exceed the dashboard's wilting count; both come from the engine. |
| C-3 | The walk needs the Duel's question card and grading; MF-0012 is about to rework the Duel's card. Touching `duel-session` means migrating it (state-and-data §Migration), which is MF-0012's scope. | user | resolved 2026-11-04: shared presentational `src/components/question-card/` + shared grading in `src/server/attempts/`; the Duel's action delegates to the shared grading, `duel-session` is not touched; MF-0012 moves the Duel onto the card. |

## Out of Scope

- Notifications, streaks, time-of-day reminders.
- Duel changes beyond delegating its grading to the shared function (MF-0012).
- The Seed Planting step itself (MF-0010).

## Open questions

- none.

## Iteration Log

<!-- append-only -->
- 2026-11-04 · iteration 1 · DESIGN: claimed, SCs refined, C-2/C-3 resolved by the user, SC-1 frozen
  red 9/9. BUILD: planWalk, shared gradeAnswer + QuestionCard, walk feature, /today CTA, sidebar
  link. TEST: receipt PASS (133 tests, build); browser SC-2…5 PASS; one bug found (roving tab stop
  kept across questions), regression test shown red, fixed with `key`. Hand-off.
