# MF-0037 LOOP-VERIFY

## RED at freeze (2026-11-04)

`pnpm exec vitest run --project unit src/engine/content/__tests__/mf-0037-ai-capabilities.acceptance.test.ts`
(typecheck 0 at the same time: the red is a runtime failure)

```
× SC-1: pack.yaml follows the blueprint          Error: ENOENT … packs/ai-capabilities/pack.yaml
× SC-2: content loads and every citation …       Error: ENOENT … packs/ai-capabilities/pack.yaml
× SC-3: per skill ≥ 6 questions …                Error: ENOENT … packs/ai-capabilities/questions
× SC-4: ≥ 48 questions, options A–D …            Error: ENOENT … packs/ai-capabilities/questions
× SC-5: every diagram has ≥ 4 nodes …            Error: ENOENT … packs/ai-capabilities/diagrams
× SC-6: a D3.S1 capstone diagram …               Error: ENOENT … packs/ai-capabilities/diagrams
Tests  6 failed (6)
```

Each red is the SC's own: the pack does not exist yet. No fixture or typo red.

## Baseline (before any change)

`pnpm typecheck` 0 · `pnpm lint` 0 (442 files) · `pnpm test` 0 (83 files, 337 tests).

## Receipt — iteration 0 (2026-11-04)

Tree hash (MF-0037 files, `find … -type f | sort | xargs cat | shasum -a 256`; all files are untracked, so
`git diff HEAD` is empty for them): `59fd48fc99892e32de9fba0a7c64926cd3007896042d64901ad33cd5ea1c29d8`.
Frozen file hash unchanged: `1b6043af…2b69` = FROZEN.json.

| Check | Result |
|---|---|
| `pnpm typecheck` | 0 |
| `pnpm lint` | 0 (461 files) |
| `pnpm test` | 1: 3 files / 16 tests red, all in other sessions' in-progress pack tickets (`mf-0038-platform-foundations` 4, `mf-0040-subagents` 6, `mf-0042-claude-code-in-action` 6). Not in baseline because those tickets did not exist yet; none touches MF-0037 files. 94 files / 400 tests pass, including `mf-0037-…acceptance` 6/6. |
| `pnpm build` | 0 |
| mf-0037 + mf-0031 acceptance alone | 12 passed (12) |

**Verdict: DONE for MF-0037 scope.** The full suite's reds are attributed to MF-0038/0040/0042 (parallel sessions).

## Per SC

| SC | Verdict | Evidence |
|---|---|---|
| SC-1 | PASS | acceptance SC-1 ✓ |
| SC-2 | PASS | acceptance SC-2 ✓ (loads; every citation is a skill source) |
| SC-3 | PASS | acceptance SC-3 ✓ (8 skills × 6 q, 2/level, 1 card, 1 diagram) |
| SC-4 | PASS | acceptance SC-4 ✓ (48 questions; keys 12 per letter by plan) |
| SC-5 | PASS | acceptance SC-5 ✓ |
| SC-6 | PASS | acceptance SC-6 ✓ (capstone `ai-capabilities.D3.S1.diagram-property-collisions`) |
| SC-7 | PASS | `ngram-check.py`: `course words=840 grams=783 files=25 hits=0` (re-run after all fixes) |
| SC-8 | PASS | verify/D1.md 7 FIX, D2.md 11 FIX, D3.md 4 FIX: every FIX resolved (Resolution sections); 0 wrong keys |
| SC-9 | PASS | sync ×2: `ai-capabilities: 48 key(s) synced / 64 item(s) registered`; read-back both runs `64 c972f2c6…3e10` items, `48 018402ca…a6a1` keys (identical) |
| SC-10 | PASS | `Seeded "Demo study group · AI Capabilities and Limitations" (ai-capabilities): 861 answers, 5 reviews.`; read-back group 6 members; attempts 861 from 6 users over 48 questions |
| SC-11 | PARTIAL | browser held by another session ("The browser is already running…"); HTTP render as a fresh learner in the group: `status 200`, "62 in your queue", pack name, first item `ai-capabilities.D2.S1.card-next-token` with concept "Next token prediction". Diagram drawing not seen. |
| SC-12 | PASS | `docs/plan/ai-capabilities-validation.md` |
| SC-13 | PASS (scoped) | receipt above |
