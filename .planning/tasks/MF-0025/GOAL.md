---
ticket_id: MF-0025
tier: normal
stage: handoff
builds_on: [MF-0003, MF-0004, MF-0007, MF-0012, MF-0032]
last_iteration: 1
goal_status: complete-pending-manual-commit
---

> Drafted 2026-11-04 by MF-0012 (user decision C-3), from the MF-0003 review note "orphaned keys".
> Intake + design 2026-11-05.

## Objective

**Today.** `scripts/sync-question-keys.mjs` deletes stale `private.question_keys` / `private.items`
rows only for packs whose folder still exists (`where pack_slug = ${pack}`). When a pack folder is
removed, its slug leaves `private.packs` (and `private.pack_skills` by FK cascade) but its keys and
item rows stay. Consequence found at intake: `private.record_attempt` reads only `question_keys`
(+ `items` for the hash), never the registry, so a removed pack's questions **still grade and still
write `public.attempts`** under a slug no pack owns; `review_item` likewise still accepts its items.

**End state.** One sync run removes the keys and items of every unregistered pack in the **same
transaction** as the registry delete, so after it commits no key or item row exists whose
`pack_slug` is not in `private.packs`.

## Affected users and surfaces

- Learners: `record_attempt` / storms over a removed pack refuse (`P0002 unknown question`) instead of grading.
- Maintainers: review / flag / analogy-approval rows of a removed pack's items are deleted (FK cascade).
- Tables: `private.packs`, `private.question_keys`, `private.items` (+ cascades `item_reviews`,
  `flag_resolutions`, `analogy_approvals`). No schema change.
- Script: `scripts/sync-question-keys.mjs` (`pnpm db:sync-keys`, `pnpm db:reset`).

## Evidence read at intake (what references keys / items)

| Table | Reference | On pack removal |
|---|---|---|
| `public.attempts` | `pack_slug`, `question_id` by value, no FK | kept (history; forest/heatmap read by skill) |
| `public.storms` / `storm_questions` | by value, no FK | kept; `finalize_storm` step (a) already voids a question whose key or item is gone |
| `private.item_reviews`, `flag_resolutions`, `analogy_approvals` | FK → `items(item_id)` **on delete cascade** | deleted with the item |
| `private.pack_skills` | FK → `packs(slug)` on delete cascade | already deleted today |
| `public.groups.pack_slug` | by value, no FK | kept; out of scope |

Precedent: the sync **already** cascades reviews today when one item is removed from a pack that
still exists (MF-0007 per-pack stale delete). Deleting a removed pack's items is the same rule at
pack scope.

## Constraints

1. No row of a still-present pack changes (keys, items, reviews, `hash_synced_at`).
2. Orphan deletes run in the registry transaction (`sql.begin` that deletes from `private.packs`).
3. Validation of ALL packs still runs before the first connection (MF-0012), so a bad pack deletes nothing.
4. The remote guard (main + clean `packs/`) and the `MINDFORGE_PACKS_DIR` + `SUPABASE_DB_URL` refusal stay.
5. Local stack only; no migration.

**Constraints → how met:** 1 → SC-3 snapshot of non-fixture rows; 2 → SC-4; 3 → unchanged code path,
covered by the frozen MF-0012 SC-5 / MF-0024 SC-3 tests; 4 → unchanged lines, grep at review; 5 → no
`supabase/**` diff.

## Success Criteria

Proof file: `src/server/db/__tests__/mf-0025-orphan-keys.db.acceptance.test.ts` (local stack, fixture
pack `mf0025-gone` over a temp copy of the real packs, MF-0012/MF-0016 precedent).

- [x] **SC-1** After a sync over a folder set without `mf0025-gone` (it was synced before), there are
  **0** rows in `private.question_keys` and **0** in `private.items` with `pack_slug = 'mf0025-gone'`,
  and the slug is not in `private.packs`. Proof: DB acceptance test.
- [x] **SC-2** After that run, `public.record_attempt('mf0025-gone.W.1.q1', '{A}')` as a learner fails
  with SQLSTATE `P0002`; the learner's earlier attempt on it (made while registered) is still in
  `public.attempts`. Proof: DB acceptance test.
- [x] **SC-3** That run leaves every row of the other packs unchanged: `private.packs`,
  `question_keys`, `items` (incl. `hash_synced_at`, plus their `item_reviews`) where
  `pack_slug <> 'mf0025-gone'` are deep-equal before and after, every column except `updated_at` (every
  upsert bumps it today). Proof: DB acceptance test (snapshot). A regression lock: frozen green with this
  reason, since today's sync already leaves other packs alone.
- [x] **SC-4** The orphan deletes run inside the same `sql.begin` callback as `delete from private.packs`.
  Proof: code read at review, quoted in LOOP-VERIFY (no fixture can force a failure between the two
  statements; see C-2).
- [x] **SC-5** A review row on an orphaned item is deleted with it (cascade), and a second identical sync
  run changes no row (idempotent). Proof: DB acceptance test.
- [x] **SC-6** `pnpm typecheck && pnpm lint && pnpm test` exit 0, and `pnpm test:db` has **no new failure** vs
  the HEAD baseline (`mf-0013-storms` 7 red at `32d0abe`, split out to MF-0050). Proof: VERIFY receipt.
  *Amended 2026-11-05 by the user (was: `pnpm test:db` exits 0).*

### Edge-input table (SC-1..5)

| Input state | Result | Decided by |
|---|---|---|
| no pack removed | no deletes (`not (slug = any(packs))` matches nothing) | follows from the SQL |
| pack removed, has keys + items + reviews | all deleted, reviews by cascade | **C-1 (user)** |
| pack removed, has attempts / storms | kept; storms void at finalize | existing MF-0013 rule |
| removed pack re-added later | keys/items re-inserted, new `hash_synced_at`, reviews NOT restored | follows from C-1 |
| orphan keys from a pack removed before this ticket | deleted on the first run | follows from the SQL |
| a key/item whose `pack_slug` is registered but folder copy is partial (fixture dir) | unchanged behaviour (per-pack delete) | out of scope |

## Decided without a question

- Attempts and storm rows are kept: history keyed by value, no FK, and storm finalize already handles a
  missing key (MF-0013 `finalize_storm` step a).
- No migration: an FK `question_keys/items.pack_slug → packs on delete cascade` would also do it, but
  raises the ticket to high-risk (schema) for the same outcome; rejected in PLAN.
- `groups` of a removed pack: untouched (no FK, app behaviour for such a group is a separate question).

## Concerns

| # | Concern | Owner | Status |
|---|---|---|---|
| C-1 | Deleting a removed pack's items cascades its review verdicts, flag resolutions and analogy approvals. Re-adding the folder does not restore them. Options: **A** delete keys + items (cascade; same as today's per-item rule); **B** delete keys only, keep items + review history (grading stops; registry keeps orphans); **C** refuse the sync while a removed pack still has review rows unless `--prune-reviews` is passed. | user | resolved 2026-11-05: **A** (keys + items, reviews cascade) |
| C-3 | The frozen MF-0007 SC-1 asserted the old rule (`sync never touches a pack it doesn't own`) and its fixture put items under an unregistered slug. | user | resolved 2026-11-05: re-freeze MF-0007 — assertion flips to 0, fixture re-seeded after it (FROZEN.json history) |
| C-4 | `pnpm test:db` was already red at HEAD (`mf-0013-storms`, 22023 `not a playable question for this storm`); not caught at preflight because `test:db` was not run there. | user | resolved 2026-11-05: SC-6 amended, MF-0050 reserved |
| C-2 | SC-4 cannot be forced by a fixture: the only `private.packs` CHECKs (`exam_* > 0`, slug pattern) are also enforced by the validator, which runs before connecting. A test-only failure hook in the script is rejected (production code shaped for a test). | agent | resolved: SC-4 is a code-read proof |

## Out of Scope

- Groups / UI for a removed pack. Composite keys (MF-0024 option C). Learn-the-key (MF-0027).

## Iteration Log

- 2026-11-05 intake + design draft.
- 2026-11-05 iteration 1: freeze (3 red + SC-3 lock) → S1 in the registry transaction → MF-0025 4/4 green.
  TEST found the frozen MF-0007 collision (C-3, re-frozen with user approval) and the pre-existing MF-0013
  red (C-4, SC-6 amended, MF-0050). Hand-off.
