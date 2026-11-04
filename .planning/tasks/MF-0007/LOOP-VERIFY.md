# MF-0007 — LOOP-VERIFY

Bindings: no `ticket:*` scripts; skill defaults (FREEZE by hand, hashes over LF content).
TEST_DB = local Supabase stack (`pnpm test:db`). GATES = the MF-0005 grants gate (a frozen DB test).

## RED at freeze (2026-11-03)

`pnpm exec vitest run --project db src/server/db/__tests__/mf-0007-review.db.acceptance.test.ts`,
run twice, identical (users are per-run, teardown is child-first and tolerates missing tables):

```
❯ |db| src/server/db/__tests__/mf-0007-review.db.acceptance.test.ts (7 tests | 7 failed)
× SC-1: sync registers every item of every pack with its content hash; a second run changes nothing
× SC-2: a user with no group for the pack cannot review; a member can
× SC-3: the author can't approve; one reviewer counts once; two distinct non-authors approve
× SC-4: flags need a comment; an open flag hides; maintainers alone dismiss or reject
× SC-5: a new content hash makes the item unreviewed again; old reviews stop counting
× SC-6: official = approved with zero reviews; cards need the analogy owner or the 48 h fallback
× SC-7: the shared reader serves only approved + unreviewed; flagged and rejected never appear
PostgresError: relation "private.items" does not exist
AssertionError: expected 'PGRST202' to be '42501'      ← function not found
AssertionError: expected 'PGRST202' to be 'ok'
Unknown Error: Could not find the function public.review_states(p_pack_slug) in the schema cache
```

`pnpm exec vitest run --project unit src/engine/memory/__tests__/mf-0007-replay.acceptance.test.ts`:

```
× SC-8: rejected questions and attempts after reviewing are excluded; flagged still count
Error: not implemented
```

`pnpm typecheck` and `pnpm lint` (213 files) pass with the stubs in place.

Not frozen: SC-9 (browser), SC-10 (gate + advisors + receipt).

## Baseline (2026-11-04, before any change)

Docker was stopped; started it, the stack came back. Then: `pnpm typecheck` ✓, `pnpm lint` ✓ (213
files), `pnpm test` 1 failed (SC-8, frozen red) | 103 passed, `pnpm test:db` 7 failed (MF-0007
SC-1…SC-7, frozen red) | 17 passed. No other red.

## Review iteration

`REVIEW.md` round 1: changes-requested (1 blocking: verdict bound to the registry hash, not the
version read). Regression test `src/server/db/__tests__/mf-0007-content-hash.db.test.ts`, RED on the
unfixed code:

```
× refuses an approval or a flag of a version the registry no longer holds
× refuses a maintainer decision or an analogy approval on a version they didn't see
× tells the queue which version each candidate is
AssertionError: expected 'PGRST202' to be '55000'
AssertionError: expected 'PGRST202' to be 'ok'
AssertionError: expected [ { …(3) }, { …(3) } ] to deep equally contain ObjectContaining{…}
Tests  3 failed (3)
```

After the fix (migration re-applied by `supabase db reset --local` + manual sync): `Tests 3 passed (3)`.

## Receipt — code-diff hash 610f7c1cc4acca6f806308d109dd335b69f4fe9f9b245aac7569d708b616496e

Hash = `{ git diff HEAD -- . ':!.planning'; untracked files (sorted, "== path" + content) } | sha256sum`.

| Check | Result |
|---|---|
| frozen hashes (LF) | both match FROZEN.json (5cda81f7…, be25500e…) |
| `pnpm typecheck` | ✓ Types generated successfully, tsc clean |
| `pnpm lint` | Checked 271 files, no fixes |
| `pnpm test` | Test Files 40 passed (40) · Tests 136 passed (136) |
| `pnpm test:db` ×2 | Test Files 8 passed (8) · Tests 27 passed (27), both runs |
| `supabase db reset --local` | all 4 migrations applied; sync: 53 keys, 56 items registered |
| `supabase db advisors --local` | No issues found |
| `supabase db lint --local` | No schema errors found |
| `pnpm build` | ✓ Compiled; /review/[packSlug] and /flags ◐ (PPR) |
| browser (port 3001) | see SC-9 row |

## SC verdicts

| SC | Verdict | Evidence |
|---|---|---|
| SC-1 | PASS | frozen DB SC-1 ✓ (sync twice, same rows; fixture pack untouched) |
| SC-2 | PASS | frozen DB SC-2 ✓ |
| SC-3 | PASS | frozen DB SC-3 ✓ |
| SC-4 | PASS | frozen DB SC-4 ✓; browser: empty flag refused, dismiss by maintainer |
| SC-5 | PASS | frozen DB SC-5 ✓; plus content-hash regression test (verdict bound to version read) |
| SC-6 | PASS | frozen DB SC-6 ✓; browser: analogy owner approved the Temperature card |
| SC-7 | PASS | frozen DB SC-7 ✓; duel page + action filter via `isPlayable(reviewStateOf(...))` |
| SC-8 | PASS | frozen unit SC-8 ✓; today, groups/[id], duel replay `countableAttempts` (reviewer-checked) |
| SC-9 | PASS | browser, two local users: queue 53 = 56 − 3 official; heaviest skill D2.S5 (8.6) first, full key + rationales; approve → 52; flag (comment required) → 51, next D2.S4 (7.4); non-maintainer /flags → 404; maintainer sees "Open flags 1", flagger name, dismiss → none open; analogy approved. After the review fix: approve again, stored row bound to current hash (`bound_to_current = t`). |
| SC-10 | PASS | MF-0005 grants gate green with allow-list unchanged; advisors + db lint clean; shadcn (textarea via CLI) + tokens only (reviewer-checked) |

Unverified: the flag/dismiss ordering fix (`for update` + `clock_timestamp()`) has no concurrent test.
