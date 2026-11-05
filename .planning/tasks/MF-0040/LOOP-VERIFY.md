# MF-0040 LOOP-VERIFY

## RED at freeze (2026-11-04, `pnpm exec vitest run src/engine/content/__tests__/mf-0040-subagents.acceptance.test.ts`)

7 of 7 red, TYPECHECK clean for the file (no `mf-0040` line in `tsc --noEmit`); biome check clean before hashing.

```
× SC-1 / SC-2   Error: ENOENT: no such file or directory, open '…/packs/subagents/pack.yaml'
× SC-3/4/7      Error: ENOENT: no such file or directory, scandir '…/packs/subagents/questions'
× SC-5 / SC-6   Error: ENOENT: no such file or directory, scandir '…/packs/subagents/diagrams'
```

The red is the SC's own: the pack does not exist yet. sha256 (LF-normalised) in FROZEN.json.

## Receipt (iteration 0, 2026-11-04T15:20Z, stage: test)

Tree binding: the ticket's files are untracked, so the receipt hashes them directly:
`find packs/subagents docs/plan/subagents-validation.md src/engine/content/__tests__/mf-0040-subagents.acceptance.test.ts -type f | sort | xargs cat | shasum -a 256`
→ `86049a6b708cf8b24d770b0a57fecb34f9d5b84c7220e1ca3d4410ada67e2fde`. Frozen file hash unchanged:
`3bc1a19d…62cd1` (= FROZEN.json).

| SC | Verdict | Evidence |
|---|---|---|
| SC-1 | PASS | acceptance `✓ SC-1` |
| SC-2 | PASS | acceptance `✓ SC-2` |
| SC-3 | PASS | acceptance `✓ SC-3`: 48 questions (2 per level per skill), 8 cards, 9 diagrams |
| SC-4 | PASS | acceptance `✓ SC-4`: 12 keys per letter (LOOP-PLAN key plan) |
| SC-5 | PASS | acceptance `✓ SC-5` |
| SC-6 | PASS | acceptance `✓ SC-6`: `subagents.D1.S1.diagram-delegation-loop` |
| SC-7 | PASS | acceptance `✓ SC-7` |
| SC-8 | PASS | `course words=791 12-grams=734 files=25 shared=0` (saved course page re-extracted into its own scratch folder; see evidence for a first run that read the wrong file) |
| SC-9 | PASS | `verify/D1-D2.md` 21 OK / 12 FIX / 0 wrong keys → 12 applied, 0 rejected; `verify/D3-D4.md` 16 OK / 16 FIX / 0 wrong keys → 16 applied, 0 rejected; plus key-length edits (≤ 1 longest-key question per skill) |
| SC-10 | PASS | `subagents: 48 key(s) synced`, `65 item(s) registered`; read-back `packs|1`, `question_keys|48`, `items|65`; second run same counts |
| SC-11 | PASS | `Seeded "Demo study group · Introduction to Subagents" (subagents): 861 answers, 5 reviews.` |
| SC-12 | PARTIAL | HTTP render as `steady@mindforge-demo.test`: "Introduction to Subagents Review 62 in your queue", first item the D3.S1 nature card. Diagram drawing not seen (shared browser held; React Flow draws client-side) |
| SC-13 | PASS | `docs/plan/subagents-validation.md` |
| SC-14 | PASS | `pnpm typecheck` 0 · `pnpm lint` 0 · `pnpm test` 0 (97 files, 416 tests) · `pnpm check:packs` 0 (`7 cuckoo file(s), 0 problem(s)`) · `pnpm build` 0. No failure, so nothing to attribute |

Verdict: DONE for the hash above, SC-12 partial (drawing unverified, listed in evidence).

## Re-receipt 2026-11-05 (post hand-off fix)

- Change: `packs/subagents/pack.yaml` D2.S1 `description` still said "with the /agents command", contradicting C-1 (docs win). Now: "by asking Claude or writing the file (today /agents only points there)". No item, key or blueprint field changed.
- Acceptance test: 7/7 pass · `pnpm check:packs`: 0 problems · `pnpm db:sync-keys`: subagents 65 items registered.
- Tree hash (sorted per-file sha256 over pack, guide, test): `e8403a6460a6fdacc901190363ba1133ddf39de576089aba2f298b3acd03ccd7`. Supersedes the receipt above for this file set.
