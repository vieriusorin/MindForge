---
verdict: approve
verdict_detail: "Delta review (iteration 3, on c7a042b): 0 blocking. D-1 closed: the shown order is now seeded by HMAC-SHA256(ORDER_SHUFFLE_SECRET, user:order) in a server-only module; the public-seed attack falls to chance, the layout distribution is uniform over the non-key permutations (chi2 at df for 3/4/5 steps), so the layout tells a learner only 'not this one'; the 32-bit seed is no oracle for the secret. Production with a missing or short secret throws, lazily, only for a lesson that has an order step (segment error boundary). No secret, HMAC or shuffle code in .next/static. D-2 closed RED-first, D-3 closed, D-5 DB test green after reset. Notes: stale seed comments in the engine; the public userId seeding path is still callable from production code; key recoverable via a throwaway account's first answer (inherent to SC-4)."
reviewed_hash: 8338202cd7e804885d0960f9b7327fcd1f80e563d7fac40766a5aa80e4574815
reviewed_at: 2026-11-09T07:54:43Z
---

Reviewed in `/Users/sorinvieriu/Projects/mind-forge-MF-0066` (branch MF-0066, base 07fd567), against the
uncommitted diff vs HEAD plus untracked files, excluding `.planning`.

Runs I did myself:
- 9 MF-0066 non-DB test files (acceptance, utils and grade-order): 82/82 pass.
- FROZEN.json: all 8 sha256 values match.
- `pnpm typecheck && pnpm lint`: exit 0.
- `pnpm ticket:collisions MF-0066`: no unlisted collisions.
- `pnpm gate:planning`: ok (70 folders).
- Under the db lock, after `pnpm db:reset`:
  - `mf-0066-order-keys.db.acceptance`: 7/7 pass.
  - `mf-0003` and `mf-0016` db: pass.
  - `mf-0007-review.db.acceptance`: 7/7 fail (finding 1).
  - Lock released.
- Mutations on temp copies of `packs/`:
  - Swapping two steps keeps `check:packs` green (exit 0). The loader catches the swap (`validatePacks` reports "no edge STOP → OK", and so on).
  - Changing a quote's wording turns `check:packs` red.

## Findings

1. **[blocker]** `src/server/db/__tests__/mf-0007-review.db.acceptance.test.ts:206`. This frozen test's SC-1 lists the kind folders and ends at `["cuckoos","cuckoos"]`.
   - The sync now registers the 3 order items, so the registry has 507 rows against 504 expected. SC-2..SC-7 fail in cascade (7/7 red here).
   - `pnpm test:db` is therefore red on the reviewed tree, and SC-12 cannot be ticked.
   - The fix is the one-line re-freeze proposed in LOOP-PLAN ("Frozen files this will re-freeze"). It has the same shape as the MF-0016 re-freeze and weakens nothing, but it needs the orchestrator's or user's approval before merge.
   - `ticket:collisions` passes only because the plan lists the file. Its symbol list missed the folder literal at plan time (GOAL iteration log).

2. **[blocker]** `packs/prod-prompting/orders/D3.S2.yaml:4` (`prod-prompting.D3.S2.order-to-compaction`). C-5 (drafter check 3) requires a page sentence that orders each pair. No quoted sentence orders the pair Full ("Is the context window filling up?") → Kind ("What kind of task is it?").
   - On the cited page, "The choice between these approaches depends on task characteristics" and "Long-horizon tasks require … where the token count exceeds the LLM's context window" do not sequence choosing a technique after the window fills. The page frames the choice as a design decision.
   - `verify/orders.md` round 2 records exactly this as a FIX ("Turn, Kind, Full, Compact also defensible"). The fix moved the ordering into the item's own title ("it picks a technique only once its context window is filling up"). That is not grounding. It is a premise the page does not state, and it gives the answer away.
   - The round-2 fixes were "not re-read by a third verifier" (verify table footer). SC-10's "0 open FIX rows" is met in letter only.
   - Scenario: a learner who reads the page orders Turn → Kind → Full → Compact (a technique chosen at design time) and is graded wrong.
   - Fix: either withdraw this order (2 orders remain, below SC-10's 3; draft a replacement), or find a page sentence that orders Full → Kind and have a fresh verifier re-read the item.

3. **[should-fix]** `src/engine/content/playable-order.ts:12-16`. The shown order is a deterministic sort by label, so the starting layout is the same for every learner, on every lesson, forever.
   - Computed from the shipped files:
     - `order-client-tool-turn`: key STOP,RUN,OK,RES is shown as STOP,OK,RES,RUN.
     - `order-to-compaction`: key Turn,Full,Kind,Compact is shown as Turn,Compact,Full,Kind.
     - `order-round-trip-start`: key REQ,STOP,RUN is shown as STOP,RUN,REQ. This one hits the rotation branch, so the key is the shown order rotated right by one.
   - Every shipped item is therefore one move from the key. The rotation fallback is also a learnable tell: a list that isn't alphabetical means "the answer is alphabetical".
   - No key reaches the browser (C-2 holds), but the item no longer tests the sequence.
   - Suggested fix: a seeded permutation that is never the key, keeping the engine free of randomness by passing the seed in. The seed could be a hash of the order id plus the user id, or the attempt count.
   - SC-3's frozen engine test asserts sort-by-label, so this needs a re-freeze. Decide now or ticket it.

4. **[should-fix]** `src/features/lesson/components/order-step/components/step-pool.tsx:21` and `components/answer-list.tsx:32`. Pressing "Add: …" or "Remove: …" unmounts the focused button, so keyboard focus falls to `<body>`.
   - A keyboard or screen-reader user must tab back through the page after every move.
   - Nothing announces a move (e.g. "Added '…' as step 2 of 4"). The only `aria-live` is the verdict `<output>`. The brief and C-6 ask for an accessible, button-driven reorder with a live region for moves.
   - Fix (in the hook): move focus to the next pool button, or the list heading, or the Check button when the pool empties. Add a polite status line for each move.

5. **[should-fix, rebase]** `supabase/migrations/20261107100000_mf0066_order_items.sql:20`. On the MF-0065 rebase, do **not** carry this `create or replace function private.record_attempt(text, text[], text, uuid)` over.
   - MF-0065 drops the 4-arg function and creates `(text, text[], text, uuid, text)` with `p_confidence text default null`.
   - A 4-arg `create or replace` after that would quietly **create a second overload**:
     - A new function gets PUBLIC EXECUTE by default, and no `revoke` follows.
     - Calls with 4 named args (`gradeOrder` at `src/server/attempts/grade-order.ts:71`, `gradeAnswer`, and the frozen DB tests) become ambiguous between the two overloads.
   - The rebuilt migration must:
     - `create or replace` the 5-arg signature;
     - copy MF-0065's body verbatim (including the confidence check and the `v_prev.confidence` replay comparison in both replay blocks);
     - add only `v_ordered` (declare, the key `select … into`, and the `if v_ordered` branch at line 92);
     - keep the `items_item_type_check` and `question_keys.ordered` DDL.
   - Also update the header ("same 4-arg signature", "MF-0065 changes this function next") and GOAL F-3/SC-2 wording.
   - The 4-named-arg calls keep working against the 5-arg function because `p_confidence` defaults to null, so `gradeOrder` and the frozen MF-0066 DB test need no change.

6. **[note]** SQL logic is correct as written.
   - The sequence branch `p_chosen = v_correct_options` compares length, position and value. Nulls are refused earlier, and existing keys get `ordered default false`.
   - `ordered` lives in `private.question_keys` and only the service-role sync writes it. No client can flip it.
   - Replay compares `chosen` with `is distinct from`, which is order-sensitive, so a retry with a reordered answer gets 23505.
   - The grants are unchanged.
   - Other graders of `correct_options`:
     - `private.options_match` (set equality) in `finalize_storm` cannot reach an order, because `start_storm` requires `item_type = 'question'`.
     - Cards and diagrams have no key.
     - `answerLessonItem` and `gradeCuckoo` look up only their own kinds, so an order id gets `not-in-pack`.

7. **[note]** `scripts/lib/order-grounding.mjs:74` checks only that each quote is on the cited page (SC-6 as written). It does **not** require a quote per adjacent pair.
   - Removing every quote but one stays green.
   - A step swap is caught by the loader's edge-chain rule (`validatePacks` / `db:sync-keys` / the content test), not by `check:packs`.
   - Per-pair ordering is left to the fresh verifier, which is the gap finding 2 fell through.
   - Consider a structural `orderedBy.length >= steps.length - 1` floor. It is cheap and corpus-free.

8. **[note]** K-1: `src/engine/content/order-servable.ts:15` reads "approved diagram" literally.
   - Every `prod-prompting` diagram is `origin: ai`, so on a fresh hosted deployment **no order is served** until two non-author reviewers approve its diagram.
   - SC-11 passed only after approving the diagram locally.
   - This is the orchestrator's call, one line.
   - Version binding is sound:
     - a diagram edit changes its hash, so it reverts to unreviewed and withdraws its orders;
     - an order verdict binds the order's file hash, which covers the copied labels;
     - the loader refuses a label that drifts from its node.
   - The reviewer's `OrderBody` shows the diagram only by id. The edges are not visible when judging the chain.

9. **[note]** Item-kind widening is complete.
   - Covered: `ITEM_TYPES` (and with it the `ReviewableRows` zod enum), the DB CHECK, the sync's `ITEM_KINDS` and keys, `PackItem` / `findPackItem` / `itemTitles` / `itemHashes`, `readPackFiles`, `KIND_LABEL`, `ItemBody`, `LESSON_STEP_KINDS` / `STEP_META` / `PlayerStep` and the exhaustive switches.
   - The remaining `cuckoos` / `diagrams` lists are cuckoo-only screens, the content pipeline's card/diagram generator, and `check:packs` item-grounding (questions, cards, diagrams). None of them needs orders.
   - Frozen `mf-0024-id-prefix` `KINDS` omits orders but only narrows what it checks. `parseOrders` enforces the prefix itself.

10. **[note]** Key secrecy holds.
    - `toPlayableOrder` picks its fields one by one.
    - The lesson page passes only `toPlayerSteps` output. It sends no `plan` or `OrderItem` to the client, and the `diagram` prop is the teach step.
    - `ReviewItem` / `OrderBody` are Server Components, rendered only on the group-gated review page.
    - Feedback is built only after `record_attempt` returns a boolean.
    - The retry id comes from `submissionKey(order.id, placed)`, so a changed order gets a new id (MF-0067).
    - Order attempts go through generic `question_id` replay into FSRS (F-4).

11. **[note]** Conflict surface with main (017531a, MF-0061):
    - `scripts/check-pack-grounding.mjs` is edited by both: main rewrote the key-length summary and the final log lines.
    - main's `scripts/lib/key-length.mjs` reads only `questions/*.yaml`, so orders stay outside the key-length and key-rank rules.
    - The MF-0065 overlap on `src/features/lesson/**` is as K-3 describes.

12. **[nit]** `src/features/lesson/components/order-step/utils.ts:2` declares the `ShownStep` interface in `utils.ts`, and `types.ts` imports it from there. By `react-client-patterns`, shapes belong in `types.ts` (or derive it from `PlayableOrder["steps"][number]`).

## Delta review (iteration 2, rebased on c7a042b)

Fresh context. Reviewed in `/Users/sorinvieriu/Projects/mind-forge-MF-0066` (HEAD = main c7a042b), against the
uncommitted diff vs HEAD plus untracked files, excluding `.planning`. The previous front matter was
`changes-requested` at `fc85a88d…e979321` (iteration 1). It is replaced by the verdict above.

Runs I did myself:
- `pnpm typecheck`, `pnpm lint`: exit 0. `pnpm gate:planning`: ok (70 folders). `pnpm build`: exit 0.
  - `.next/static` has no `server-only`, `record_attempt`, `gradeOrder`, `orderedBy`, `orderSeed` or mulberry32 constant.
- `pnpm check:packs`: exit 0 (`3 order(s) checked against their cited page`, 0 problems).
  - Mutation on a temp copy (`MF_PACKS_DIR`): dropping 2 of `order-tool-error`'s 5 quotes gives exit 1 with
    "5 steps need at least 4 orderedBy quotes … found 3".
- MF-0066 acceptance, unit and UI tests, plus `src/dev-seed`, `src/features/lesson` and `src/features/review`
  (non-DB): 45 files, 227/227.
- The three load-flaky files, each run alone:
  - `use-lesson-player`: 9/9.
  - `mf-0026-seed-double-submit`: 4/4.
  - `use-storm-session`: 11/11.
- FROZEN: all 8 MF-0066 hashes match. Both MF-0007 hashes match.
- Under the db lock (acquired as MF-0066-review2, released), after `pnpm db:reset` from this worktree:
  - `pg_proc` has exactly one `private.record_attempt(text,text[],text,uuid,text)`, which is SECURITY DEFINER with
    `search_path=""`, and one `public.record_attempt(text,text[],text,uuid,text)`. The ACL on both is
    `postgres, authenticated` only.
  - `has_function_privilege('anon', …)` is false for both. It is true for `authenticated` on the public wrapper.
  - `question_keys.ordered` column grants: `postgres` only. 3 of 394 keys are `ordered`.
  - Registry: `order` = 3. The CHECK includes `'order'`.
  - DB tests: MF-0066 order-keys, MF-0065 confidence + lost-race, MF-0007 review + content-hash: 5 files,
    25/25. `src/dev-seed` DB tests plus MF-0003/0016/0032/0067 DB tests: 15 files, 55/55.
  - `MF_AUTHOR_EMAIL=sorin.vieriu@ddroidd.com pnpm dev:seed`, run twice. Both runs print
    "approved 1 diagram(s)".
  - After the second run, `prod-prompting.D2.S2.diagram-loop` has exactly 2 approvals from 2 demo reviewers
    (`crammer@`, `steady@mindforge-demo.test`), both at the current hash. The author is not among them.

### First-review findings: status

| # | Finding | Status |
|---|---|---|
| 1 | MF-0007 SC-1 frozen list misses `orders` | **closed.** The re-freeze is exactly one added line (`["orders", "orders"], // MF-0066: a fifth item kind`). MF-0007 FROZEN.json has the new hash and a history entry citing U-a. 7/7 green after reset |
| 2 | D3.S2 Full → Kind not ordered by the page | **closed.** `packs/prod-prompting/orders/` holds only `D2.S2.yaml`, and the item is withdrawn. I read every adjacent pair of the replacement `order-tool-error` (STOP→RUN→OK→ERR→REQ) against the cached "Handle tool calls" page. STOP→RUN: "The response has a `stop_reason` of `tool_use`…" + "When you receive a tool use response… 2. Run the actual tool". RUN→OK→ERR: "If the tool itself throws an error during execution… return the error message… `is_error: true`". ERR→REQ: "3. Continue the conversation by sending a new message with the `role` of `user`…". No second defensible order |
| 3 | Fixed label-sort layout | **replaced by a seeded shuffle, which introduces finding D-1** |
| 4 | Focus loss, no move announcements | **mostly closed.** A polite region announces each move, and focus moves via `data-focus-key`. One residual case: D-2 |
| 5 | 4-arg overload on rebase | **closed.** The rebuilt `record_attempt` is MF-0065's `create function` body. Textual diff: only the `v_ordered` declare, `k.ordered`/`v_ordered` in the key select, and the `if v_ordered` branch. The confidence check and both replay blocks' `v_prev.confidence is distinct from p_confidence` are intact. No grant changes. One overload live |
| 7 | No per-pair quote floor | **closed.** `checkOrderQuoteCount` is corpus-free and runs even without the corpus. Red on mutation (above) |
| 8 | K-1 literal | **resolved by U-b.** `dev:seed` approves the diagram. `assertLocalSeedTarget` still runs before the stack's keys are read (`scripts/dev-seed.ts:78-85`) |
| 12 | `ShownStep` declared in utils | **closed.** It is now `PlayableOrder["steps"][number]` in `types.ts` |

Rebase resolutions kept both sides:
- `check-pack-grounding.mjs`: the diff vs main is additions only (import, quote-count block, order block, summary line). MF-0061 key-rank and MF-0065 misconceptions are untouched.
- `page.tsx`: MF-0065 confusable/misconceptions plus orders/`lessonSteps`/`userId`.
- `plan-lesson.ts`: `pickOrder` reuses `orderSkillItems`.

On the lazy `await import("@/server/attempts/grade-order")` in `src/features/lesson/actions.ts:65`: it is a
`"use server"` module, the build is green, and no server code is in the client chunks. It is acceptable, though its
only reason is a frozen MF-0065 test's mock surface (note).

### Findings

D-1. **[blocker]** `src/engine/content/playable-order.ts:44` together with `src/features/lesson/utils/to-player-steps.ts:63`
   and `src/app/(app)/play/[packSlug]/lesson/[skill]/page.tsx:84`. The key can be computed from what the browser receives (C-2 intent).
   - The shuffle permutes the **key array** with a PRNG seeded by `orderSeed(user.id, order.id)`. Both inputs are
     known to the learner: the order id is in the payload, and the user id is the `sub` of their own Supabase
     session cookie. The algorithm is public, since `vieriusorin/MindForge` is a PUBLIC repo. The positional
     permutation depends only on the seed, so key[perm[j]] = shown[j].
   - Probe (a temp test, deleted): for 3000 random user ids × the 3 shipped orders, re-running `toPlayableOrder`
     on positional placeholder steps with the same seed recovered the exact key **9000/9000** times.
     The shuffle's other properties hold: key shown 0/9000; a 2-step item key-free over 100 000 seeds;
     23 / 5 / 119 distinct layouts for the 4-, 3- and 5-step orders.
   - The iteration-1 label sort did not have this property: it was a function of the step set, not the key order.
     So this change turns "one move from the key" into "the key itself, for anyone who runs 30 lines".
   - Scenario: a learner pastes `orderSeed` + `toPlayableOrder` into the console with their `sub` and gets every
     order right, which feeds FSRS and the group's forest.
   - Fix (no re-freeze needed): put a server-only secret into the seed. For example, the page passes
     `userId: <HMAC(server secret, user.id)>` computed in `src/server/**`. The frozen SC-8 row only fixes
     `orderSeed(userId, id)` for whatever `userId` it is given.
   - Note that "shuffle a canonical order, reshuffle if it equals the key" without a secret still leaks the key
     whenever the first shuffle hits it (1/6 of learners for a 3-step item). The secret is what closes it.

D-2. **[should-fix]** `src/features/lesson/components/order-step/hooks/use-order-step.ts:84`. The focus effect depends on
   `[focusKey]` only, so two moves in a row that target the same Add button leave focus on `<body>`.
   - Scenario (shown order RUN, REQ, RES): Enter on "Add: Send the result" moves focus to REQ. The learner
     Shift+Tabs to "Add: Run the tool" and presses Enter. `focusAfterAdd` returns `add:REQ` again, the effect does
     not re-run, and the pressed button has unmounted.
   - Probe (temp UI test, deleted): `document.activeElement` had no accessible name after the second move.
   - Fix: key the effect on a move counter (e.g. `{ key, n }`), or focus in a layout effect keyed on `placed`.
     Add this case to `order-step-keyboard.test.tsx`.

D-3. **[note]** `.planning/tasks/MF-0066/GOAL.md:94`. The C-2 trace row still says "steps arrive sorted by label (never the key:
   rotated by one if equal)". The decision text (l.116) and SC-3 describe the seeded permutation. Update the row with D-1's fix.

D-4. **[note]** `packs/prod-prompting/orders/D2.S2.yaml:51`, `:30`. Titles do not give the order away, but they anchor ends.
   - `order-tool-error`'s title fixes the first step (Claude's response) and the last (the next request).
   - `order-round-trip-start`'s title fixes step 1, so with 3 steps it is close to free. Its level is foundation
     and the verifier recorded a note.
   - `order-tool-error` and `order-client-tool-turn` also carry the identical five `orderedBy` quotes and share
     STOP→RUN→OK. They are near-duplicates within one skill's single order slot. This is acceptable for a first set.

D-5. **[note]** `src/dev-seed/plan-order-approvals.ts` is sound for the re-run rules.
   - It is pure and planned apart from the worlds, and the MF-0068 SC-5 deep-equal tests are green. Approvals ride
     the existing `seedDemoWorlds` path, so the manifest's delete-then-insert covers idempotency, as observed on
     two runs.
   - It skips: excluded items (your reviews, maintainer resolutions, real users' flags), world-flagged and
     official items, and the author and `you`.
   - Approving AI-authored content with demo personas is acceptable only because the guard refuses non-local
     targets first. It must never be reused outside `dev:seed`.
   - Gap: no DB test asserts the seeded diagram ends up `approved` after `dev:seed`. The unit plan and my manual
     two-run check cover it.

## Delta review (iteration 3)

Fresh context. Reviewed in `/Users/sorinvieriu/Projects/mind-forge-MF-0066` (HEAD = main c7a042b), uncommitted diff
vs HEAD plus untracked, excluding `.planning`. Only the iteration-3 delta (fixes for D-1, D-2, D-3, D-5) was checked.
The front matter above replaces iteration 2's `changes-requested` at `9ca0f7bd…dc9df88`.

Runs I did myself:
- `pnpm typecheck`, `pnpm lint`: exit 0. `pnpm gate:planning`: ok (70 folders).
- `order-shuffle-seed.test.ts`, `order-step/__tests__/*` (acceptance, keyboard, utils), `to-player-steps.test.ts`,
  `mf-0066-order-engine.acceptance`: 6 files, 50/50.
- FROZEN: MF-0066 all hashes match. MF-0007 current hash (`c2b9e34f…`) matches `files[]` and the latest history
  entry. Only the older history entries differ, as they should.
- `pnpm build`: exit 0, with no `ORDER_SHUFFLE_SECRET` in the worktree's `.env.local`. The lesson slot is dynamic,
  so the guard does not run at build. `.next/static` has no `ORDER_SHUFFLE`, `createHmac`, the local fallback
  string or the mulberry32 constant. One chunk has `0x811c9dc5`: it is a CSS-parser hash in a framework chunk,
  not `orderSeed`.
- Under the db lock (acquired as MF-0066-review3, released), after `pnpm db:reset`: `order-approvals-seed.db.test`
  plus `mf-0066-order-keys.db.acceptance`: 2 files, 8/8.
- Probe (a temp test, deleted). It used the real `toPlayableOrder` and `orderShuffleSeedWith`, and 600 000 uniform
  32-bit seeds per size:

  | Steps | Layouts | Key shown | Max layout share | Uniform | chi2 / df |
  |---|---|---|---|---|---|
  | 3 | 5 | 0 | 0.20055 | 0.20000 | 4.2 / 4 |
  | 4 | 23 | 0 | 0.04396 | 0.04348 | 23.2 / 22 |
  | 5 | 119 | 0 | 0.00867 | 0.00840 | 119.9 / 118 |

### Iteration-2 findings: status

| # | Status |
|---|---|
| D-1 | **closed.** See the analysis below. |
| D-2 | **closed.** `use-order-step.ts:57-91`: the effect is keyed on `{ key, n }` with `n` incremented per move. The new keyboard case (`order-step-keyboard.test.tsx:88`) has its RED pasted in LOOP-VERIFY (focus on body). It is green now. |
| D-3 | **closed.** The GOAL.md C-2 row (l.94) now names the HMAC seed. |
| D-5 | **closed.** `order-approvals-seed.db.test.ts` runs the same `planSeed` → `withOrderApprovals` → `seedDemoWorlds` path that `scripts/dev-seed.ts:123-143` uses. It asserts `private.item_state = 'approved'` plus exactly 2 run-scoped demo approvals at the current hash, from neither you nor the author. After a reset nothing else approves the diagram, so the test would go red without the approvals. Green. |

### D-1 analysis

- **Secret handling** (`src/server/content/order-shuffle-seed.ts`):
  - The module starts with `import "server-only"`.
  - The env value is parsed with zod (trim, min 32) at the boundary.
  - The secret is never logged. The thrown message has the zod issue text, not the value.
  - It is not derived from the Supabase keys. `dev-setup.mjs:148-151` keeps an existing value of 32 or more
    non-space characters, else writes `randomBytes(32)` hex, and prints only created/updated.
  - `.env.example` documents the variable. The evidence (l.47) names the deploy step.
- **Fail-closed:**
  - With `NODE_ENV=production` and a missing, empty, whitespace-only or short secret, `shuffleSecret()` throws.
  - The throw is lazy. `seedOf` runs only in the `order` case of `toPlayerSteps`, so only a lesson whose plan has
    an order step fails. Today that is D2.S2.
  - It fails the whole `LessonSlot`, card and diagram included, into the segment's `error.tsx` ("This lesson could
    not load"). Other lessons and grading (`grade-order.ts` never reads the secret) are unaffected.
- **Fallback:**
  - The fixed `LOCAL_SECRET` is used only when the secret is unset and `NODE_ENV !== "production"`.
  - `next build`, `next start` and every Vercel deployment (preview included) run with `production`, so a
    deployed environment cannot reach the fallback.
  - A short secret set in dev throws rather than falling back.
- **Payload vs key:**
  - The playable order carries id, skill, origin, title, `{id: node, label}` steps and the hash.
  - The node ids are semantic (`STOP`, `RUN`, `OK`, `ERR`, `REQ`, `RES`), not positional.
  - Labels are shown in the permuted order, so their order equals the layout and adds nothing.
  - The only caller of `toPlayerSteps` in production code is the lesson page, with `orderSeedOf`
    (`page.tsx:80-87`). The two seeding variants are mutually exclusive at the type level (`?: never`).
- **What the layout reveals without the secret:** the seed is a PRF output, so the layout is a uniform draw from
  the n!−1 non-key permutations (table above). The posterior over the key is uniform over every arrangement except
  the shown one. A learner learns only "not this layout", by design.
- **Brute force:** there is no offline oracle. To test a guessed seed you need the key, and the key arrives only
  after grading.
  - Once a learner knows the key and their layout for an item, about 2^32/119 to 2^32/5 seeds fit it, so they
    narrow that one item's seed.
  - That seed never feeds back: the layout is already fixed, and other items' seeds are independent HMAC outputs.
  - Recovering a 32-byte HMAC key from truncated outputs is infeasible.

### Findings

R3-1. **[note]** `src/engine/content/playable-order.ts:32` and `src/engine/content/order-seed.ts:1-5`. The doc
   comments are stale.
   - `toPlayableOrder` still says the seed is "`orderSeed(userId, orderId)`, server-side".
   - `orderSeed` still says "nothing about the key goes into it. Computed on the server".
   - Since D-1, that seed is exactly what must not reach production, and these comments invite a future caller to
     use it. They should point at `orderShuffleSeed` and mark `orderSeed` test/fixture-only.

R3-2. **[note]** `src/features/lesson/utils/to-player-steps.ts:13-14,35`. The `{ userId }` variant (the public
   `orderSeed`) is still part of the production API, and `@/engine/content` exports `orderSeed`.
   - Scenario: a second surface that plays orders (a storm, a duel) calls `toPlayerSteps({ …, userId })` and
     reintroduces D-1 silently. Nothing but this comment stops it.
   - Acceptable now, because SC-8's frozen rows pin `userId` and the only production caller is correct. A follow-up
     could move the public seeding behind a test helper once SC-8 is next re-frozen.

R3-3. **[note]** `src/server/content/order-shuffle-seed.ts:18-27`. The guard is lazy: a deploy without the secret
   passes the build and every page until a learner opens a lesson with an order step. That lesson then fails
   whole. The deploy step in the evidence is the control. A boot-time check (instrumentation) would surface the
   missing secret at deploy, but it is not needed for this ticket.

R3-4. **[note]** This residual is out of the delta and inherent to SC-4. The key is revealed after the first graded
   answer, so a learner can read it by answering once with a throwaway account, or by elimination across about
   12, 84 or 597 accounts (measured median for 3, 4 and 5 steps) via "never the key". Either way the main account's
   first answer is then right. The secret closes the single-account recomputation that D-1 named. It cannot close
   sock-puppets, any more than for MCQs.

No blocking findings.

## Delta (orchestrator, 2026-11-09)
R3-1 applied: the `orderSeed` and `toPlayableOrder` doc comments now say production seeds come from `orderShuffleSeed`
and `orderSeed` is tests-only (comments only, no code change). R3-2 (make the public `{ userId }` path unreachable from
production code) and R3-3 (boot-time secret check) → follow-up MF-0079. R3-4 accepted (same as multiple choice).
Verdict stands: APPROVE.
