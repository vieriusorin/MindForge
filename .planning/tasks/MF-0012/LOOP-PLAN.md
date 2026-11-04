---
ticket_id: MF-0012
iteration: 1
---

## Discovery

- Precedent: MF-0009 `src/features/walk/components/walk-session/` (shared `QuestionCard`, `useMutation`
  over `answerWalkQuestion(input: unknown)`, verdict `<output aria-live>` mounted empty, focus effects).
  The Duel copies it and adds the in-flight ref guard.
- `@/lib/answer-input` (`AnswerInput`) is already shared by Walk and Seed Planting → the Duel's action
  uses it; the Duel's inline `AnswerInput` is deleted.
- `QuestionCard` (`src/components/question-card/question-card.tsx:102`) puts `aria-labelledby` on a
  `div` → add `role="group"` (C-2).
- No `search-params.ts` exists yet; this is the first (nuqs skill §1, server-read param only).
- Engine `pack` / `content` / `questions` use only relative extensionless imports (no `@/`), so Node 24
  type stripping + a resolve hook loads them (checked: ccdv-f 53 / 1 / 2).
- Gates: no `gate:*` scripts; no component-split gate. Frozen files: see FROZEN.json.

## SC → steps

| SC | Steps | Proof |
|---|---|---|
| SC-1 | 4 | frozen hook test + browser row count |
| SC-2 | 4, 5 | frozen component test + a11y snapshot |
| SC-3 | 3, 5 | frozen component test + a11y snapshot |
| SC-4 | 1, 2, 6, 7 | frozen unit test + browser |
| SC-5 | 8, 9 | frozen DB test |
| SC-7 | all | receipt |

## Steps

1. `src/features/duel/utils/back-link.ts`: `duelBackLink(from)` → `/groups/<uuid>` "Back to the group" when
   `z.uuid()` accepts `from`, else `/today` "Back to your forest".
2. `src/features/duel/search-params.ts` (`nuqs/server`): `duelParsers = { from: parseAsString }`,
   `loadDuelParams`, `serializeDuel`.
3. `src/components/question-card/question-card.tsx`: `role="group"` on the `Card`.
4. `src/features/duel/actions.ts`: `answerQuestion(input: unknown)` → auth → `AnswerInput.safeParse` →
   `gradeAnswer` → `ActionResult<{ feedback }>` (`types.ts`: `AnswerQuestionResult`, drop `AnswerResult`).
   `hooks/use-duel-session.ts`: `useMutation`, `inFlight` ref set in `submit`, cleared `onSettled`;
   score/answered tallied in `onSuccess`; verdict + stem + finish focus effects as in the Walk.
5. `duel-session.tsx`: render `QuestionCard` (keyed by question id) with meta + footer (`<output>` live
   region always mounted, error, source link, buttons); finish heading focusable.
6. `src/app/(app)/play/[packSlug]/duel/page.tsx`: `loadDuelParams(searchParams)` inside `DuelSlot`
   (already under Suspense) → `back={duelBackLink(from)}`.
7. `src/app/(app)/groups/[groupId]/page.tsx`: duel link `…/duel${serializeDuel({ from: group.id })}`.
8. `scripts/lib/ts-resolve.mjs`: resolve hook — extensionless relative specifier from a `.ts` parent →
   `.ts` / `/index.ts`; any `.ts` url gets `format: "module-typescript"`.
9. `scripts/sync-question-keys.mjs`: `validatePacks()` loads every pack via `loadPackFile` +
   `loadPackContent` (imported through the hook) and exits 1 with the issues **before** `postgres()`.

## Riskiest step

Step 9: the script is the deploy path for hosted keys. If validation wrongly rejects the real packs, a
deploy can't sync keys. Mitigation: the real `packs/` load cleanly today (checked), and a plain
`pnpm db:sync-keys` on the local stack runs in TEST. No row derivation or hash changes (MF-0007 hashes
stay byte-identical). No versioned-judgement write is added (the action path is unchanged `gradeAnswer`).

## Rejected options

- `tsx` / `jiti` dependency to import TS: a new dep for what Node 24 does natively (`engines.node >= 24`).
- Hashing parsed objects in the script: could change content hashes and reset review state.
- Guard by `mutation.isPending` only (Walk's way): fails SC-1, observers update a tick late.
- Validating `from` in a custom nuqs parser: the decision would be split between parser and link; one
  owner (`duelBackLink`) is simpler to test.
- An opt-in prop for the card role (C-2: user chose the shared card).

```json tasks
[
  {"id":"T1","agent":"ui-builder","owns":["src/features/duel/**","src/components/question-card/question-card.tsx","src/app/(app)/play/[packSlug]/duel/page.tsx","src/app/(app)/groups/[groupId]/page.tsx"],"depends_on":[],"closes":["SC-1","SC-2","SC-3","SC-4"],"done_when":"frozen mf-0012-duel + mf-0012-back-link green; walk/seed tests green","context":"steps 1-7; run inline"},
  {"id":"T2","agent":"service-builder","owns":["scripts/sync-question-keys.mjs","scripts/lib/ts-resolve.mjs"],"depends_on":[],"closes":["SC-5"],"done_when":"frozen mf-0012-sync-keys.db green; plain pnpm db:sync-keys still syncs local","context":"steps 8-9; run inline"},
  {"id":"T3","agent":"verifier","owns":[],"depends_on":["T1","T2"],"closes":["SC-7"],"done_when":"receipt PASS for current tree","context":"typecheck, lint, test, test:db, build, browser"}
]
```
