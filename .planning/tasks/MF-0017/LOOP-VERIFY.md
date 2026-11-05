---
ticket_id: MF-0017
iteration: 1
verdict: DONE
---

# MF-0017 LOOP-VERIFY — Iteration 1

## Baseline (2026-11-05, before any change)

- `pnpm typecheck` 0 · `pnpm lint` 0 (540 files) · `pnpm test` 119 files / 522 tests.
- `pnpm test:db` not run at baseline (Docker was down); see "Pre-existing" below.

## RED at freeze (2026-11-05, frozen by hand: no `ticket:freeze` script; FROZEN.json)

typecheck 0 · lint 0 (551 files) with the three files below. Every red is runtime.

| File | SC | Cases | First failure line |
|---|---|---|---|
| `src/engine/expedition/__tests__/mf-0017-expedition.acceptance.test.ts` | SC-4 (+ C-2 gate) | 11 × | `Error: not implemented` (summarizeExpedition / isExpeditionAllowed stubs) |
| `src/server/db/__tests__/mf-0017-expedition.db.acceptance.test.ts` | SC-1 | 6 × | `AssertionError: expected 'PGRST202' to be '42501'` (start_expedition absent) |
| same | SC-2 | 2 × | `PostgresError: relation "public.expeditions" does not exist`; parity: `expected { code: 'PGRST202', … } to be null` (the local countableAttempts total reached 7 before the RPC call failed) |
| same | SC-3 | 4 × + 1 ✓ | `AssertionError: expected 'PGRST205' to be '42501'` (table absent); `expected { exists: false, … } to deeply equal { exists: true, … }`. The ✓ is the attempts-RLS own-rows guard, which already holds today (regression lock) |
| `src/features/expeditions/components/start-expedition-form/__tests__/mf-0017-start-expedition-form.acceptance.test.tsx` | SC-5 (form) | 5 × | `Error: not implemented` (StartExpeditionForm stub) |

DB file run twice: identical 12 failed / 1 passed both times; 0 leftover rows afterwards. Re-checked at
freeze: unit + ui 16/16 red (`Test Files 2 failed (2)`, `Tests 16 failed (16)`).

## Review fix B1 (join leak) — RED first

Review 1 (tree 0229eac5…): changes-requested, B1: a join made the total jump by the joiner's own
pre-join count. User chose "count only after joining". Frozen DB acceptance re-frozen (user-approved,
FROZEN.json `history`: be8f1bbc… → 8a9d5b30…). Against the UNFIXED SQL:

    × SC-2: progress counts only countable correct recalls … : 7   AssertionError: expected 8 to be 7
    × SC-2: parity: countableAttempts over the same fixture …     AssertionError: expected 8 to be 7
    Tests  2 failed | 11 passed (13)

Then `a.answered_at >= m.joined_at` in `private.expedition_progress`; migration edited in place and
re-applied (drop its objects + history row, `supabase migration up --local`; no reset). 13/13 green.
Review 2 on tree b7a1fb53…: **approve**, 0 blocking (REVIEW.md).

Post-review change: one comment line in the migration header ("… since they joined", the reviewer's
own nit). No SQL or function body changed; not re-read by the reviewer. Final tree 11b2794d…

## Receipt (final tree `11b2794d…`; checks ran on b7a1fb53…, which differs by that comment line only)

| Check | Output |
|---|---|
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | `Checked 563 files … No fixes applied.` (also on 11b2794d…) |
| `pnpm test` | `Test Files 123 passed (123)` · `Tests 548 passed (548)` |
| `pnpm test:db` | `Test Files 1 failed \| 18 passed (19)` · `Tests 3 failed \| 81 passed (84)`; the 3 are the pre-existing MF-0016 sync tests; MF-0017 13/13, MF-0005 green |
| `pnpm build` | exit 0; `/groups/[groupId]` ◐ |
| `supabase db advisors --local` | `No issues found` |

## Receipt 1 (superseded; tree `0229eac5…`, 27 MF-0017 paths, sha256 over LF content with path headers)

| Check | Output |
|---|---|
| `supabase migration up --local --include-all` | applied mf0016, mf0032 (pending from main) + mf0017; no reset |
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | `Checked 563 files … No fixes applied.` exit 0 |
| `pnpm test` | `Test Files 123 passed (123)` · `Tests 547 passed (547)` |
| `pnpm test:db` | `Test Files 1 failed \| 18 passed (19)` · `Tests 3 failed \| 81 passed (84)` — the 3 are pre-existing (below); MF-0017 file 13/13 and MF-0005 grants gate green |
| `pnpm build` | exit 0; `/groups/[groupId]` ◐ (partial prerender) |
| `supabase db lint --local --level warning` | `No schema errors found` |
| `supabase db advisors --local` | `No issues found` |
| browser :3001, 4 local users | see evidence file |

Frozen hashes: FROZEN.json written at freeze; files untouched since (reviewer recomputes).

## Pre-existing (not this diff)

- `src/server/db/__tests__/mf-0016-cuckoo-keys.db.acceptance.test.ts` SC-2 ×3: `sync failed: ENOENT … packs\mf0016-cuckoo\pack.yaml`.
  `readPackMeta` in `scripts/sync-question-keys.mjs` (MF-0013) reads `pack.yaml` unconditionally; the
  MF-0016 fixture pack has none. MF-0013 × MF-0016 merge interaction on `main`; neither file is in this diff.

## SC verdicts

| SC | Verdict | Evidence |
|---|---|---|
| SC-1 | PASS | DB acceptance SC-1 ×6 green (member/non-member 42501, 3-member P0001, bad domain/target 22023, DB-set times, 23P01 second start, race → exactly one row); browser start as admin |
| SC-2 | PASS | DB acceptance SC-2 ×2 green (re-frozen): 17 fixture rows → 7 counted incl. a pre-join row that does not, equal to `countableAttempts` + joined_at (parity) |
| SC-3 | PASS | DB acceptance SC-3 ×5 green; MF-0005 grants gate green and unedited |
| SC-4 | PASS | engine acceptance 11/11 green |
| SC-5 | PASS | form acceptance 5/5; browser: admin form + field error, started card, 6 of 30 · 20%, member B same total and no form, 2-member group "Expeditions need at least 4 members." |
| SC-6 | PASS | final receipt above; advisors clean; grants gate unedited; REVIEW.md approve on b7a1fb53… |
