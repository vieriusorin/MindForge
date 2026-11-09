---
phase: 1-planning
ticket_id: MF-0066
status: executing
verdict: IN_PROGRESS
started_at: "2026-11-07"
resume_with: /gsd-goal-loop
---

# Loop Plan — Iteration 1

## Discovery summary

- Precedent: MF-0016 (cuckoo) added an item kind that shares the grading path: own file kind + schema +
  review body, keys in `private.question_keys`, registry row in `private.items`, `record_attempt` grading,
  `item_type` CHECK widened by one migration. This ticket copies that shape, with two differences: grading is
  by **sequence** (F-3: `record_attempt` uses set equality today), and orders validate against the diagrams, so
  they load in a **second stage** (`parseOrders(files, pack, content)`) rather than inside `parseContent` (F-2:
  `LoadedPackContent` is frozen by exact shape in `mf-0006-content`).
- MF-0067 (`20261106160700_mf0067_attempt_idempotency.sql`) is the current `private.record_attempt`: 4 args,
  replay first, then key + hash in one snapshot, then grade, insert with `on conflict`. This ticket replaces it
  with `create or replace` (same signature, grants kept) and only changes the key select and the grade line.
- MF-0064 (07fd567) lesson player: `LESSON_STEP_KINDS`, `PlayerStep`, `STEP_META`, `never` switch in
  `lesson-player.tsx`, `toPlayerSteps` switch. The frozen `mf-0064-lesson-plan` test has an exhaustive
  `label(step: LessonStep)` without a default, so `LessonStep` must not gain a member: the order step is
  `LessonOrderStep`, carried as `plan.order` and placed by `lessonSteps(plan)`.
- Gates on the touched paths: `check:packs` (scripts/check-pack-grounding.mjs), `gate:planning` (owns),
  `db:sync-keys` validation (`scripts/lib/validate-packs.mjs` loads every pack with the app's loaders).

## Symbols changed

`ITEM_TYPES`, `ItemType`, `'cuckoo'`, `cuckoos`, `PackContent`, `ContentFiles`, `PackItem`, `findPackItem`, `itemTitles`, `itemHashes`, `readPackFiles`, `validatePacks`, `record_attempt`, `items_item_type_check`, `question_keys`, `planLesson`, `LessonPlan`, `LESSON_STEP_KINDS`, `PlayerStep`, `STEP_META`, `toPlayerSteps`, `KIND_LABEL`, `ItemBody`

Hand greps (behaviour change of a shared writer): sync-question-keys / db:sync-keys — only the new orders
kind is added; rows of other kinds are written as before (the ordered column defaults to false). private.items — one new
item_type value. pack_slug — unchanged rule.

## Frozen files this will re-freeze

ONE needs a new expected value (found in TEST by `pnpm test:db`, missed at PLAN because the symbol list named
the singular `'cuckoo'` and not the folder literal `cuckoos`; added since). Every other file
`pnpm ticket:collisions MF-0066` names was read for the changed symbols and still holds:

| File:line | Change (new expected value) | Reason |
|---|---|---|
| `src/server/db/__tests__/mf-0007-review.db.acceptance.test.ts:206` | **PROPOSED RE-FREEZE, NOT APPLIED (needs approval)**: SC-1's expected-registry kind list gains one line after `["cuckoos", "cuckoos"]`: `["orders", "orders"], // MF-0066: a fifth item kind`. New sha256 `c2b9e34f941b1f89b82a0747be4ac2789030d3bd3e93d12d1ddff66cc3eff922` | The sync now registers order items (`item_type 'order'`), so the registry holds 507 rows vs 504 expected (`expected Map{ …(507) } to deeply equal Map{ …(504) }`); SC-2..SC-6 fail in cascade (fixture seeding sits after the SC-1 assertion). Same shape as the MF-0016 re-freeze in its FROZEN.json history; intent unchanged, nothing weakened. Proven: the patched copy run as a temp test file passed 7/7 on the local stack, the frozen file 0/7 |
| `src/engine/content/__tests__/mf-0006-content.acceptance.test.ts` | none | `cuckoos: []` exact shape of `loadPackContent` for the sample pack: orders load in a second stage, so `LoadedPackContent` is unchanged |
| `src/engine/misconceptions/__tests__/mf-0065-misconceptions.acceptance.test.ts` | none | (after the rebase onto c7a042b) builds `PackContent` without `orders` and calls `planLesson` without orders: `plan.order` is null, steps unchanged; `cuckoos` is a fixture key only; passes |
| `src/server/attempts/__tests__/mf-0065-grade-confidence.acceptance.test.ts` | none | mocks the `record_attempt` RPC for questions; the order branch is not reached; passes |
| `src/server/db/__tests__/mf-0065-confidence.db.acceptance.test.ts` | none | the rebuilt migration keeps MF-0065's 5-arg body verbatim (confidence check, replay comparisons); its keys use explicit columns, so `ordered` defaults to false; `pnpm test:db` 220/220 |
| `src/content-pipeline/__tests__/mf-0014-cards-diagrams.acceptance.test.ts` | none | `PackContent` gains an OPTIONAL `orders`; fixtures without it still type and behave |
| `src/engine/content/__tests__/mf-0010-seed-planting.acceptance.test.ts` | none | same (`PackContent` optional field) |
| `src/engine/content/__tests__/mf-0016-cuckoo.acceptance.test.ts` | none | `findPackItem` keeps every cuckoo branch; cuckoo behaviour unchanged |
| `src/engine/content/__tests__/mf-0016-cuckoo-content.acceptance.test.ts` | none | cuckoo literal only |
| `src/engine/content/__tests__/mf-0024-id-prefix.acceptance.test.ts` | none | `readPackFiles` adds an `orders` key; the test spreads `real` and reads kinds by name, no exact-shape assertion |
| `src/engine/lesson/__tests__/mf-0064-lesson-plan.acceptance.test.ts` | none | `LessonPlan` gains `order` (null without orders); assertions read `steps`/`maxReasks`, unchanged without orders; `LessonStep` unchanged so `label()` compiles |
| `src/features/lesson/__tests__/mf-0064-node-entry.acceptance.test.ts` | none | `planLesson` behaviour without orders unchanged |
| `src/features/lesson/components/lesson-player/__tests__/mf-0064-lesson-player.acceptance.test.tsx` | none | `PlayerStep` gains a member; fixtures use existing members; the actions mock lacks `answerLessonOrder`, read only by an order step |
| `src/engine/memory/__tests__/mf-0016-session.acceptance.test.ts` | none | cuckoo literal only |
| `src/features/__tests__/mf-0067-attempt-id-input.acceptance.test.ts` | none | cuckoo literal only |
| `src/features/__tests__/mf-0067-attempt-id.acceptance.test.tsx` | none | cuckoo literal only |
| `src/features/app-shell/components/app-sidebar/__tests__/mf-0052-storm-link.acceptance.test.tsx` | none | cuckoo nav entry, untouched |
| `src/features/app-shell/components/app-sidebar/__tests__/mf-0054-sidebar-label.acceptance.test.tsx` | none | same |
| `src/features/app-shell/components/app-sidebar/__tests__/mf-0058-paths-link.acceptance.test.tsx` | none | same |
| `src/features/app-shell/components/app-sidebar/__tests__/mf-0062-map-link.acceptance.test.tsx` | none | same |
| `src/features/cuckoo/components/cuckoo-session/__tests__/mf-0016-cuckoo-session.acceptance.test.tsx` | none | cuckoo literal only |
| `src/server/paths/__tests__/mf-0058-recorder-wiring.acceptance.test.ts` | none | cuckoo literal only |
| `src/test/__tests__/mf-0036-cuckoo-grounding.acceptance.test.ts` | none | cuckoo rule untouched; order rule is a new module |
| `src/test/__tests__/mf-0041-flaw-key.acceptance.test.ts` | none | same |
| `src/dev-seed/__tests__/mf-0029-plan.acceptance.test.ts` | none | `record_attempt` signature and set-equality grading unchanged for questions |
| `src/dev-seed/__tests__/mf-0029-seed.db.acceptance.test.ts` | none | same |
| `src/features/__tests__/mf-0058-recorder-failure.db.acceptance.test.ts` | none | inserts `question_keys` with explicit columns; `ordered` defaults to false |
| `src/server/db/__tests__/mf-0003-attempts.db.acceptance.test.ts` | none | SC-5 counts `ccdv-f` keys = questions + cuckoos; orders ship in `prod-prompting` only; `question_keys` stays unreadable to clients |
| `src/server/db/__tests__/mf-0011-group-heatmap.db.acceptance.test.ts` | none | explicit-column insert, default `ordered` |
| `src/server/db/__tests__/mf-0012-sync-keys.db.acceptance.test.ts` | none | before/after `select *` snapshots compare equal states; a broken pack still writes nothing |
| `src/server/db/__tests__/mf-0013-storms.db.acceptance.test.ts` | none | explicit-column insert |
| `src/server/db/__tests__/mf-0016-cuckoo-keys.db.acceptance.test.ts` | none | selects named columns; cuckoo grading by set equality unchanged |
| `src/server/db/__tests__/mf-0024-id-prefix.db.acceptance.test.ts` | none | snapshot compare + explicit-column inserts |
| `src/server/db/__tests__/mf-0025-orphan-keys.db.acceptance.test.ts` | none | named-column selects; delete-with-pack unchanged |
| `src/server/db/__tests__/mf-0032-attempt-hash.db.acceptance.test.ts` | none | hash check unchanged (same statement, same order of checks) |
| `src/server/db/__tests__/mf-0067-retry-safe.db.acceptance.test.ts` | none | replay first, 4-arg signature, grants, `client_attempt_id` column all unchanged; `create or replace` keeps grants |
| `src/server/paths/__tests__/mf-0058-course-completion.db.acceptance.test.ts` | none | explicit-column insert; grading unchanged for questions |

Re-freezes needing approval: **one** (`mf-0007-review.db.acceptance.test.ts`, above). `mf-0024-id-prefix`'s
`KINDS` list does not include orders; it still holds (orders' prefix rule is covered by MF-0066 SC-1).

## Parsers

- **Order file** (`OrderFileSchema`, zod strictObject): `skill: string`, `orders: OrderItem[] (≥1)`; item keys
  exactly `id, title, origin, author?, generatedBy?, level?, diagram, steps, orderedBy, explanation, source`.
  `steps`: 3–8 `{ node: NodeId(≤8), label: non-empty }`; `orderedBy`: ≥1 non-empty strings; `source`:
  `{ title, url: https }`. Rejected inputs: SC-1 table in `mf-0066-order-schema.acceptance.test.ts`.
  Cross-reference checks (diagram exists, same skill, node exists, label equal, edge chain, no repeat, source in
  skill ∩ diagram sources, pack-wide id) run in `parseOrders` after the schema, for every item, before returning.
- **check:packs order rule** (`checkOrderFile`): YAML parse error → one `parse` problem; for each item with an
  `id`: uncached `source.url` → `source`; each `orderedBy` quote not in the normalised (lower-case, collapsed
  whitespace) text of `source.url` → `ordered-by`. No exemption list exists, so no exempt-path test.

## SC coverage

| SC | Steps | Proof |
|----|-------|-------|
| SC-1 | T2, T4 | `mf-0066-order-schema.acceptance.test.ts`; DB file's bad-order case |
| SC-2 | T1, T4 | `mf-0066-order-keys.db.acceptance.test.ts` |
| SC-3, SC-4 | T2, T5 | `mf-0066-order-engine.acceptance.test.ts`, `grade-order.test.ts` |
| SC-5 | T2, T3 | `mf-0066-order-plan.acceptance.test.ts`, engine acceptance |
| SC-6 | T4 | `mf-0066-order-grounding.acceptance.test.ts`, `pnpm check:packs` |
| SC-7, SC-8 | T6 | `mf-0066-order-step.acceptance.test.tsx`, typecheck |
| SC-9 | T2, T7 | `mf-0066-order-body.acceptance.test.tsx`, engine acceptance, browser |
| SC-10 | T8 | `mf-0066-order-content.acceptance.test.ts`, `verify/orders.md`, `pnpm check:packs` |
| SC-11 | T6, T9 | browser + DB read-back |
| SC-12 | T9 | LOOP-VERIFY |

## Steps

1. `supabase/migrations/20261107100000_mf0066_order_items.sql`: widen `items_item_type_check` to
   `('question','card','diagram','cuckoo','order')`; `alter table private.question_keys add column ordered boolean
   not null default false`; `create or replace function private.record_attempt(text, text[], text, uuid)` = the
   MF-0067 body with `v_ordered` selected in the key statement and the grade line
   `v_correct := case when v_ordered then p_chosen = v_correct_options else <set equality> end`. Header comment
   keeps the change record (MF-0065 changes this function next).
2. Engine content: `schema.ts` `OrderFileSchema`; `parse-orders.ts` (`parseOrders`, `loadPackOrders`);
   `playable-order.ts`; `check-order-answer.ts`; `order-servable.ts`; `find-item.ts` (order branch, `itemTitles`);
   `item-hashes.ts` (kind `orders`); `load-content.ts` `readPackFiles` reads `orders/`. Inner tests where the
   acceptance file does not reach.
3. Engine lesson: `planLesson` picks `order` with the lesson's item order (`lastAnswers`/`bucketOf`) among
   `isOrderServable` orders of the skill; `maxReasks` subtracts 1 when set; `lesson-steps.ts` places it.
4. Scripts (orchestrator): `validate-packs.mjs` also runs `loadPackOrders`; `sync-question-keys.mjs` reads
   `orders/` keys (`correct_options` = step nodes, `ordered = true`) and registry rows (`item_type 'order'`),
   writes `ordered` for every key; `order-grounding.mjs` + wire into `check-pack-grounding.mjs` (count printed).
5. Server: `get-pack-orders.ts` (`"use cache"`, `cacheLife("days")`, like `getPackContent`); `grade-order.ts`
   (`checkOrderAnswer` → `record_attempt` with nodes as chosen → `recordCourseCompletion` on correct, as cuckoo);
   `answerLessonOrder` in `src/features/lesson/actions.ts` (auth, zod `OrderAnswerInput`, messages per error).
6. UI lesson: `order-step/` folder (view + `hooks/use-order-step.ts` with `useMutation`, `useAttemptId`,
   `useSingleFlight` + `utils.ts` for placement decisions + tests), `PlayerStep`, `STEP_META`, player case,
   `toPlayerSteps` order case (`toPlayableOrder` + hash), lesson page passes `orders` and uses `lessonSteps`.
7. UI review: `order-body.tsx`; review page + flags page pass `{ ...content, orders }`.
8. Content: `packs/prod-prompting/orders/{D1.S3,D2.S1,D2.S2}.yaml` (3–4 orders); fresh verifier per item →
   `.planning/tasks/MF-0066/verify/orders.md`; fixes applied; `pnpm check:packs` green.
9. CONTEXT.md "Order item"; TEST ladder; evidence; browser (SC-11) with the diagram approved by two seeded
   reviewers via SQL on the local stack.

## Riskiest step

Step 1 + 4: grading. A sequence key graded by the old set equality would mark every permutation right. Proof:
the DB acceptance file asserts two permutations are `false`; at BUILD the variant check flips `ordered` to false
for the fixture order and shows the "another order → false" case going red (recorded in LOOP-VERIFY).
Questions keep set equality (regression case in the same file).

**Version binding (MF-0007 rule):** an order attempt names the content hash the page rendered
(`toPlayableOrder(order, fileHash)` → `contentHash` in the answer); `checkOrderAnswer` refuses `changed` when it
differs from the deployed file hash, and `record_attempt` refuses `55000` when it differs from the registry hash;
review verdicts bind to the file hash through the unchanged `nextReviewItem` → `ReviewActions` flow.

**UI predicate vs server refusal:** Check order disabled until all steps placed → server refuses a non-permutation
(`invalid-order`, engine) and the zod bound (≤ 8 ids of ≤ 8 chars); double click → `useSingleFlight` + MF-0067
replay (one row per client attempt id, DB test); a stale tab after the diagram was flagged → `withdrawn` from
`checkOrderAnswer` on the server read of review states.

**Re-run state (sync):** the sync writes keys/items for orders exactly as for cuckoos inside the per-pack
transaction; validation of every pack (orders included) runs before the first write (MF-0034 failure order) —
the DB file's bad-order case asserts the earlier key survives.

## Iteration 2 (review changes-requested, 2026-11-07)

- Blocker 1: MF-0007 SC-1 re-freeze applied (user decision U-a); MF-0007/FROZEN.json hash + history.
- Blocker 2: `order-to-compaction` (D3.S2) withdrawn; replaced by `order-tool-error` (D2.S2 failure branch,
  STOP → RUN → OK → ERR → REQ), each pair quoted from handle-tool-calls; two fresh verifier rounds (FIX → PASS).
- Should-fix 3: shown order = Fisher–Yates driven by mulberry32(`orderSeed(userId, orderId)`, FNV-1a), reshuffled
  while equal to the key; seed computed on the server (`toPlayerSteps({ userId })`). Own re-freeze of the
  SC-3 rows (engine file) and the SC-8 toPlayerSteps row, reason in FROZEN.json history, shown RED against the
  label sort.
- Should-fix 4: focus moves to the next Add button / Check order after Add, back to the step's Add button after
  Remove (`focusAfterAdd` / `focusAfterRemove` in utils, `data-focus-key` + effect in the hook); each move is
  announced in a polite live region (`addedLine` / `removedLine`). RTL test `order-step-keyboard.test.tsx`.
- Note 7: `checkOrderQuoteCount` (corpus-free, runs in CI): `orderedBy.length >= steps.length - 1`.
- U-b: `planOrderDiagramApprovals` (T10). It runs AFTER the worlds and never changes them (MF-0068 SC-5); it
  skips your reviewed / maintainer-resolved / real-flagged items (`excludeItemIds`), a diagram the world flags,
  and official items; existing world approvals count toward the two. The approvals ride in each world's
  `reviews` through `withOrderApprovals`, so seed-demo-world's existing checks (hash fresh, not the author,
  checks before deletes) apply to them unchanged.
- Should-fix 5 (migration): waits for MF-0065; the rebuilt migration will `create or replace` the 5-arg
  signature with MF-0065's body verbatim + only the `v_ordered` branch.

## Iteration 3 (delta review, 2026-11-09)

- D-1: the shown permutation's seed comes from `orderShuffleSeed(user.id, order.id)` = HMAC-SHA256 under
  ORDER_SHUFFLE_SECRET (zod-parsed, ≥ 32 chars, production fails closed; dev falls back to a fixed local value;
  `pnpm dev:setup` generates and keeps a random one). `toPlayerSteps` takes `orderSeedOf` (app) or `userId`
  (tests, the frozen SC-8 row) as a discriminated union. Deploy step: set ORDER_SHUFFLE_SECRET per environment.
- D-2: the focus effect is keyed on a move counter.
- D-5: `order-approvals-seed.db.test.ts` asserts `private.item_state(diagram) = 'approved'` after a seed run.

## Rejected options

- A separate `record_order_attempt` function — a second grading path with its own replay/hash rules to keep in step.
- Deriving "ordered" from `private.items.item_type` in `record_attempt` — the key row and the registry row are
  separate; a missing registry row would silently fall back to set equality.
- `orders` inside `parseContent` / `LoadedPackContent` — re-freezes `mf-0006-content` SC-6 for no behaviour gain.
- Adding `order` to `LessonStep` — breaks the frozen MF-0064 plan test at compile time.
- Labels resolved from the diagram at runtime — would change a reviewed item without changing its hash.
- Drag-and-drop — buttons are keyboard- and screen-reader-first and need no new library.

## Verify

- `pnpm typecheck && pnpm lint && pnpm test`, `pnpm test:db`, `pnpm build`, `pnpm check:packs`,
  `pnpm gate:planning`, `pnpm gate:workspace` (no `ticket:verify` script: receipt line appended to LOOP-VERIFY)
- browser: `/play/prod-prompting/lesson/D2.S2` as a seeded learner (diagram approved), `/review/prod-prompting`
  as a reviewer; light, dark, 375 px.

## Tasks — the graph the orchestrator dispatches; exactly one block

```json tasks
[
  { "id": "T0", "title": "acceptance tests (frozen)", "agent": "acceptance-writer",
    "owns": ["src/engine/content/__tests__/mf-0066-*", "src/engine/lesson/__tests__/mf-0066-*", "src/server/db/__tests__/mf-0066-*", "src/test/__tests__/mf-0066-*", "src/features/lesson/components/order-step/__tests__/mf-0066-*", "src/features/review/components/review-item/__tests__/mf-0066-*"],
    "depends_on": [], "closes": [],
    "done_when": ["pnpm test (only the frozen files red)"], "context": ["file:.planning/tasks/MF-0066/GOAL.md"] },
  { "id": "T1", "title": "migration: item_type order, question_keys.ordered, sequence grading", "agent": "schema-builder",
    "owns": ["supabase/migrations/*_mf0066_*.sql"],
    "depends_on": ["T0"], "closes": ["SC-2"],
    "done_when": ["pnpm db:reset", "pnpm test:db src/server/db/__tests__/mf-0066-order-keys.db.acceptance.test.ts"],
    "context": ["skill:supabase", "skill:supabase-postgres-best-practices", "file:supabase/migrations/20261106160700_mf0067_attempt_idempotency.sql"] },
  { "id": "T2", "title": "engine content: order schema, loader, playable, grading decision, servable, item helpers", "agent": "service-builder",
    "owns": ["src/engine/content/schema.ts", "src/engine/content/types.ts", "src/engine/content/index.ts", "src/engine/content/parse-orders.ts", "src/engine/content/playable-order.ts", "src/engine/content/check-order-answer.ts", "src/engine/content/order-servable.ts", "src/engine/content/order-seed.ts", "src/engine/content/find-item.ts", "src/engine/content/item-hashes.ts", "src/engine/content/load-content.ts", "src/engine/content/__tests__/order-*.test.ts"],
    "depends_on": ["T0"], "closes": ["SC-1", "SC-3", "SC-4", "SC-9"],
    "done_when": ["pnpm test src/engine/content/__tests__/mf-0066-order-schema.acceptance.test.ts src/engine/content/__tests__/mf-0066-order-engine.acceptance.test.ts", "pnpm typecheck"],
    "context": ["skill:typescript-strict", "file:src/engine/content/load-content.ts"] },
  { "id": "T3", "title": "engine lesson: plan.order + lessonSteps", "agent": "service-builder",
    "owns": ["src/engine/lesson/types.ts", "src/engine/lesson/index.ts", "src/engine/lesson/plan-lesson.ts", "src/engine/lesson/lesson-steps.ts", "src/engine/lesson/__tests__/lesson-steps.test.ts"],
    "depends_on": ["T2"], "closes": ["SC-5"],
    "done_when": ["pnpm test src/engine/lesson"], "context": ["file:src/engine/lesson/plan-lesson.ts"] },
  { "id": "T4", "title": "scripts: sync keys/registry for orders, validate orders, check:packs order rule", "agent": "orchestrator",
    "owns": ["scripts/sync-question-keys.mjs", "scripts/lib/validate-packs.mjs", "scripts/lib/order-grounding.mjs", "scripts/check-pack-grounding.mjs", "src/test/__tests__/order-quote-count.test.ts"],
    "depends_on": ["T1", "T2"], "closes": ["SC-1", "SC-2", "SC-6"],
    "done_when": ["pnpm test src/test/__tests__/mf-0066-order-grounding.acceptance.test.ts", "pnpm test:db src/server/db/__tests__/mf-0066-order-keys.db.acceptance.test.ts", "pnpm check:packs"],
    "context": ["file:scripts/lib/cuckoo-grounding.mjs"] },
  { "id": "T5", "title": "server: getPackOrders, gradeOrder, answerLessonOrder", "agent": "service-builder",
    "owns": ["src/server/content/get-pack-orders.ts", "src/server/content/order-shuffle-seed.ts", "src/server/content/__tests__/order-shuffle-seed.test.ts", "src/server/attempts/grade-order.ts", "src/server/attempts/__tests__/grade-order.test.ts", "src/features/lesson/actions.ts"],
    "depends_on": ["T2"], "closes": ["SC-4"],
    "done_when": ["pnpm test src/server/attempts", "pnpm typecheck"],
    "context": ["skill:nextjs-data", "file:src/server/attempts/grade-cuckoo.ts"] },
  { "id": "T6", "title": "lesson UI: order step, player integration, lesson page", "agent": "ui-builder",
    "owns": ["src/features/lesson/components/order-step/**", "src/features/lesson/schemas.ts", "src/features/lesson/types.ts", "src/features/lesson/utils/to-player-steps.ts", "src/features/lesson/__tests__/to-player-steps.test.ts", "src/features/lesson/components/lesson-player/lesson-player.tsx", "src/features/lesson/components/lesson-player/utils.ts", "src/app/(app)/play/[packSlug]/lesson/[skill]/page.tsx"],
    "depends_on": ["T3", "T5"], "closes": ["SC-7", "SC-8", "SC-11"],
    "done_when": ["pnpm test src/features/lesson", "pnpm typecheck", "pnpm build"],
    "context": ["skill:server-client-components", "skill:client-data-tanstack-query", "skill:react-client-patterns", "skill:ui-shadcn", "skill:accessibility"] },
  { "id": "T7", "title": "review UI: order body, review + flags pages pass orders", "agent": "ui-builder",
    "owns": ["src/features/review/components/review-item/**", "src/app/(app)/review/[packSlug]/page.tsx", "src/app/(app)/review/[packSlug]/flags/page.tsx"],
    "depends_on": ["T2", "T5"], "closes": ["SC-9"],
    "done_when": ["pnpm test src/features/review", "pnpm build"],
    "context": ["skill:ui-shadcn"] },
  { "id": "T8", "title": "content: prod-prompting orders + fresh verifiers", "agent": "orchestrator",
    "owns": ["packs/prod-prompting/orders/**"],
    "depends_on": ["T2", "T4"], "closes": ["SC-10"],
    "done_when": ["pnpm test src/engine/content/__tests__/mf-0066-order-content.acceptance.test.ts", "pnpm check:packs", "verify/orders.md has 0 open FIX"],
    "context": ["file:.claude/skills/gsd-goal-loop/SKILL.md (drafter checks 1-4)"] },
  { "id": "T10", "title": "dev:seed approves the diagrams the shipped orders come from (user decision U-b)", "agent": "orchestrator",
    "owns": ["scripts/dev-seed.ts", "scripts/dev-setup.mjs", ".env.example", "src/dev-seed/__tests__/order-approvals-seed.db.test.ts", "src/dev-seed/load-seed-inputs.ts", "src/dev-seed/plan-seed.ts", "src/dev-seed/plan-order-approvals.ts", "src/dev-seed/__tests__/plan-order-approvals.test.ts"],
    "depends_on": ["T2", "T8"], "closes": ["SC-11"],
    "done_when": ["pnpm test src/dev-seed", "pnpm test:db src/dev-seed", "pnpm dev:seed (Order items: approved n diagram(s))"],
    "context": ["file:src/dev-seed/plan-demo-world.ts", "file:.planning/tasks/MF-0068/GOAL.md"] },
  { "id": "T9", "title": "glossary, TEST ladder, browser, evidence, verify", "agent": "orchestrator",
    "owns": ["CONTEXT.md", ".planning/tasks/MF-0066/LOOP-VERIFY.md", ".planning/evidence/MF-0066.md", ".planning/evidence/MF-0066/**"],
    "depends_on": ["T6", "T7", "T8", "T10"], "closes": ["SC-11", "SC-12"],
    "done_when": ["pnpm typecheck && pnpm lint && pnpm test", "pnpm test:db", "pnpm build", "pnpm check:packs", "pnpm gate:planning", "pnpm gate:workspace"],
    "context": [] }
]
```
