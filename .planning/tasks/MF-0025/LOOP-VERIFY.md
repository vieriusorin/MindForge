---
ticket_id: MF-0025
iteration: 1
verdict: PASS
diff_sha256: b75961db28740b6f1700469d01da4d65e9c92f45a61c536ac3837abcd22a1605
---

# LOOP-VERIFY — MF-0025

Receipt: `git diff HEAD | shasum -a 256` = `b75961db28740b6f1700469d01da4d65e9c92f45a61c536ac3837abcd22a1605` (tracked files; untracked: MF-0025 acceptance test,
FROZEN.json, LOOP-PLAN, this file, MF-0050 GOAL, evidence). Default VERIFY: no `ticket:verify` script.

## RED at freeze (2026-11-05, unchanged script)

```
× SC-1: AssertionError: expected { packs: +0, keys: 1, items: 1 } to deeply equal { packs: +0, keys: +0, items: +0 }
× SC-2: AssertionError: expected undefined to be 'P0002'
× SC-5: AssertionError: expected 1 to be +0        (the review row survived)
✓ SC-3  regression lock, frozen green by design
Tests  3 failed | 1 passed (4)     — identical on a 2nd run (fixture + teardown survive)
```

## MF-0007 re-freeze (user-approved, C-3)

Flipped assertion RED against the pre-MF-0025 script (`git show HEAD:scripts/sync-question-keys.mjs`):
`AssertionError: expected 7 to be +0` — SC-1 × , 6 passed. Green (7/7) with the fix.

## Per SC

| SC | Verdict | Evidence |
|---|---|---|
| SC-1 | PASS | mf-0025 acceptance `SC-1` ✓ |
| SC-2 | PASS | mf-0025 acceptance `SC-2` ✓ (P0002; earlier attempt row kept) |
| SC-3 | PASS | mf-0025 acceptance `SC-3` ✓ (other packs' rows deep-equal, `updated_at` excluded) |
| SC-4 | PASS (code read) | `scripts/sync-question-keys.mjs:178-201`: one `sql.begin(async (tx) => { … delete from private.packs …; delete from private.question_keys where not (pack_slug = any(${packs})); delete from private.items where not (pack_slug = any(${packs})); … })` |
| SC-5 | PASS | mf-0025 acceptance `SC-5` ✓ (review cascaded; re-run changes no row) |
| SC-6 (amended) | PASS | below |

## Gate run (current tree)

```
typecheck exit 0
lint exit 0        Checked 574 files in 112ms. No fixes applied.
test exit 0        Tests  580 passed (580)
test:db exit 1     Test Files  1 failed | 20 passed (21)   Tests  7 failed | 85 passed (92)
                   7  FAIL  |db| src/server/db/__tests__/mf-0013-storms.db.acceptance.test.ts
```

Baseline (change stashed with `git stash -u`): `mf-0013-storms` → `Tests  7 failed | 1 passed (8)`,
first error `22023 not a playable question for this storm`. Pre-existing → MF-0050. **No new failure.**

Fresh-context reviewer: not run (tier normal).
