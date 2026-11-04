---
ticket_id: MF-0016
iteration: 1
verdict: DONE
---

# Loop Verify — Iteration 1

## Baseline (2026-11-04, before any change)

- `pnpm typecheck` OK · `pnpm lint` OK · `pnpm test`: Test Files 73 passed (73), Tests 286 passed (286).

## RED at freeze (2026-11-04)

Stubs: `toPlayableCuckoo`, `checkCuckooAnswer`, `pickSessionItems`, `answerCuckoo`, `CuckooSession`
throw `not implemented`; `parseContent` returns `cuckoos: []`. TYPECHECK and LINT green at freeze.

| File | SC | First failure (pasted) |
|---|---|---|
| `src/engine/content/__tests__/mf-0016-cuckoo.acceptance.test.ts` | SC-1 | `AssertionError: expected [] to deeply equal [ { …(12) } ]` |
| 〃 | SC-1 rejects ×9 | `Error: expected a ContentValidationError, nothing was thrown` |
| 〃 | SC-3, SC-4 ×10 | `Error: not implemented` |
| 〃 | SC-9 | `AssertionError: expected null to deeply equal { kind: 'cuckoo', item: { …(12) } }` |
| `src/engine/content/__tests__/mf-0016-cuckoo-content.acceptance.test.ts` | SC-8 | `AssertionError: expected [ 'D6.S1', false ] to deeply equal [ 'D6.S1', true ]` |
| `src/engine/memory/__tests__/mf-0016-session.acceptance.test.ts` | SC-5 ×4 | `Error: not implemented` |
| `src/server/db/__tests__/mf-0016-cuckoo-keys.db.acceptance.test.ts` | SC-2 ×3 | `expected [] to deeply equal [ { …(4) } ]` · `expected [ null, null ] to deeply equal [ true, false ]` · `expected { keys: +0, items: +0, replaced: +0 } to deeply equal { keys: +0, items: +0, replaced: 1 }` — identical on a 2nd run (fixture clean) |
| `src/features/cuckoo/components/cuckoo-session/__tests__/mf-0016-cuckoo-session.acceptance.test.tsx` | SC-6 ×5 | `Error: not implemented` |

Total: 32 unit/ui + 3 db `it` blocks red, every one for its SC's reason.

## Receipt (final tree)

Scoped diff (paths in the hand-off list, `git diff HEAD --` over them):
`sha256 12b277e547b2f6c2c92b9923c8dc4a83c9aa094bacd2bb1c021e7346c3e27147`. REVIEW.md: approve, same hash.

| Check | Tree | Output |
|---|---|---|
| `pnpm typecheck` | 12b277e5 | exit 0 |
| `pnpm lint` | 12b277e5 | `Checked 442 files … No fixes applied.` |
| `pnpm test` | 12b277e5 | `Test Files 83 passed (83)` · `Tests 337 passed (337)` |
| `pnpm build` | 12b277e5 | exit 0, `◐ /play/[packSlug]/cuckoo` |
| `pnpm test:db` | fb763a26 | `Test Files 15 passed (15)` · `Tests 45 passed (45)` — the last delta (fb763a26 → 12b277e5) is a UI label move only (utils.ts, cuckoo-session.tsx, utils.test.ts); test:db not re-run on it |

Frozen hashes: all 8 files in MF-0003/0006/0007/0016 FROZEN.json match (reviewer recomputed).

## SC verdicts

| SC | Verdict | Evidence |
|---|---|---|
| SC-1 | PASS | `mf-0016-cuckoo.acceptance.test.ts` SC-1 ×10 green |
| SC-2 | PASS | `mf-0016-cuckoo-keys.db.acceptance.test.ts` 3/3 green; MF-0003 SC-5 (re-frozen K-3) green |
| SC-3 | PASS | acceptance SC-3 green; signed-in page HTML + DOM probe `hits: []` (evidence file) |
| SC-4 | PASS | acceptance SC-4 ×10 green |
| SC-5 | PASS | `mf-0016-session.acceptance.test.ts` 4/4 green (re-frozen fixture); `select.test.ts` (Duel) green; browser order D6.S2, D6.S1, D7.S1, D6.S3, D7.S2 |
| SC-6 | PASS | `mf-0016-cuckoo-session.acceptance.test.tsx` 5/5 green; browser verdict + focus + "Cuckoo" badge |
| SC-7 | PASS | browser round on :3002 (prod build), 5 `attempts` rows D6/D7, `/today` "1 of 25 skills growing", Sprout 1 |
| SC-8 | PASS | `mf-0016-cuckoo-content.acceptance.test.ts` green: 14 cuckoos, 2 per D6/D7 skill, citations ⊆ skill sources |
| SC-9 | PASS (deviation) | acceptance SC-9 + `review-item/__tests__/cuckoo-body.test.tsx` + RPC approve/flag/stale-hash as a group member; NOT seen rendered inside `/review/ccdv-f` in a browser |
| SC-10 | PASS | receipt above |
