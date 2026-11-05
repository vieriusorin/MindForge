# LOOP-VERIFY — MF-0036

## RED at freeze (2026-11-04)
`pnpm exec vitest run --project unit src/test/__tests__/mf-0036-cuckoo-grounding.acceptance.test.ts`
```
  20 Error: not implemented
      Tests  20 failed (20)
```
Typecheck green at freeze (`tc=0`), lint clean. The red is the stub's, i.e. the SC's.

## Baseline (before BUILD)
`pnpm test`: `Tests  20 failed | 338 passed (358)`. All 20 failures are other sessions' frozen RED
acceptance files (`mf-0032-*` ×14, `mf-0037-ai-capabilities` ×6). Pre-existing, not this ticket's.

## Receipt — iteration 0, 2026-11-04 — DONE
Tree: `02d8f4e3854a` = sha256 of `git diff HEAD` over this ticket's files plus its new files' contents
(the shared worktree carries uncommitted MF-0032/0034/0037/0038 work, so a whole-tree hash would bind
other sessions' diffs). `ticket:verify` is not in `package.json`; the default was run by hand.
- `pnpm typecheck` → exit 0. `pnpm lint` → `Checked 453 files … No fixes applied.`
- `pnpm test` → `Tests  23 failed | 362 passed (385)`. All 23 failures are in other sessions' frozen RED
  files: `mf-0032-*` (14), `mf-0037-ai-capabilities` (2), `mf-0038-platform-foundations` (7). None new from
  this ticket (baseline had MF-0032 + MF-0037; MF-0038 was frozen by another session during this run).
- Related set: `Tests  44 passed (44)` (MF-0036 acceptance 20, flaw-keys 1, MF-0016 cuckoo acceptance 23).
- Frozen hash: `frozen hash OK src/test/__tests__/mf-0036-cuckoo-grounding.acceptance.test.ts`.
- `pnpm check:packs` → `check:packs: 7 cuckoo file(s), 0 problem(s)`, exit 0.

| SC | Verdict | Evidence |
|---|---|---|
| SC-1 | PASS | acceptance `SC-1` green; scratch copy with pre-fix line → `ccdv-f.D7.S2.cuckoo-allow-beats-deny line 3: "never" in a line that must be true`, exit 1 |
| SC-2 | PASS | acceptance `SC-2` ×2 green |
| SC-3 | PASS | acceptance `SC-3` ×7 green |
| SC-4 | PASS | acceptance `SC-4` ×3 green |
| SC-5 | PASS | acceptance `SC-5` ×4 green; scratch root without `.cache/corpus` → `check:packs: .cache/corpus missing, skipped (run pnpm generate:corpus)`, exit=0 |
| SC-6 | PASS | real packs exit 0 (above); scratch pre-fix copy `2 problem(s)`, exit=1 |
| SC-7 | PASS | `diff hashes-before hashes-after` → `14 hashes identical` (contentHash per cuckoo, scripts/lib/content-hash.mjs) |
| SC-8 | PASS | `.claude/rules/testing.md:53` … `pnpm check:packs` when touching `packs/**` |
