# MF-0034 LOOP-VERIFY

## RED at freeze (2026-11-04)

```
× SC-1 … Error: not implemented      (resolveSeedPacks stub)
× SC-2 … Error: not implemented      (youSkillLimit stub)
× SC-3 … Error: not implemented      (demoGroupName stub)
× SC-4 … Error: not implemented      (seedDemoWorlds stub)   — same on a second run
× SC-5 … Error: not implemented      (seedDemoWorlds stub)   — same on a second run
```
Typecheck green, lint clean ("Checked 439 files … No fixes applied.").

## Receipt: iteration 0, stage: test (2026-11-04)

Diff hash over MF-0034's 7 paths (`git diff HEAD`, untracked marked with `add -N`): `beb27b0debf3e60d19f670fa16a372f61c8d1a3cd5c9fddff36b05ab100aacdc`.
Both frozen hashes are unchanged (`6b7a7602…4d27`, `2929e454…1a2c`).

| Check | Output |
|---|---|
| TYPECHECK | `✓ Types generated successfully`, exit 0 |
| LINT | `Checked 441 files in 109ms. No fixes applied.` |
| TEST | `Test Files 82 passed (82)`, `Tests 335 passed (335)` |
| TEST_DB | `Test Files 15 passed (15)`, `Tests 45 passed (45)` (MF-0029 frozen + regressions included) |
| Real run | `Seeded "Demo study group · Claude Certified Developer – Foundations" (ccdv-f): 861 answers, 5 reviews.` / `… Production-Grade Prompting, Agents & Tool use" (prod-prompting): 861 answers, 5 reviews.` / `Not seeded (no questions): team-onboarding-sample.` |

## SC table

| SC | Verdict | Evidence |
|---|---|---|
| SC-1 pack selection | PASS | frozen unit SC-1 ✓ |
| SC-2 youSkillLimit | PASS | frozen unit SC-2 ✓ |
| SC-3 group name + 7 of 9 | PASS | frozen unit SC-3 ✓ |
| SC-4 two packs written | PASS | frozen DB SC-4 ✓ |
| SC-5 re-run state | PASS | frozen DB SC-5 ✓ (hand-played answer survives; a narrowed run leaves 1 group) |
| SC-6 MF-0029 unchanged | PASS | `pnpm test` + `pnpm test:db` green; reviewer's parity probe: HEAD vs new planner identical on ccdv-f for 5 seeds |
| SC-7 real run | PASS | CLI output above. Read-back: 2 groups × 6 members (2 admins); 861 answers per pack; you answered 20 / 7 skills; 4 approvals + 1 flag per pack; analogy owner of both. HTTP render as steady@: `/review/prod-prompting` 200 with "69 in your queue"; `/groups` lists both groups. Browser drawing not checked (HTTP fallback per memory) |
| SC-8 gates | PASS | above |

## Review (REVIEW.md, approve, 0 blocking, 7 notes) and what was done

- Note 1 (one bad pack wipes the demo world before failing): **fixed**, test first. `mf-0034-regressions.db.test.ts` was RED on the unfixed code:
  `AssertionError: expected { userIds: [ …(5) ], groups: +0 } to deeply equal { userIds: [ …(5) ], groups: 1 }` (both cases).
  Fix: `assertWorldSeedable` runs for every world before step (a), and again inside the transaction. Now 2/2 green.
- Notes 2–5 (CLI): **fixed**. A narrowed run loads only the named packs; unknown or misspelled flags are refused (`unknown argument "--pak"`); the skip message is accurate; `packSlug` comes from `pack.yaml`. Probed: `--pack` → "needs a value", `--pack nope` → "no pack", `--seed x` → "must be an integer", `--pack team-onboarding-sample` → "has no questions". Each refusal happens before any DB call.
- Note 6 (`new Date()` in the frozen DB test): recorded; the file is frozen and follows MF-0029.
- Note 7 (no rollback test): partly covered. The new regressions prove the pre-delete refusal. In-transaction rollback has the reviewer's probe only.

**Verdict: DONE for this tree.** The review was bound to `4d9317f3…`; the post-review fixes are listed above, and the reviewer did not re-read them.

## Delta review (2026-11-04, MF-0034 retro rule)

The post-review changes were re-read: approve, 0 blocking, 3 notes. `reviewed_hash` = `beb27b0d…acdc`, which is the receipt's diff hash, so the review now covers the current tree.
Notes left open: the regression test doesn't exercise the "previous answers / account creation" steps or the rejected / self-review branches; the demo-domain learner check still runs after the deletes; `--seed ""` reads as 0.

## Delta review 2 (2026-11-04)

The delta notes 1–3 were fixed after `da583a0`:
- The demo-domain learner check moved before the deletes, shown RED first: `expected { userIds: [], groups: +0, …(1) } to deeply equal { userIds: [ …(5) ], groups: 1, …(1) }`.
- The regression cases now pass `previous` and assert that your seeded answers survive. New cases cover self-review, an off-domain learner and a rejected item.
- `--seed ""` is refused.

Gates: typecheck ✓; lint clean; `pnpm test` 337/337; `pnpm test:db` 48/48; the real `pnpm dev:seed` re-seeded both packs.
Re-read: approve, 0 blocking. `reviewed_hash` = `e6c02137…3768` (a diff against `da583a0`). Its note 1 (assert the fixture seeded answers) was then added as a test-only change, re-run green.
