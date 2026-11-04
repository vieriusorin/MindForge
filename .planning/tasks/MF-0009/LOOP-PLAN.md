---
phase: 1-planning
ticket_id: MF-0009
status: executing
verdict: IN_PROGRESS
started_at: "2026-11-04"
---

# MF-0009 Daily Walk: plan, iteration 1

## Discovery

- Selection precedent: `pickSessionQuestions` (`src/engine/memory/select.ts`) ranks skills by
  weight × (1 − R) and picks the least recently seen question per skill. `planWalk` reuses the
  same per-skill question choice (extract a private helper inside `src/engine/memory/`).
- "Needs water" owner: `treeStage` (`src/engine/forest/tree-stage.ts`). Walk rule (C-2):
  memory present and (`wilting` or `stage === "seed"`).
- Duel grading (`src/features/duel/actions.ts`): auth → zod → find question → playable check →
  `record_attempt` RPC → reveal key + rationales. The RPC grades, so the key never crosses
  before answering. That body moves to `src/server/attempts/grade-answer.ts` (C-3).
- Duel client is grandfathered (`useTransition` + action, `duel-session` untouched per C-3).
- Reference mutation shape: `create-group-form/hooks/use-create-group-form.ts` (useMutation
  over a Server Action, `isPending` guards double submit).
- `getPackQuestions` is `"use cache"` (file-backed); `getReviewContext` is per-user, uncached.
  `/today` already reads under `<Suspense>`, so adding both reads there is safe.
- Field family has `FieldSet` + `FieldLegend` (installed). No new shadcn component needed.
- Gates: none beyond typecheck / lint / test / build. No migrated-path lists or allowlists.

## SC → steps

| SC | Steps | Proof |
|---|---|---|
| SC-1 | T1 | frozen `mf-0009-plan-walk.acceptance.test.ts` |
| SC-2 | T1, T5 | browser on :3001, N compared with `planWalk` for that user |
| SC-3 | T2, T4, T5 | browser walk + `select count(*) from attempts` before/after |
| SC-4 | T4, T5 | browser, fixture user with every skill recalled 1 h ago |
| SC-5 | T3, T4 | `walk-session.test.tsx` (live region, focus) + browser keyboard run |
| SC-6 | all | receipt (typecheck, lint, test, build) |

## Steps

1. **T1 engine.** `src/engine/memory/plan-walk.ts`: build memory with `memoryBySkill`; per skill
   with ≥ 1 candidate question: tier water / new / strengthen; sort water and strengthen by
   weight × (1 − R) desc then pack order; new = heaviest unseen (pack order on ties); concat
   water, ≤ 1 new, then strengthen only if water + new is non-empty; slice to `WALK_SIZE`.
   `needWaterCount` = water tier length (uncapped). Extract `leastRecentlySeen` from `select.ts`
   into `src/engine/memory/least-recently-seen.ts` and use it in both (existing `select.test.ts`
   stays green = regression proof).
2. **T2 server + types.** Move `AnswerFeedback` to `src/engine/questions/types.ts` (export from
   the barrel); `src/features/duel/types.ts` re-exports it. New
   `src/server/attempts/grade-answer.ts` (`server-only`): `gradeAnswer({ userId, packSlug,
   questionId, chosen })` → `ActionResult<{ feedback: AnswerFeedback }>`. Duel action keeps its
   auth + zod, calls `gradeAnswer`, maps `error` → `message` (Duel's result shape unchanged).
3. **T3 shared card.** `src/components/question-card/` (index, `question-card.tsx`, `types.ts`,
   `utils.ts` with `optionState`, `__tests__/utils.test.ts`). Presentational: meta row slot, stem
   heading (receives `headingRef`), options in `FieldSet` + `FieldLegend` (radio or checkbox),
   per-option rationale after feedback. Imports engine types only (no `features/`).
4. **T4 walk feature.** `src/features/walk/`: `schemas.ts` (`AnswerWalkInput`), `actions.ts`
   (`answerWalkQuestion(input: unknown)`: auth → parse → `gradeAnswer`), `types.ts`
   (`WalkStep` = playable question + reason), `components/walk-session/` (view, types,
   `utils.ts` for reason label + progress text + canSubmit, `hooks/use-walk-session.ts` with
   `useMutation`, refs for focus, live-region text), `__tests__/utils.test.ts`,
   `__tests__/walk-session.test.tsx`. Empty plan → "Your forest is healthy today" + Duel link.
5. **T5 pages.** New `src/app/(app)/play/[packSlug]/walk/page.tsx` (copy Duel page shape, call
   `planWalk`, map to `WalkStep`). `/today`: add `getPackQuestions` + `getReviewContext`, call
   `planWalk`, pass `walk: { needWaterCount, stepCount, href, duelHref }` to `TodayBriefing`,
   which shows the CTA or the healthy message.
6. **T6 verify.** Full gate + build + browser checks (SC-2…SC-5) with local fixture users.

## Riskiest step

T4 focus handling: moving focus to the feedback after the mutation resolves and to the next
question heading after "Next" without behaviour in the view. The hook owns refs and effects; the
view only attaches them. A `ui` test asserts `document.activeElement` both times.

## Rejected options

- Generalising `DuelSession` (absorbs MF-0012; user chose C-3 option A).
- Walk importing `answerQuestion` from `features/duel` (cross-feature import, Duel redirect path,
  legacy result shape).
- nuqs for the walk index: a reload must re-plan from the DB, not resume a stale plan.
- Counting needWater from `summarizeForest.wiltingSkills`: excludes failed seeds (C-2) and skills
  with no playable question.

```json tasks
[
  {"id": "T1", "agent": "service-builder", "owns": ["src/engine/memory/**"], "depends_on": [], "closes": ["SC-1"], "done_when": "frozen acceptance + select.test.ts green", "context": "GOAL Decided-without-a-question order rules"},
  {"id": "T2", "agent": "service-builder", "owns": ["src/server/attempts/**", "src/engine/questions/types.ts", "src/engine/questions/index.ts", "src/features/duel/actions.ts", "src/features/duel/types.ts"], "depends_on": [], "closes": ["SC-3"], "done_when": "typecheck green; Duel action delegates", "context": "C-3"},
  {"id": "T3", "agent": "ui-builder", "owns": ["src/components/question-card/**"], "depends_on": ["T2"], "closes": ["SC-5"], "done_when": "utils test green", "context": "duel-session.tsx markup as source"},
  {"id": "T4", "agent": "ui-builder", "owns": ["src/features/walk/**"], "depends_on": ["T1", "T2", "T3"], "closes": ["SC-3", "SC-4", "SC-5"], "done_when": "walk-session.test.tsx green", "context": "use-create-group-form.ts"},
  {"id": "T5", "agent": "ui-builder", "owns": ["src/app/(app)/play/[packSlug]/walk/page.tsx", "src/app/(app)/today/page.tsx", "src/features/dashboard/components/today-briefing/**"], "depends_on": ["T1", "T4"], "closes": ["SC-2", "SC-4"], "done_when": "build green", "context": "duel page"},
  {"id": "T6", "agent": "verifier", "owns": [], "depends_on": ["T5"], "closes": ["SC-6"], "done_when": "receipt PASS for current tree", "context": ""}
]
```

## Divergences recorded during BUILD / TEST

- `gradeAnswer` returns a closed error code (`GRADE_ERRORS`) instead of a message, so the Duel keeps
  its exact wording ("Start a new duel") and the walk words its own.
- `playableQuestions(questions, review, mode)` added to `src/engine/content/` (+ unit test): one
  owner for the candidate filter that `/today` and the walk page both feed to `planWalk`, so the
  button's count and the walk come from identical input. Duel page left on its inline filter.
- `error.tsx` added for `/play/[packSlug]/walk` (new segment) and `/today` (touched), per
  client-side.md §6; Next 16 prop is `retry`, not `reset`.
- TEST found the sidebar's "Daily Walk · Soon" still disabled; enabled it with its own `walkHref`
  and per-href active state (`app-shell/app-sidebar`, `(app)/layout.tsx`).
- TEST found Radix's roving tab stop carried across questions; fixed with `key={question.id}`.
