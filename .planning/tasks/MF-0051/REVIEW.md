---
verdict: approve
reviewed_hash: 451da4b7bde6b55a615ff50a93ae11eb797d66b342934c7b5e72e04f933f26ea
reviewed_at: 2026-11-09T09:10:00Z
---
<!-- reviewed_hash = `git diff HEAD | sha256sum`. Untracked files reviewed at:
scripts/lib/pnpm-refs.mjs c911e619d3b076e5bdecd6918f6b34981cb133276ef6e20fefa94672c844aac5
src/test/__tests__/pnpm-refs.test.ts d2b57cd16563b2482d2d890d6824e8850d1d506569253120e9ea1e91d77c076c
src/test/__tests__/mf-0051-pnpm-refs.acceptance.test.ts 459864b1a2c9a829e3a61feda98a00aa311ca5367b4fb5ebbf267e4291d05183
  (LF content matches FROZEN.json; history entry 651738c9… → 459864b1…, approved by the user)
src/test/__tests__/check-hooks-walk.test.ts a80a5c75239af9ed11ae1fe8ef7d2628a1d0e6fbe46c77ab2bf30bb32d052c2c
Supersedes the review of 37f24769… (changes-requested, B-1). -->

## Findings

Delta review of 37f24769… → 451da4b7…. No blocking findings.

- [note] B-1 is closed. `scripts/check-hooks.mjs:111-118` uses `lstatSync` and skips links. The re-frozen SC-3 walk
  (`mf-0051-pnpm-refs.acceptance.test.ts:121-127`) does the same and imports `lstatSync`. On Linux, `lstat` of a
  dangling link succeeds and reports `isSymbolicLink()`, so the tracked `.claude/skills/brag-slim` link is skipped
  in both places and nothing throws. `check-hooks-walk.test.ts` is green here. On Linux, `symlinkSync` ignores
  the `"junction"` type and creates a real dangling symlink, so the test proves the same thing on CI.
  `node scripts/check-hooks.mjs` exits 0 (196 files), and the 3 MF-0051 test files pass 28/28.
- [note] scripts/check-hooks.mjs:115: skipping links means that a skill installed as a symlink into
  `.claude/skills/` is never scanned, even when its target exists. Today the repo has only one link, and it
  dangles. Accepted trade-off; mention it in MF-0080 if skills start to be linked in.
- [note] scripts/lib/pnpm-refs.mjs:73: `FENCE` now accepts any indent. CommonMark treats a line indented 4+
  spaces outside a list as an indented code block, not a fence. So a "```" line inside an indented code block
  (Markdown that documents Markdown) now flips the fence state, and the rest of the file is read the wrong way
  round. No file in scope does this today, since check-hooks passes. Fences inside blockquotes (`> ```…`) are
  still not recognised; that was already true before this delta.
- [note] Probes of the delta, all as intended: "`pnpm` `foo`" → `[]`; "` pnpm` x `pnpm baz`" → `baz` only; a
  4-space list fence is read; `pnpm gate:*` / `pnpm test:*` are known; `pnpm nope:*` / `pnpm te:*` are reported;
  `pnpm g*` is reported. The one odd case: `pnpm gate:*foo` is read as `gate:*` and passes. Harmless.
- [note] N-6 is resolved by withdrawing SC-4. `scripts/lib/goal-proofs.mjs` is byte-identical to HEAD, and the
  `PNPM_BUILTINS` doc comment (`pnpm-refs.mjs:6-9`) now says the two sets are different facts. N-1, N-2 and
  multi-line spans are recorded as accepted limits in GOAL Concerns (:113), with MF-0080 as the follow-up.
- [note] The agent text is now accurate against what exists.
  - `verifier.md`: step 2 includes untracked files; the CLI's `infra` status is gone; STOP RULE drops `budget`
    and defines `stuck` from the previous receipt. The gsd-goal-loop skill defines neither term, so the
    verifier's own definition stands. PREEXISTING is read from the baseline in LOOP-VERIFY.
  - `diff-reviewer.md`: the description, base, hash binding (untracked files included) and EVAL wording are
    updated.
  - `retro.md`: steps 1 and 3 no longer mention signals.
  - `ticket-planner.md:51`: names `validatePlan`.
  - No `pnpm ticket:*` remains in scope.
