# LOOP-VERIFY — MF-0030 (iteration 0)

## Baseline (before any change, 2026-11-05)

typecheck ✓ · lint ✓ · test 134 files / 617 tests ✓ · gate:planning ✓ (50 folders). No pre-existing red.

## RED at freeze

`src/content-pipeline/__tests__/mf-0030-content-all.acceptance.test.ts`: 22 failing, all `Error: not implemented`
(runtime; typecheck green) from the `content-all.ts` / `dev-setup-corpus.mjs` stubs, e.g.

```
× SC-1: corpus → diagrams → cards → questions once per domain, each with --pack
× SC-3: one batch at 50.01 refuses the whole run after the corpus and names it
× SC-5: an unknown flag is refused   (expected /--with-corpse/ but got 'not implemented')
Tests  22 failed | 1 passed (23)
```

SC-7 was green at freeze by design (a regression lock: setup and CI must never call `content:all`).

## Receipt (current tree)

- Code diff hash (`git diff HEAD -- . ':!.planning' | shasum -a 256`, new files intent-added):
  `2275a000b17cc410b8fb669dace422ef8bda7b14f929067e01029ac84c6ae32d`
- Frozen file hash unchanged: `2bacad85af2c85c4af796fc04b8da7a3ceea8c3a893ef337bfbd9a3914ab6bf9` = FROZEN.json
- `pnpm typecheck` exit 0 · `pnpm gate:planning` exit 0 (`50 ticket folders checked, ok`) · `pnpm lint` exit 0
  (`Checked 587 files … No fixes applied.`) · `pnpm test` exit 0 (`Test Files 136 passed (136)`,
  `Tests 645 passed (645)`, i.e. 617 + 23 acceptance + 5 unit). Logs: `logs/`.
- `pnpm build` / `pnpm test:db` not run: no UI, `src/server/**` or `supabase/**` change.

**Verdict: DONE for this tree.**

## Per SC

| SC | Verdict | Evidence |
|---|---|---|
| SC-1 | PASS | acceptance SC-1 ×5; real: `pnpm content:all` → `--pack is required; usage: …` exit 1; `--pack nope` → `no pack "nope" (packs/nope/pack.yaml not found)` exit 1 |
| SC-2 | PASS | acceptance SC-2 ×4; real (`env -u ANTHROPIC_API_KEY pnpm content:all --pack ccdv-f`, `content-all-dry.log`): exit 0, corpus step `fetched=0 unchanged=34`, rows diagrams $5.75 · cards $6.00 · questions D1..D8 (sum $70.68 = the whole-pack estimate) · `total $82.43 (verifier batches not counted; …)` |
| SC-3 | PASS | acceptance SC-3 ×2 (50.00 runs all 5 steps none dry; 50.01 refused, only corpus ran, names `questions D2`) |
| SC-4 | PASS | acceptance SC-4 ×6; real: `--run` alone → `--run requires --max-total-usd <usd>` exit 1; `--no-corpus --run --max-total-usd 50` → `refused: total estimate $82.43 exceeds --max-total-usd $50.00` exit 1, `git status packs` clean, no `.cache/runs` (`content-all-refused.log`) |
| SC-5 | PASS | acceptance SC-5 ×3; real: `dev:setup --with-corpus` exit 0, 8 packs fetched after `.env.local` (`dev-setup-with-corpus.log`); `dev:setup` exit 0, 0 lines mention corpus (`dev-setup-default.log`); `--with-corpse` → `✗ unknown argument(s) "--with-corpse"` exit 1 before Docker |
| SC-6 | PASS | acceptance SC-6 ×2 (corpus failure: no estimates, names `--no-corpus`; diagrams failure: cards/questions never start) |
| SC-7 | PASS | acceptance SC-7 (dev-setup.mjs + `.github/workflows/ci.yml`) |
| SC-8 | PASS | README "Generating content" + `--with-corpus` sentence; gates above |

## Not verified

- A real network outage: the corpus-failure message of `content:all` is proved with the fake runner only, and
  `dev:setup`'s fetch-failure message by reading the code.
- A real `--run` (paid; MF-0022 / MF-0047).
