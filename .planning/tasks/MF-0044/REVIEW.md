---
verdict: approve
reviewed_hash: 92bd7cfb01d63d33db8782ac1afe4ed9c7d04254287bb86a73da8de8837b1e45
reviewed_at: 2026-11-06T09:48:36Z
---
<!-- reviewed_hash = sha256( `git diff HEAD` + for each untracked file (git ls-files --others --exclude-standard,
     sorted, excluding this REVIEW.md) a line "<path> <sha256>" ). No receipt existed yet (`pnpm ticket:verify` is
     not a script in this repo), so the hash is bound to the working tree as described.
     Round 2: this hash covers the minor 1-4 fixes in scripts/lib/key-length.mjs and key-length.test.ts. The round-1
     hash (e538fe3b…4288) is void. -->

## Scope reviewed

Round 1: `scripts/check-pack-grounding.mjs` (diff), new `scripts/lib/key-length.mjs`,
`src/test/__tests__/key-length.test.ts`, frozen `src/test/__tests__/mf-0044-key-length.acceptance.test.ts`, reserved
`.planning/tasks/MF-0059/GOAL.md`.
Round 2 (the delta only): `scripts/lib/key-length.mjs`, `src/test/__tests__/key-length.test.ts`.

## Checks run

- Round 2: `pnpm vitest run` key-length.test.ts + mf-0044 + mf-0041 acceptance: 3 files, 36 passed. Frozen file
  sha256 (LF-normalised) is still `a80b26e5…91bb` = FROZEN.json. `pnpm check:packs` exits 0 with
  `216 checked, 0 problem(s), 156 skipped (grandfathered), 5 multi-select not checked`. The 156 grandfathered
  questions are now structure-checked too, and none of them is malformed. Biome is clean on both files.
- Round 2 false-clean probe, the same malformed question in a grandfathered pack (`ccdv-f`) and in a plain pack:
  options missing, two keys, no distractor, empty distractor, non-string text, non-boolean correct. Each one is a
  problem in **both** packs. In `key-length.mjs` the only `return null` for `compareLengths: false` comes after
  every structure check (options list → option fields → exactly one key → ≥1 distractor → non-empty longest
  distractor). A 300× key is a problem only outside the grandfather set.
- Counters: a grandfathered question increments `grandfathered`, never `checked`. Frozen SC-3 (`0 checked,
  0 problem(s), 1 skipped (grandfathered)`) still passes, since its fixture question is well formed.
- Round 1 (still valid; `check-pack-grounding.mjs` is unchanged): SC-5 runs on a corpus-free scratch copy of
  `scripts/` (real packs → exit 0 with the summary; a 1.20× fixture → exit 1). Call order: the rule runs before the
  `existsSync(CORPUS)` exit. YAML edge cases (multi-doc, duplicate keys, `questions` as a map, `<<` merge, a
  mistyped `select`) are all reported as problems. `.yml` files and nested dirs are ignored, as in the app loaders
  (`load-content.ts:162`, `load-questions.ts:84`).

## Findings

Round 1 minors 1–4 are resolved:
- 1 (grandfather skipped the structure checks): fixed. The structure is checked in every pack, and only the length
  comparison is skipped. Covered by "still reports a malformed question in a grandfathered pack".
- 2 (Infinity message): fixed. The message is now `<id>: every distractor is empty`, and whitespace-only distractors
  also land here after `trimEnd`.
- 3 (UTF-16 / block-scalar count): fixed. `charCount` counts the code points of `text.trimEnd()`, and both cases are
  tested.
- 4 (`?? 0`): fixed. The key is destructured as `[key, ...extraKeys]`, and the count in the message is still correct
  for 0 and for 2+ keys.

Remaining:
- [note] The `skipped (grandfathered)` summary label is slightly understated now, because those questions are
  structure-checked and only exempt from the length comparison. The wording is pinned by frozen SC-3, so leave it.
- [note] A key with empty or whitespace-only text has ratio 0 and passes this rule. The zod `QuestionSchema`
  (`text` min 1) rejects empty text in `pnpm test`. A whitespace-only key is outside this rule's scope.
- [note] The CI workflow has no `check:packs` step. CI enforces the rule through the frozen SC-6 case in
  `pnpm test`, which runs the script over the real `packs/` with no corpus. Same as MF-0041.
- [note] Windows backslash paths in messages, as in the MF-0041 precedent. The frozen regexes don't depend on the
  separator.
- [note] `select: 2+` questions are counted and never checked. That is out of scope by the GOAL decision, and the
  schema covers their structure.

No blocking findings.
