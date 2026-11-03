# MF-0006 — LOOP-VERIFY

Bindings: no `ticket:freeze` / `ticket:verify` / `ticket:eval` scripts exist in `package.json`
(only `scripts/lib/ticket-*.mjs` libraries), so the skill defaults apply: FREEZE = run each file,
confirm red twice, record sha256 + first failure in `FROZEN.json`; VERIFY = typecheck, lint, unit
+ ui tests, build, with `git diff HEAD | sha256` as the tree binding.

## RED at freeze (2026-11-03T14:11:59Z)

`pnpm exec vitest run --project unit src/engine/content`, run twice, identical:

```
❯ |unit| src/engine/content/__tests__/mf-0006-content.acceptance.test.ts (8 tests | 8 failed)
× SC-1: nature card schema; missing or empty whereItBreaks and non-https sources name their path
× SC-2: diagram schema; a mermaid that is not an allowed diagram type names its path
× SC-3: questions carry origin + author; a file still using status fails with a clear message
× SC-3: all 53 CCDV-F questions migrate: 3 official without author, 50 ai by Sorin
× SC-4: duplicate id across types, unknown skill, card → missing diagram each name their path
× SC-5: contentHash is stable across key order and changes when any field changes
× SC-6: CCDV-F ships the Temperature card → its D5.S1 diagram, and the D1.S3 bee loop; the sample pack still loads
× SC-8: review seam — isPlayable never serves flagged/rejected; an empty context serves all 53
❯ |unit| src/engine/content/__tests__/mf-0006-mermaid.acceptance.test.ts (2 tests | 2 failed)
× SC-2: a valid diagram passes; a broken one fails naming the item id
× SC-2: every diagram in every pack parses
```

Failure reasons, grouped:

```
8 Error: not implemented
1 AssertionError: expected [Function] to throw error matching /…/S1\.yaml: cards\.0\.id: .*tiny\.S1\.q1 but got 'n…   ← the thrown error is "not implemented"
1 AssertionError: promise rejected "Error: not implemented" instead of resolving
```

Every red is the stub, not a typo or fixture: `pnpm typecheck` passes with the stubs in place.

## Baseline (before any change, HEAD 2129f2b)

- typecheck: pass · test: 66 pass, 10 fail (only the 10 frozen MF-0006 tests)
- lint (`pnpm lint`, whole repo): **fail, pre-existing** — ~20 untouched files fail `format` on
  CRLF line endings (Windows checkout, git `core.autocrlf`); git stores them as LF.

## Receipt — 2026-11-03, tree sha256 `c9f72edd1ea69a381330961ed5b690a7556c53d498328f0a71a462d2170210bc`

Bound to `git diff HEAD` (HEAD `185663c`) + the content of every untracked file, LF-normalised.
Logs in `.planning/tasks/MF-0006/logs/`.

| Check | Result | Literal |
|---|---|---|
| typecheck | PASS | `✓ Types generated successfully` then `tsc --noEmit` exit 0 |
| lint, every changed/new file (24) | PASS | `Checked 24 files in 33ms. No fixes applied.` |
| lint, whole repo | preexisting FAIL | CRLF `format` on untouched files (see baseline) |
| test (`unit` + `ui`) | PASS | `Test Files  23 passed (23)` · `Tests  76 passed (76)` |
| build | PASS | route table printed, `/play/[packSlug]/duel` ◐ |
| test:db | **INFRA — not run** | `spawnSync …\node_modules\.bin\supabase ENOENT` in `src/test/local-stack.ts:28` (Windows can't exec the shell shim; pre-existing, same bug fixed for scripts in 185663c) |
| frozen hashes | PASS | all 7 files of MF-0001/0003/0006 match `FROZEN.json` (LF) |

**Verdict: DONE for SC-1…SC-6, SC-8; SC-7 DONE with one infra gap (test:db not runnable here).**

## Per SC

| SC | Verdict | Evidence |
|---|---|---|
| SC-1 | PASS | frozen `mf-0006-content` "SC-1: nature card schema…" ✓ |
| SC-2 | PASS | frozen "SC-2: diagram schema…" ✓; `mf-0006-mermaid` "a broken one fails naming the item id" ✓, "every diagram in every pack parses" ✓ (2 diagrams checked) |
| SC-3 | PASS | frozen SC-3 ×2 ✓ (53 = 3 official/no author + 50 ai by vlad.parvana@ddroidd.com after the author change); re-frozen MF-0003 questions file ✓ |
| SC-4 | PASS | frozen "SC-4: duplicate id across types…" ✓ |
| SC-5 | PASS | frozen "SC-5: contentHash…" ✓ |
| SC-6 | PASS | frozen "SC-6: CCDV-F ships the Temperature card → its D5.S1 diagram…" ✓; sample pack loads empty |
| SC-7 | PASS (gap) | typecheck, scoped lint, 76/76 tests, build; MF-0001/0003 frozen suites green. test:db not run (infra, above) |
| SC-8 | PASS | frozen "SC-8: review seam…" ✓ (empty context serves 53); duel page + action call `getReviewContext` (typecheck + build) |

## Receipt 2 — 2026-11-03, after the retro actions, tree sha256 `a89080e18f05566a32b84f857d7bfad947f08257e8dc9149fd4af4db5bd6cfaf`

Adds `.gitattributes` (`* text=auto eol=lf`, working copy converted to LF, no content change) and
`src/test/local-stack.ts` now resolves the CLI through `scripts/lib/supabase-bin.mjs`.

| Check | Result | Literal |
|---|---|---|
| lint, whole repo | **PASS** (was preexisting FAIL) | `Checked 197 files in 149ms. No fixes applied.` |
| typecheck | PASS | `✓ Types generated successfully`, `tsc --noEmit` exit 0 |
| test:db (local stack) | **PASS** (was INFRA) | `Test Files  4 passed (4)` · `Tests  12 passed (12)` |
| browser, local stack | PASS | `/play/ccdv-f/duel`: "Question 1 of 5 · Software Engineering Foundations · **Unreviewed**"; answering → "Correct! Recalled and recorded." |

**Verdict: DONE — SC-1…SC-8, no gaps.**

Not frozen (proof is a gate / receipt): SC-7. MF-0003's `mf-0003-questions.acceptance.test.ts`
gets the user-approved rename-only re-freeze (C-2) in BUILD, together with the `Question` type
change, so typecheck never goes red.
