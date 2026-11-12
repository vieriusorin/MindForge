---
phase: 1-verification
ticket_id: MF-0066
status: complete
verdict: PASS
started_at: "2026-11-07"
completed_at: "2026-11-07"
resume_with: /gsd-goal-loop
---

# Verification — Iteration 1

## RED at freeze (Stage 2b)

| SC | Acceptance test | Red reason at freeze (pasted) |
|----|-----------------|-------------------------------|
| SC-1 | `mf-0066-order-schema.acceptance.test.ts` | `Error: not implemented` / `expected Error: not implemented to be an instance of ContentValidationError` — `parseOrders`, `loadPackOrders` are stubs (19/19) |
| SC-2 | `mf-0066-order-keys.db.acceptance.test.ts` | `PostgresError: column "ordered" does not exist`; `expected { data: null, code: 'P0002' } to deeply equal { data: true, code: null }` (no order key synced); items probe: `order` refused 23514; bad order: sync exit 0. 6/7 red; question set-equality case green by design (regression lock). 2nd run identical after `pnpm db:reset` |
| SC-3, SC-4, SC-9 (engine) | `mf-0066-order-engine.acceptance.test.ts` | `Error: not implemented` (toPlayableOrder, checkOrderAnswer, isOrderServable); `expected null to deeply equal { kind: 'order', item: … }`; `expected {} to deeply equal { Object (mf66.D.S1.order-turn) }` (22/22) |
| SC-5 | `mf-0066-order-plan.acceptance.test.ts` | `expected undefined to be 'o1'` (plan.order stub null); `Error: not implemented` (lessonSteps). 10/11 red; `LESSON_STEP_KINDS` contains `order` green (the stub widened the closed set to keep typecheck green) |
| SC-6 | `mf-0066-order-grounding.acceptance.test.ts` | `Error: not implemented` (checkOrderFile stub) (5/5) |
| SC-7, SC-8 | `mf-0066-order-step.acceptance.test.tsx` | `Error: not implemented` (OrderStep throws in render); `expected [] to deeply equal [ { kind: 'order', order: { …(6) } } ]` (9/9) |
| SC-9 | `mf-0066-order-body.acceptance.test.tsx` | `Error: not implemented` (OrderBody) (1/1) |
| SC-10 | `mf-0066-order-content.acceptance.test.ts` | `Error: not implemented` (loadPackOrders) (4/4) |

Only the 8 frozen files were red in `pnpm test` at freeze, plus `mf-0028-planning-check` / `mf-0053-design-preflight`
(they run `gate:planning` over this tree: the new files were not yet owned by any plan task; green once
LOOP-PLAN's tasks existed, `gate:planning: 70 ticket folders checked, ok`).

## Variant check (riskiest step)

With the migration applied, a rolled-back probe inserted the same key twice, once `ordered = true` and once
`ordered = false`, and graded the permutation `RUN, REQ, RES` of `REQ, RUN, RES` as a signed-in user:
`[{"k":"ordered=true  permutation","graded":false},{"k":"ordered=false permutation (old rule)","graded":true}]`.
Under the old set equality the SC-2 case "the same steps in another order → false" would be red, so that case is
not vacuous.

## Receipt (iteration 3)

`2026-11-09 · code tree 7e3ef02439a6 (git diff HEAD + untracked, excluding .planning) · typecheck 0 · lint 0 · unit+ui 1537/1537 (256 files) · test:db 221/221 (43 files) · check:packs 0 · build 0 (no shuffle-secret code in .next/static) · gate:planning ok · gate:workspace ok · PASS`

## Delta review fixes (iteration 3, 2026-11-09): RED first

| Finding | Test | RED against the code before the fix (pasted) |
|---|---|---|
| D-1 key recoverable from the shown order | `src/server/content/__tests__/order-shuffle-seed.test.ts` (non-frozen), run against a stub with the old seeding (`orderSeed(userId, orderId)`, secret ignored) | `AssertionError: expected 200 to be less than or equal to 10` (the public attacker recovered the key for 200/200 learners); `AssertionError: expected 0 to be greater than or equal to 180` (changing only the secret changed 0 layouts); `expected [Function] to throw an error` (no production guard). After the HMAC fix: 4/4 |
| D-2 focus lost on two moves to the same Add button | `order-step-keyboard.test.tsx` case "two moves in a row…" | `expect(element).toHaveFocus()` — `Expected element with focus … Received element with focus:` (body). After the move counter: 4/4 |
| D-5 no DB proof of the seeded approval | `src/dev-seed/__tests__/order-approvals-seed.db.test.ts` | new assertion (state `approved`, 2 demo approvals at the current hash, not you or the author) |

No frozen file changed for iteration 3 (SC-8 pins `orderSeed` only for the `userId` it is given; the app now
passes `orderSeedOf`).

## Results (iteration 2, on main c7a042b, 2026-11-08)

| SC | Verdict | Evidence |
|----|---------|----------|
| SC-1 | PASS | schema acceptance 19/19; DB bad-order case passes |
| SC-2 | PASS | migration rebuilt as `20261107120000_mf0066_order_items.sql`: `create or replace` of MF-0065's 5-arg record_attempt, body verbatim + only the v_ordered declare/select/branch (diff against MF-0065 shown: 3 hunks); one function per schema, 5-arg only; variant probe on the new function `{"ordered=true  permutation","graded":false},{"ordered=false permutation (old rule)","graded":true}`; `mf-0066-order-keys.db.acceptance` 7/7 |
| SC-3 | PASS | re-frozen SC-3 rows 4/4; RED against the label sort: `expected 1 to be greater than or equal to 15` |
| SC-4 | PASS | engine SC-4 15/15; `grade-order.test.ts` 5/5 |
| SC-5 | PASS | plan acceptance 11/11 (`pickOrder` now uses MF-0065's shared `orderSkillItems`) |
| SC-6 | PASS | grounding acceptance 5/5; `order-quote-count.test.ts` 3/3; `check:packs: 3 order(s) checked against their cited page`, 0 problems |
| SC-7 | PASS | order-step acceptance 9/9; keyboard test 3/3; browser: focus Add → next Add → Check order, live region "Added "…" as step n of 4." |
| SC-8 | PASS | re-frozen toPlayerSteps row; typecheck 0 |
| SC-9 | PASS | review body 1/1; browser (iteration 1) |
| SC-10 | PASS | content acceptance 4/4 (3 orders on D2.S2); verify table 0 open FIX (D3.S2 withdrawn; order-tool-error PASS on a fresh re-read) |
| SC-11 | PASS | `pnpm dev:seed` alone approved the diagram (`Order items: approved 1 diagram(s) they are drawn from.`); browser :3003 order step 9 of 12, "Correct! That is the order."; read-back `{"question_id":"prod-prompting.D2.S2.order-client-tool-turn","skill_code":"D2.S2","chosen":["STOP","RUN","OK","RES"],"correct":true,"hash_matches_registry":true,"has_client_id":true}`; 375 px scrollWidth 375 |
| SC-12 | PASS | ladder below |

## Gates and suite (tree 49b9d086755d)

- `pnpm typecheck` 0, `pnpm lint` 0 (`Checked 925 files … No fixes applied.`)
- unit + ui: `Test Files 249 passed`, 3 failed under machine load (load avg 10–12; worker-start and 5 s timeouts); the 3 files pass in isolation twice: `Tests 24 passed (24)`. One real red found and fixed: MF-0065 SC-10 acceptance imports lesson actions with only `grade-answer` mocked; `answerLessonOrder` now loads `grade-order` on call (re-run: 11 files, 62 tests pass)
- `pnpm test:db` after `pnpm db:reset`: `Test Files 42 passed (42)`, `Tests 220 passed (220)` (incl. MF-0065, MF-0067 and the MF-0007 re-freeze)
- `pnpm db:types`: no change; `pnpm build` 0; `pnpm check:packs` 0; `pnpm gate:planning` ok; `pnpm ticket:collisions MF-0066` no unlisted collisions (90 files)
- FROZEN hashes (MF-0066, MF-0007) match

## Receipt

`2026-11-08 · tree 49b9d086755d · typecheck 0 · lint 0 · test 1513/1516 (3 load flakes, pass in isolation) · test:db 220/220 · build 0 · check:packs 0 · gate:planning ok · PASS`

## Not verified

- A diff review of iteration 2 (the orchestrator dispatches it).
- The D2.S2 round-2 explanation note was applied verbatim, not re-read.
- A full single unit+ui run with zero reds: the machine was under load from parallel sessions; the reds were timeouts in unrelated files and passed in isolation.

## Verdict: PASS
