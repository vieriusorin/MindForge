---
verdict: approve
reviewed_hash: 4ac92f74dd98a5b53df236dacfa65034d4985fa4c336d25515871a09b76b83ba
reviewed_at: 2026-11-04T17:05:00Z
---
## Scope

The 34 MF-0032 paths only. I recomputed the hash with the same method (`== <path>`, then `git diff HEAD`
for tracked files or `cat` for untracked ones, sha256 over the stream) and it matches. This is a delta
re-review against the first review (hash `b350c8d0…20cb97`). The stream diff between the two hashes
touches only the SC-2 case of `src/server/db/__tests__/mf-0032-attempt-hash.db.acceptance.test.ts`. That
file's LF-normalised sha256 `5f792509…eedc75` matches `FROZEN.json`. Its history entry records the
user-approved re-freeze and the previous hash `1f053913…a0cbf3`.

## Findings

- [resolved, was blocking] src/server/db/__tests__/mf-0032-attempt-hash.db.acceptance.test.ts:953-996
  — Previously, the SC-2 RPC ran only after COMMIT, because `PostgrestBuilder` is lazy.
  - The RPC is now awaited through `.then` inside `db.begin`.
  - It records `isCommittedAtResponse` and asserts `[{ data: false, error: null, isCommittedAtResponse: false }]`.
  - The case now proves the request was answered while the sync transaction was still open, and that it
    was graded on the committed key.
  - The new name and comment state exactly that. They defer the single-snapshot property to diff review.
  - That diff review is done. The migration (`20261104150000_mf0032_attempt_content_hash.sql:50-54`) reads
    the key and the hash in one statement. The sync (`scripts/sync-question-keys.mjs:173-208`) does one
    `sql.begin` per pack.
  - The post-commit assertions (old hash → 55000, new hash → true) are unchanged.

- [resolved, was note] LOOP-PLAN.md T4 `owns` now lists `src/engine/content/index.ts`,
  `src/engine/questions/index.ts` and `src/engine/questions/__tests__/playable.test.ts`.

- [note, accepted as deferred] supabase/migrations/20261104150000_mf0032_attempt_content_hash.sql:53
  — The join has no `pack_slug` predicate. It is deferred to MF-0024, which owns cross-pack ids. This is
  acceptable: `question_keys.question_id` and `items.item_id` are both global PKs today, so the predicate
  is defence-in-depth, not a live hole.

- [note, accepted] src/app/(app)/play/[packSlug]/walk/page.tsx:65-76 — The inline drop-if-no-hash rule
  stays as it is. The coordinator's reason holds: the steps carry `reason`, which `toPlayableQuestions`
  doesn't model. The rule is a three-line guard that cannot fire for a parsed file.

- [note] src/server/attempts/grade-answer.ts:52 — The `!question` return after `checkQuestionAnswer` only
  narrows the type and is unreachable at runtime. It mirrors `grade-cuckoo.ts`.

## Checked, no finding (unchanged from the first review)

- **Stored hash:** `attempts.content_hash` comes from the registry row (migration:74), never from the
  client. Reads are owner-scoped. `fetch-attempts.ts:22` selects explicit columns.
- **Grants:** both `(text, text[])` signatures are dropped. The 3-arg definer and invoker shim get EXECUTE
  for `authenticated` only (migration:88-91), and SC-7 asserts this from `pg_proc`.
- **Sync:** the failure order is unchanged (`validatePacks` runs before connecting), and so is what it
  deletes. A per-pack read error now leaves that pack untouched.
- **Bypass:**
  - The action path always sends a hash (strict `AnswerInput`).
  - A stale page or a direct action call → `changed` before the RPC.
  - A registry ahead of the deploy → 55000 → `changed` (both grade paths).
  - A NULL hash on a direct RPC call is the decided behaviour (GOAL).
- **DTO:** only `contentHash` is added. It is a sha256 over the whole item, rationales included, so it is
  not a key oracle.
