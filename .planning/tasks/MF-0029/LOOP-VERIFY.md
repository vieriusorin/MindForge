# MF-0029 — LOOP-VERIFY

Bindings: no `ticket:*` scripts; FREEZE by hand (sha256 over LF content). TEST_DB = the running local stack (`pnpm test:db`).

## Preflight (2026-11-04, `feat/MF-0014` tree incl. MF-0014's uncommitted work)

`pnpm typecheck` / `pnpm lint` / `pnpm test` green (255/255) · `pnpm test:db` 32/32.

## RED at freeze (2026-11-04)

Typecheck green and `pnpm lint` (392 files) clean with the stubs (`src/dev-seed/{types,guard,plan-demo-world,seed-demo-world}.ts`;
`load-seed-inputs.ts` is real: it only reads pack files). Run twice, identical; 0 leftover `mf0029` users after each run.

`pnpm exec vitest run --project unit src/dev-seed`:
```
× SC-1  × SC-2  × SC-3   Error: not implemented   Tests 3 failed (3)
```
`pnpm exec vitest run --project db src/dev-seed`:
```
beforeAll: Error: not implemented (planDemoWorld)   Tests 4 skipped (4)
```
Not frozen: SC-1's CLI refusal run and SC-7's browser check (keep their named proofs).

## Baseline (BUILD start)

Preflight above; only red: the frozen MF-0029 tests.

## Verification — Iteration 1 (2026-11-04)

| SC | Verdict | Evidence |
|----|---------|----------|
| SC-1 | PASS | plan acceptance SC-1 green; `guard.test.ts` 2/2. CLI: `SUPABASE_DB_URL=postgres://x@example.com/db pnpm dev:seed` → "Refusing SUPABASE_DB_URL: the demo seed writes to the local stack only. Unset it." exit 1 (before `supabase status` is read); `MF_AUTHOR_EMAIL= pnpm dev:seed` → "Set MF_AUTHOR_EMAIL …" exit 1 |
| SC-2 | PASS | plan acceptance SC-2 green |
| SC-3 | PASS | plan acceptance SC-3 green. Probe at the test's `now`: steady 23 saplings · you 21 · lapsed 10 wilting · new 22 seeds · strong mean R 1.000 vs next best 0.986 · no tree/ancient |
| SC-4 | PASS | db acceptance SC-4 green |
| SC-5 | PASS | db acceptance SC-5 green (incl. `record_attempt` parity on 10 planned answers) |
| SC-6 | PASS | db acceptance SC-6 green. Real run twice: `demo_users 5, groups 1, your_attempts 88` (not 176) |
| SC-7 | PASS | browser :3001, isolated context, signed in as you via Mailpit magic link: Today "20 of 25 skills growing", Seed 5 · Sprout 3 · Sapling 17, "1 tree needs water", a "Fading" focus item; group page: 6 avatar members, heatmap with all 8 regions; Review: "51 in your queue", "Open flags 1"; flags screen: the seeded flag on `ccdv-f.D2.S2.q1` (AI) by Dan New, plus "Analogies to approve". Screenshots: `.planning/evidence/MF-0029/{today,group,review,flags}.png` |

Real seed: `Seeded "Demo study group" (ccdv-f): 6 learners, 861 answers, 5 reviews.` Reviews after the flag fix:
4 approvals (2 on `D2.S3.q2`, 1 each on `D1.S2.q1`, `D7.S1.q2`), 1 flag on `D2.S2.q1`, all `origin: ai`.

## Gates and suite

`pnpm typecheck` clean · `pnpm lint` 398 files · `pnpm test` 70 files **268/268** · `pnpm test:db` 11 files **36/36**.
Frozen hashes: MF-0029 ×2, MF-0014 ×2, MF-0008 ×2 all `OK`.

## Receipt — code-diff hash b8a46db488829e75f303d8938575b7843f980d454971a5c4ed51401533750bf6

Same hash recipe as MF-0014. The tree also holds MF-0014's uncommitted work (same branch). Verdict: **DONE** for this tree,
pending the fresh-context review (high-risk).

## Review round 1 → fixes (2026-11-04)

REVIEW.md (hash b8a46db4…) changes-requested, 2 blocking. Regression tests in `src/dev-seed/__tests__/seed-regressions.db.test.ts`,
both shown RED on the unfixed code:
```
× a manifest from another account of yours (e.g. before a db:reset) deletes none of your answers
  AssertionError: expected +0 to be 1 // Object.is equality
× refuses to review an item you have already rejected
  AssertionError: promise resolved "{ youAttemptIds: [ 23290, …(87) ] }" instead of rejecting
```
Fixes: manifest carries `youId`, the delete runs only for the same account; the writer re-checks `private.item_state`
and refuses a rejected item; the CLI passes items with any flag resolution to the planner (`excludeItemIds`); note
taken too: the guard also checks the Auth API URL (`guard.test.ts`). Local manifest upgraded in place (88 of 88 ids
owned by the account); re-seed kept `your_attempts 88`.

Gate: typecheck · lint 399 files · test **270/270** · test:db **38/38** · frozen MF-0029/0014/0008 unchanged.

## Receipt — code-diff hash cf2457fe4a44a0f71b76ac5917a9eccd7a95b7e47ac614c27f0940f6e520a314

DONE for this tree, pending review round 2.
