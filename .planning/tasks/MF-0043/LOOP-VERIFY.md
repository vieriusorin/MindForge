# MF-0043 — LOOP-VERIFY (iteration 0)

## RED at freeze (Stage 2b)

Frozen 2026-11-06, `src/test/__tests__/mf-0043-frozen-collisions.acceptance.test.ts`, sha256 `aa9baa06…51a4`.
`pnpm test`: 6 failed | 786 passed; the only red file was the frozen one.

- SC-1: `AssertionError: expected false to be true` — no `mf-0008…:10` line on stdout (CLI stub throws).
- SC-2: `expected 1 to be +0`.
- SC-3 … SC-6: `Error: not implemented` (`checkCollisions` stub).

Proof-case replay before freeze (GOAL Iteration Log): the drafted grep over `862f462~1` hits mf-0008 :10 and :70.

## Per SC

| SC | Verdict | Evidence |
|----|---------|----------|
| SC-1 | PASS | frozen test green; real-repo probe: MF-0032 plan minus its mf-0008 row → code 1, hits `mf-0008-schema.acceptance.test.ts:10`, `:70` |
| SC-2 | PASS | frozen test green; real-repo probe: MF-0032 plan as shipped → `no unlisted collisions (76 frozen files scanned)` |
| SC-3 | PASS | frozen test green |
| SC-4 | PASS | frozen test green |
| SC-5 | PASS | frozen test green; `node scripts/frozen-collisions.mjs MF-0032` → ``MF-0032: no `## Symbols changed` section in GOAL.md or LOOP-PLAN.md``, exit 2 |
| SC-6 | PASS | frozen test green |
| SC-7 | PASS | `package.json:31`, `SKILL.md:252` (Stage 2 item 6), `SKILL.md:343` (Stage 3a), `templates.md:100` |

## Gates and suite

- `pnpm typecheck`: exit 0
- `pnpm lint`: Checked 640 files, no fixes
- `pnpm test`: Test Files 156 passed (156), Tests 792 passed (792)
- `pnpm gate:planning`: 56 ticket folders checked, ok
- `node scripts/check-hooks.mjs`: PASS
- frozen hash: match
- `pnpm ticket:collisions MF-0043`: `no symbols changed`, exit 0

## Receipt (when VERIFY has no script)

`git diff HEAD -- . ':!.planning'` (new files intent-added) | shasum -a 256 →
`d4eb6fdc181b4bd6a5bf33d39d88b69c94f55b0c7b67abfac08b3de3757e66f8`

## Not verified

- `pnpm build`, `pnpm test:db`: not run. No UI, DB or server code changed.
- No fresh-context diff review (normal tier).
- Aliased-import call sites (C-3, accepted residual).

## Verdict: PASS
