---
ticket_id: MF-0066
title: "New interactive step: order the steps, drawn from diagrams (slice E)"
tier: high-risk                   # migration (private.items CHECK, question_keys column, record_attempt) + pack schema + check:packs gate + review flow
stage: handoff
branch: MF-0066
builds_on: [MF-0064, MF-0067]
last_iteration: 0
goal_status: complete-pending-manual-commit             # reserved by MF-0062 (council split, user decision D-1); picked up with /gsd-goal-loop MF-0066
---

> Reserved 2026-11-06 from MF-0062 (learning-path council, split slice). Decisions D-1..D-6 and findings live in
> `.planning/tasks/MF-0062/GOAL.md`; re-derive each fact at pickup (`## Facts`) before asking the user.

## Objective

Today every graded item is a pick-from-options question (or a cuckoo line). Nothing trains the *sequence* of a
process: what happens first in a client tool-use turn, what comes before the eval run. The council's J3
(Brilliant's "Complete the program", a Parsons-style constructive problem) asked for one.

End state: a new item kind, the **order item**. The learner sees the steps of one process shuffled and puts them
in order; the database grades the sequence; the attempt feeds FSRS like any answer. An order item is drawn from
one diagram of its skill (ADR 0003): its steps are that diagram's nodes, chained by its edges, and the cited page
has a sentence that orders them. It is served only while that diagram is **approved**. It is reviewed like every
item (MF-0007 version binding), passes `pnpm check:packs` (the quoted ordering sentences must be on the cited
page), and appears as a step in the lesson player (MF-0064). A first set of real order items ships in
`prod-prompting` (the agent / tool-use pack).

## Affected

- **Roles:** learner (plays the step in a lesson), reviewer (reviews a new item kind), content maintainer (flags).
- **Surfaces:**
  - engine: `src/engine/content/` (order schema, `parseOrders` / `loadPackOrders`, `toPlayableOrder`,
    `checkOrderAnswer`, `isOrderServable`, `findPackItem` / `itemTitles` / `itemHashes`, `ITEM_TYPES`),
    `src/engine/lesson/` (`planLesson` + `LESSON_STEP_KINDS` gain `order`)
  - DB: one migration (`private.items.item_type` gains `order`; `private.question_keys.ordered`;
    `private.record_attempt` grades an ordered key by sequence); `scripts/sync-question-keys.mjs`;
    `scripts/lib/validate-packs.mjs`
  - gate: `scripts/check-pack-grounding.mjs` + new `scripts/lib/order-grounding.mjs`
  - server: `src/server/attempts/grade-order.ts`, `src/server/content/get-pack-orders.ts`
  - UI: `src/features/lesson/**` (order step folder, `answerLessonOrder`, `PlayerStep`, `STEP_META`, switch),
    `src/features/review/components/review-item/` (order body), pages `/play/[packSlug]/lesson/[skill]`,
    `/review/[packSlug]`, `/review/[packSlug]/flags`
  - content: `packs/prod-prompting/orders/*.yaml`; `CONTEXT.md` (Order item)

## Facts (re-derived 2026-11-07 from source)

- F-1 Item kinds today: `ITEM_TYPES = ["question","card","diagram","cuckoo"]` (`src/engine/content/types.ts:26`);
  DB `private.items.item_type` CHECK `('question','card','diagram','cuckoo')` (`mf0016_cuckoo_items.sql:9`);
  the sync's `ITEM_KINDS` table (`scripts/sync-question-keys.mjs:123`); `PackItem` union + `findPackItem`
  (`find-item.ts`), `itemHashes` kinds list (`item-hashes.ts:17`), `ReviewableRows` zod enum
  (`src/server/review/types.ts:20`), review `KIND_LABEL` (`review-item.tsx:13`).
- F-2 `LoadedPackContent` is asserted by exact shape in frozen `mf-0006-content.acceptance.test.ts:284`
  (`{questions,cards,diagrams,cuckoos}` for the empty sample pack). Adding `orders` to `parseContent`'s output
  would re-freeze it; a separate second-stage loader (orders validate against the loaded diagrams) does not.
- F-3 (updated at the 2026-11-08 rebase: MF-0065 made `record_attempt` 5-arg with `p_confidence`; this ticket's
  migration `create or replace`s that signature) Grading: `private.record_attempt` (MF-0067, `20261106160700_mf0067_attempt_idempotency.sql`) grades by
  **exact set equality** (`array(select distinct … order by 1)` both sides). A permutation of the key is graded
  correct, so an order key needs **sequence equality**: a new branch keyed on a stored flag, not a new function
  (one grading path, one retry/replay rule, same 4-arg signature). Option ids are bounded to 1–8 chars and
  1–10 per answer; the `prod-prompting` diagram node ids used here are 2–6 chars (`REQ`, `STOP`, `PROMPT`).
- F-4 Replay is generic by item id: `countableAttempts` (`src/engine/memory/countable.ts`) and the forest replay
  key on `question_id`, so an order attempt feeds FSRS with no engine change (as cuckoos did, MF-0016).
- F-5 Diagrams store `nodes[{id,label,shape?}]` and `edges[{from,to,label?}]` (`schema.ts` `DiagramSchema`);
  node ids are unique per diagram; edges reference known nodes. Review state is computed per item id from
  `review_states` (`reviewStateOf`, `review.ts`); unknown non-official items are `unreviewed`.
- F-6 Review flow: the review page shows an item only when the deployed file hash equals the registry hash
  (`nextReviewItem`, `review-queue.ts:44`) and the verdict carries that hash (`ReviewActions contentHash`);
  `review_item` refuses another version (MF-0007). A kind joins by `findPackItem` + `itemHashes` + registry row.
- F-7 `check:packs` today: cuckoo flaw-key, key-length, paths (corpus-free), then cuckoo grounding and the
  token/leak rules for questions/cards/diagrams (corpus). The corpus is `.cache/corpus` (gitignored; 85 pages
  locally, copied read-only from the main checkout). No rule reads an order sentence.
- F-8 MF-0064's lesson player (07fd567, on this branch): closed `LESSON_STEP_KINDS`, `PlayerStep`,
  `true satisfies PlayerStepKindsMatch`, `STEP_META satisfies Record<LessonStepKind,string>` and a `never`
  switch in `lesson-player.tsx`; `planLesson` reads `content.questions/cards/diagrams` only.

## Constraints

- C-1 Same item rules as every item: origin, author, content hash, review state, playable filter, citation ⊆
  skill sources (CONTEXT.md Item, Playable, Citation).
- C-2 The key (the correct order) never reaches the browser before the database graded the answer.
- C-3 An attempt names the version read (MF-0007/MF-0032): the answer carries the content hash; grading
  refuses another version. Retry-safe via MF-0067's client attempt id.
- C-4 D-4: the database holds guards and grading only; which item is served (approved diagram, playable) is
  an engine decision.
- C-5 Drafter check (3): an ordering needs a page sentence that orders it.
- C-6 shadcn only, tokens only, no emoji, a11y (keyboard, words not colour), MF-0064 player contract.

### Constraints → how met

| Constraint | How met | Proof |
|---|---|---|
| C-1 | orders join the pack-wide id claim, `itemHashes`, the registry (`item_type='order'`), `reviewStateOf` + `isPlayable` on serve and grade; loader requires `source.url` ∈ skill sources ∩ diagram sources | SC-1, SC-4, SC-9 |
| C-2 | `toPlayableOrder` picks fields one by one; steps arrive in a permutation seeded by HMAC-SHA256(ORDER_SHUFFLE_SECRET, "<user>:<order>") computed in `src/server/content/order-shuffle-seed.ts`, never the key and not computable from what the browser has (delta review D-1); feedback only after `record_attempt` | SC-3, SC-7 |
| C-3 | `answerLessonOrder` input carries `contentHash` + `clientAttemptId`; `checkOrderAnswer` refuses `changed`; `record_attempt` checks the registry hash and replays a retry | SC-2, SC-4 |
| C-4 | `question_keys.ordered` + a sequence branch in `record_attempt` (grading); `isOrderServable` in the engine | SC-2, SC-5 |
| C-5 | each order carries `orderedBy` quotes; `check:packs` requires each to be on the cited page; a fresh verifier checks they order the steps | SC-6, SC-10 |
| C-6 | buttons for every move, verdict in a `status` region in words, numbered correct order after grading | SC-7, SC-8 |

## Decided without a question

- **Item kind `order`, folder `orders/`, file key `orders:`**, type `OrderItem` (CONTEXT.md term "Order item").
  Source: MF-0016 precedent (a kind with its own file and review body, sharing the grading path).
- **Steps are diagram nodes, labels copied into the order file** (`steps: [{node, label}]`), and the loader
  requires each label to equal the node's label. Reason: the content hash covers what the reviewer reads; a
  label pulled from the diagram at runtime would change the shown item without changing its hash (MF-0007).
- **Chain rule:** each consecutive pair `(a, b)` is a direct diagram edge `a → b`; no repeated node; 3–8 steps
  (phone-sized; record_attempt allows ≤ 10); node ids ≤ 8 chars (record_attempt's option-id bound). The
  diagram must belong to the same skill and pack. Source: ticket "derived from a diagram's nodes" + F-3.
- **Grading = sequence equality** in the same `private.record_attempt`, branch on `private.question_keys.ordered`
  (default false, so every existing key keeps set equality). Source: F-3, D-4 (grading is a DB guard).
- **"Approved diagram" read literally** (brief: "derived from an APPROVED diagram's nodes"): an order is served
  and graded only when its own state is playable (approved/unreviewed) **and** its diagram's state is
  `approved`. A flagged or rejected diagram withdraws its orders. Past attempts are kept (attempts on a flagged
  item count, CONTEXT.md Attempt).
- **Shown order before answering** (revised after review should-fix 3 and delta review D-1): a seeded
  Fisher–Yates of the steps, reshuffled while it equals the key. The seed is the first 32 bits of
  HMAC-SHA256(ORDER_SHUFFLE_SECRET, "<user id>:<order id>"), computed server-side and passed into the engine as an
  opaque number (`toPlayerSteps({ orderSeedOf })`). A seed from public inputs (the FNV `orderSeed` of the user id)
  let a learner invert the shuffle and read the key (reviewer probe 9000/9000); with the secret the same attack
  recovers the key at chance (test: ≤ 10 of 200). `orderSeed` stays for tests and fixtures only. The secret is
  server-only, ≥ 32 chars, required in production, generated locally by `pnpm dev:setup`, never derived from the
  Supabase keys.
- **Lesson placement:** one order step per lesson, the skill's first servable order by the lesson's item rule
  (wrong-last, never answered, least recent), after the recalls and before the confusable step. A miss earns no
  re-ask (D-L8 re-asks are questions). Source: MF-0064 D-L6/D-L8; teach (card, diagram) → recall.
- **Diagram shown earlier in the same lesson:** the drawing teaches the process; the order step is the
  retrieval that follows it, as recalls follow the card. Not a key leak (C-2 is about the answer payload).
- **No XP, no new reward** (D-3). **No new table** (D-4): one column on `question_keys`.
- **Content:** 3–4 orders in `prod-prompting` (shipped after review: three on the D2.S2 tool-use loop — the
  client turn, the round-trip start and the error path; the D3.S2 order was withdrawn at review because no page
  sentence orders its Full → Kind pair; earlier: the D1.S3
  draft was withdrawn at verification because its diagram's DR label is not on the cited page, and D2.S1 was not
  drafted because no page sentence orders its PROMPT → CHOICE edge), `origin: ai`,
  `author: sorin.vieriu@ddroidd.com`, `generatedBy: { model: claude-opus-5-5, prompt: mf0066-hand-session }`
  (MF-0016 K-2 precedent), each verified by a fresh-context verifier against its cited page.
- **check:packs rule:** `orderedBy` quotes must occur (whitespace/case-normalised) in the cached text of
  `source.url`; an uncached source is a problem (no `# uncached:` exemption for orders: the rule is the whole
  point). Corpus absent (CI) → skipped like the other corpus rules; the structural rules live in the loader,
  which `db:sync-keys` and the content test run.

## Decided by the user (2026-11-06, parallel-run brief)

- U-1 Merge: the orchestrator commits, pushes, opens the PR and squash-merges after CI. No `git commit/push`,
  `gh pr create/merge` here.
- U-2 Approvals: high-risk plans are approved by the orchestrator agent; a fresh-context diff-reviewer runs before
  merge. `pnpm db:reset` on the LOCAL stack is allowed under the db lock.
- U-3 MF-0063 = admin-set external chat link. U-4 MF-0061 = all three packs. (Not this ticket; recorded.)

## Decided by the user (2026-11-07, after the fresh-context review)

- U-a The MF-0007 SC-1 re-freeze is approved: the expected-registry kind list gains `["orders", "orders"]`;
  MF-0007/FROZEN.json carries the new hash and a history entry citing this approval.
- U-b K-1 stays literal (an order is served only while its diagram is approved), AND `pnpm dev:seed` approves the
  diagrams the shipped orders come from, so the demo world shows order steps; with a test, following MF-0068's
  re-run rules (your own reviews untouched, checks before deletes).
- Standing approval of necessary own re-freezes (as for earlier tickets): MF-0066's SC-3 rows and SC-8
  toPlayerSteps row re-frozen for the seeded shown order (review should-fix 3), reason in FROZEN.json history.

## Edge inputs

| Input state | Shown / returned | Decided by |
|---|---|---|
| skill has no order file | lesson has no order step; plan otherwise unchanged | agent |
| order unreviewed, diagram approved | served (unreviewed items are playable) | CONTEXT.md Playable |
| order approved, diagram unreviewed | not served; grading refuses `withdrawn` | "approved diagram" decision |
| diagram flagged or rejected | not served; `withdrawn` | same |
| order flagged or rejected | not served; `withdrawn` | MF-0006 SC-8 |
| two servable orders on one skill | one step: wrong-last, then never answered (file order), then least recent | MF-0064 D-L6 |
| order servable, no question for the skill | card, diagram, then the order step (an approved diagram is always a teach step, so "order alone" cannot occur) | agent |
| sent hash ≠ deployed file hash | "This order changed since you opened it. Reload the page for a fresh lesson." No attempt | C-3 |
| answer not a permutation of the steps (missing, extra, repeated, unknown id) | `invalid-order`: "Place every step once, then check." No attempt | agent |
| exact key order | correct; attempt `correct=true` | SC-2 |
| same steps, other order | wrong; attempt `correct=false`; correct order revealed | SC-2 |
| retry with the same client attempt id | first grade returned, one row | MF-0067 |
| no key synced | "This order isn't available for grading yet. Ask an admin to sync the answer keys." | MF-0009 wording |

## Success Criteria

- [x] SC-1: **Schema + loader.** `parseOrders` loads `orders/<skill>.yaml` (`skill`, `orders[]` of `id`, `title`,
  `origin`, `author?`, `generatedBy?`, `level?`, `diagram`, `steps[{node,label}]`, `orderedBy[]`, `explanation`,
  `source{title,url}`) against the pack and its loaded content. It rejects, each with an issue naming file and
  path: an unknown diagram id; a diagram of another skill; a step node not in the diagram; a label ≠ the node's
  label; a consecutive pair with no edge `a → b`; a repeated node; < 3 or > 8 steps; a node id > 8 chars; a
  `source.url` not in both the skill's and the diagram's sources; a non-https url; an empty `orderedBy`; an id
  used by any other item of the pack (questions, cards, diagrams, cuckoos, orders); a foreign id prefix.
  `loadPackOrders` reads `<packDir>/orders/*.yaml` (missing dir = none); `validatePacks` and therefore
  `pnpm db:sync-keys` refuse a pack with a bad order file.
  Proof: `src/engine/content/__tests__/mf-0066-order-schema.acceptance.test.ts`.
- [x] SC-2: **Keys, registry, sequence grading (DB).** `pnpm db:sync-keys` writes for each order
  `private.question_keys` (`correct_options` = the step nodes in file order, `ordered = true`, skill from the
  file) and `private.items` (`item_type = 'order'`, its content hash); removing it deletes both. Through the
  4-arg `record_attempt` as a signed-in learner: the exact order → `true`; the same nodes in another order →
  `false`; a subset → `false`; the attempt row's `skill_code` is the order's skill; a retry with the same client
  attempt id returns the first grade and writes one row; a question key (`ordered = false`) still grades a
  permutation of its options as correct. `private.items` refuses an unknown `item_type` (23514).
  Proof: `src/server/db/__tests__/mf-0066-order-keys.db.acceptance.test.ts` (local stack, temp packs dir).
- [x] SC-3: **No key before answering.** `toPlayableOrder(order, hash, seed)` returns exactly `id`, `skillCode`,
  `origin`, `title`, `steps[{id,label}]`, `contentHash` (no `orderedBy`, `explanation`, `diagram`, `author`,
  `generatedBy`, `source`); `steps` hold every step once in a permutation seeded by `seed` (=
  `orderSeed(userId, orderId)`, server-side) that is never the key, the same for the same seed, and not one fixed
  layout (re-frozen after review should-fix 3). Proof: `mf-0066-order-engine.acceptance.test.ts`.
- [x] SC-4: **Grading decision.** `checkOrderAnswer` (pure) returns `not-in-pack` (no order), `withdrawn` (order
  not playable, or diagram state ≠ `approved`), `changed` (sent hash ≠ file hash), `invalid-order` (not a
  permutation of the step nodes), else `ok`. `gradeOrder` calls `record_attempt` only on `ok` and returns
  `{ correct, steps (key order, with labels), explanation }`. Proof: same engine acceptance file (one `it` per
  grading row of the edge table) + `src/server/attempts/__tests__/grade-order.test.ts`.
- [x] SC-5: **Serving + lesson plan.** `isOrderServable` is true only for (approved|unreviewed order, approved
  diagram). `planLesson` with `content.orders` sets `plan.order` to the skill's one servable order chosen by the
  edge-table rule (else null) and counts it in `maxReasks`; `lessonSteps(plan)` places it after the recalls and
  before the confusable step (last when there is none; after the teach steps when there are no questions); with no
  servable order the plan deep-equals the plan without `orders` and `lessonSteps(plan)` equals `plan.steps`.
  `LESSON_STEP_KINDS` gains `"order"`; `LessonStep` is unchanged (the order step is `LessonOrderStep`, so the
  frozen MF-0064 plan test's exhaustive `label()` keeps compiling).
  Proof: `src/engine/lesson/__tests__/mf-0066-order-plan.acceptance.test.ts` + engine acceptance (`isOrderServable`).
- [x] SC-6: **check:packs.** The order rule (`scripts/lib/order-grounding.mjs`, run by `pnpm check:packs`) reports
  a quote not found in the cached text of the order's `source.url` and an uncached source, naming file, id and
  quote; a real quote passes. A corpus-free floor (`checkOrderQuoteCount`, runs in CI) requires
  `orderedBy.length >= steps.length - 1` (review note 7; proof `src/test/__tests__/order-quote-count.test.ts`). `pnpm check:packs` exits 0 on the shipped tree and prints the order count.
  Proof: `src/test/__tests__/mf-0066-order-grounding.acceptance.test.ts` + `pnpm check:packs` exit 0.
- [x] SC-7: **Order step UI.** In the lesson, the order step shows the title and the steps as buttons ("Add:
  <label>"); each press appends the step to a numbered answer list, whose items have a "Remove: <label>" button;
  Check order is disabled until every step is placed and while pending; Check sends
  `{ packSlug, orderId, order, contentHash, clientAttemptId }` (uuid); the verdict is announced in a `status`
  region — "Correct! That is the order." or "Not quite. Here is the order." — then the key order is shown as a
  numbered list with the explanation, and Continue (or Finish on the last step) moves on; a server error message
  is shown and the answer can be checked again. After each Add, focus moves to the next step to place (Check
  order when none is left); after Remove, back to that step's Add button; each move is announced in a polite
  live region (review should-fix 4; proof `order-step/__tests__/order-step-keyboard.test.tsx`). Proof:
  `src/features/lesson/components/order-step/__tests__/mf-0066-order-step.acceptance.test.tsx`.
- [x] SC-8: **Player integration.** `PlayerStep` has `{ kind: "order"; order: PlayableOrder }`, `toPlayerSteps`
  maps an order step with its deployed hash (dropped without one), `STEP_META.order = "Put in order"`, and the
  `LessonPlayer` renders the order step and advances on Continue. Proof: `mf-0066-order-step.acceptance.test.tsx`
  (player case) + `pnpm typecheck` (`true satisfies PlayerStepKindsMatch`).
- [x] SC-9: **Review.** `findPackItem(content, "order", id)`, `itemTitles` and `itemHashes` include orders; the
  review card labels it "Order the steps" and shows the title, the steps in key order with their node ids, the
  `orderedBy` quotes, the explanation, the diagram it is drawn from and the source; the verdict binds to the
  file hash (existing flow). Proof: `src/features/review/components/review-item/__tests__/mf-0066-order-body.acceptance.test.tsx`
  + engine acceptance (`findPackItem`/`itemHashes`) + browser on `/review/prod-prompting`.
- [x] SC-10: **Content.** `packs/prod-prompting/orders/` holds 3–6 orders, each loading with `loadPackOrders`,
  each drawn from a `prod-prompting` diagram, each citing one of its skill's sources, `pnpm check:packs` green,
  and each verified by a fresh-context verifier against its cited page with 0 open FIX rows in
  `.planning/tasks/MF-0066/verify/orders.md`. Proof: `mf-0066-order-content.acceptance.test.ts` + the verify table.
- [x] SC-11: **Playable end to end.** On the local stack, with the order's diagram approved by two non-author
  reviewers (after U-b: by `pnpm dev:seed` itself, `src/dev-seed/__tests__/plan-order-approvals.test.ts`), a signed-in learner opens `/play/prod-prompting/lesson/D2.S2`, reaches the order step, places the
  steps, checks, sees the verdict and the key; one `attempts` row lands for the order id with `skill_code`
  `D2.S2` and the `correct` value matching what was placed. Proof: browser screenshots + DB read-back.
- [x] SC-12: **Receipt.** `pnpm typecheck && pnpm lint && pnpm test`, `pnpm test:db`, `pnpm build`,
  `pnpm check:packs`, `pnpm gate:planning`, `pnpm gate:workspace` pass on the final tree. Proof: LOOP-VERIFY.

## Concerns

| # | Collision | Owner | Status |
|---|-----------|-------|--------|
| K-1 | "APPROVED diagram" literal reading means no order is served on a fresh deployment until two reviewers approve its diagram. Alternative: serve while the diagram is merely playable. | user | resolved by the brief's wording (taken literally); the orchestrator may overrule at plan approval — one line in `isOrderServable` |
| K-2 | MF-0065 also changes `private.record_attempt` (confidence). Both tickets `create or replace` it; whichever merges second must carry the other's branch. | orchestrator | open: flagged in the hand-off; this migration keeps the MF-0067 header |
| K-3 | MF-0065 edits `src/features/lesson/**` (QuestionStep footer, submit hook). This ticket touches `actions.ts` (a new function), `types.ts`, `utils.ts` (`STEP_META`), `lesson-player.tsx` (one case), `to-player-steps.ts`. | orchestrator | open: separate hunks; listed in the hand-off |

## Out of Scope

- Fill-in-the-blank and multi-slot variants (prompt parts), drag-and-drop gestures (buttons only, a11y first).
- Order items in the Duel, Walk, storms or a standalone route; a re-ask for a missed order.
- An OrderWriter prompt in the content pipeline; orders in packs other than `prod-prompting`.
- A DB check that a served order's diagram is approved (D-4: serving is an engine decision).

## Open questions

- none.

## Iteration Log

<!-- append-only -->
- 2026-11-06 reserved from MF-0062.
- 2026-11-07 INTAKE + DESIGN: picked up on 709b938 (main + MF-0067), fast-forwarded to 07fd567 (MF-0064) on the
  coordinator's instruction; Facts F-1..F-8 re-derived; 12 SCs. Design choice to avoid re-freezing
  `mf-0006-content` (F-2): orders load in a second stage (`parseOrders`), `PackContent.orders` optional.
- 2026-11-07 design preflight: `pnpm typecheck && pnpm lint && pnpm test` exit 0 (231 files, 1329 tests); `pnpm check:packs` exit 0 (485 items, 0 problems); `pnpm test:db` not run at preflight: run under the db lock after `pnpm db:reset` at RED (U-2 allows the reset; MF-0066 DB file red as expected); `pnpm db:reset` and `pnpm db:sync-keys` allowed under the db lock (U-2); `pnpm build` not run: no UI change yet, run at TEST; `pnpm gate:planning` and `pnpm gate:workspace` run at hand-off; `pnpm dev:seed` (named by SC-11 after U-b) run under the db lock at TEST. main CI latest conclusion `success` (d4c1faa).
- 2026-11-07 RED: `LessonStep` kept unchanged after the stub broke the frozen MF-0064 plan test's exhaustive
  `label()` at compile time; the order step became `plan.order` + `lessonSteps(plan)` (SC-5 reworded before freeze).
  8 acceptance files frozen RED (FROZEN.json); DB file run twice after `pnpm db:reset` under the db lock.
- 2026-11-07 PLAN: LOOP-PLAN iteration 1 (10 tasks); `pnpm ticket:collisions MF-0066` exit 0 with 32 frozen files read and found to hold, re-freezes needing approval: none. Plan approval: the orchestrator's brief (2026-11-07) authorised BUILD after PLAN (U-2); K-1 (literal "approved diagram") left for the orchestrator to overrule at review. BUILD started.
- 2026-11-07 BUILD: migration, engine, scripts, server, lesson + review UI, 3 orders (2 verifier rounds, 0 open FIX).
  Variant check: an `ordered=false` key grades a permutation true, so SC-2 is not vacuous.
- 2026-11-07 TEST: typecheck/lint/test 1411/1411, build, check:packs, gate:planning, gate:workspace green; browser
  SC-11 on :3003 with the attempt read back. `pnpm test:db` 205/212: frozen `mf-0007-review.db.acceptance.test.ts`
  SC-1 lists item kinds by folder and now misses `orders` (507 vs 504; SC-2..6 cascade). ticket:collisions missed it
  (symbol list had `'cuckoo'`, not the folder literal `cuckoos`; added). One-line re-freeze proposed in LOOP-PLAN and
  proven 7/7 on a temp copy, NOT applied: goal_status blocked-on-user until the re-freeze is approved.
- 2026-11-07 REVIEW changes-requested (REVIEW.md): user decisions U-a, U-b recorded. Iteration 2: MF-0007 re-freeze
  applied; D3.S2 order withdrawn and replaced by the D2.S2 error-path order (fresh verifier FIX → fix → fresh PASS);
  seeded shown order with own SC-3/SC-8 re-freeze; focus + move announcements; quote-count floor; dev:seed
  approves order diagrams. Migration rebuild waits for MF-0065 (should-fix 5).
- 2026-11-08 REBASE + HAND-OFF: moved onto main c7a042b (MF-0060..0065, 0067, 0068). Conflicts resolved keeping both
  sides: check-pack-grounding.mjs (MF-0061 key-rank import + MF-0065 misconceptions block + MF-0066 order import and
  quote-count block), lesson page.tsx (MF-0065 confusable/misconceptions + MF-0066 orders/lessonSteps/userId),
  plan-lesson.ts (MF-0065 `orderSkillItems`; `pickOrder` now uses it). Migration rebuilt as
  20261107120000_mf0066_order_items.sql on MF-0065's 5-arg body (review should-fix 5). MF-0065 SC-10 acceptance red
  fixed by loading grade-order on call. Ladder green (load flakes noted); browser re-check on :3003. Receipt PASS.
- 2026-11-09 DELTA REVIEW changes-requested (REVIEW.md, iteration 2). D-1 blocker: the shown order was a shuffle of
  the key seeded from public inputs (key recoverable 9000/9000). Fixed: seed = HMAC-SHA256(ORDER_SHUFFLE_SECRET,
  "<user>:<order>") in `src/server/content/order-shuffle-seed.ts`; test written first and shown RED against the
  old seeding (`expected 200 to be less than or equal to 10`, `expected 0 to be greater than or equal to 180`). No
  frozen file changed. D-2 focus counter (RED first: focus fell to <body>). D-3 trace row. D-5 DB test for the seeded
  approval. D-4 noted, no change.
- 2026-11-09 HAND-OFF (iteration 3): typecheck, lint, unit+ui 1537/1537, test:db 221/221, check:packs, build, gate:planning green. Deploy step: ORDER_SHUFFLE_SECRET per environment.
