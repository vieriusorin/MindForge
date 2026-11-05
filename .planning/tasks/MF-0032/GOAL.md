---
ticket_id: MF-0032
tier: high-risk                   # changes the security-definer grading function + the attempts table
stage: handoff
branch: feat/MF-0016              # shared worktree; this loop never creates a branch
builds_on: [MF-0003, MF-0007, MF-0009, MF-0016]
last_iteration: 0
goal_status: complete-pending-manual-commit          # was `reserved` (created by MF-0016 K-4, user-approved 2026-11-04)
---

## Objective

**Today.** `record_attempt(p_question_id, p_chosen)` grades against `private.question_keys`, which carries
no version. Two gaps follow:

1. **Sync ahead of deploy.** Run `pnpm db:sync-keys` before the deploy, and a learner on the old page is
   graded against the NEW key, which they never read. MF-0016 C-4 closed only the opposite direction for
   cuckoos: the action compares the sent hash with the deployed file's hash. Questions (Duel, Walk, Seed
   Planting) send no hash at all (`src/lib/answer-input.ts`), so both directions are open for them.
2. **Torn sync.** The sync writes `question_keys` and `items` in two transactions per pack
   (`scripts/sync-question-keys.mjs`), and `record_attempt` reads the key in its own statement. A check
   against `items.content_hash` alone could pass on the old hash and then grade against the new key.

**End state.** Every graded answer (question or cuckoo) names the content hash the learner's page was
rendered from. The app refuses it when that hash differs from the deployed file's hash. The database refuses
it (`55000`) when it differs from `private.items.content_hash`, reading the key and the hash in one snapshot.
The attempt row stores the hash it was graded against.

## Affected

- **Roles:** learners in every graded mode (Duel, Walk, Seed Planting checks, Spot the Cuckoo). An answer to
  an item that changed since the page loaded is refused with "changed since you opened it" and leaves no
  attempt. Nothing changes for reviewers or maintainers.
- **Surfaces:** new migration (`private/public.record_attempt`, `public.attempts.content_hash`);
  `scripts/sync-question-keys.mjs` (one transaction for keys + items per pack); `src/engine/questions`
  (`PlayableQuestion.contentHash`, `toPlayableQuestion(question, hash)`, a pure answer check);
  `src/lib/answer-input.ts`; `src/server/attempts/grade-answer.ts`, `grade-cuckoo.ts`; the duel, walk and
  plant pages (`getItemHashes`); the duel, walk and seed-planting actions (a `changed` message); the duel,
  walk and seed-checks hooks (send the hash); `database.types.ts`.

## Constraints

- A judgement on versioned content names the version its actor read and is refused when it differs from the
  stored version (gsd-goal-loop DESIGN rule; MF-0007 retro) → `p_content_hash` checked against
  `private.items.content_hash`, the same shape and errcode (`55000`) as `review_item`.
- The DB decides correctness; nothing a client sends grows a tree (MF-0003) → pack, skill and hash in the
  attempt row come from the key and registry rows, never from the client. The client hash only gates.
- Migrations: RLS on, revoke all before grants, `SECURITY DEFINER` only in `private` (CLAUDE.md) → the new
  signature keeps the MF-0003 grant shape. Old signature dropped, so no overload is left callable.
- The client DTO carries only pre-answer fields (MF-0003 SC on `toPlayableQuestion`, MF-0016 C-2) → the
  hash is added on purpose, as `toPlayableCuckoo` does. No key field crosses.
- The sync is re-runnable and deletes rows (gsd-goal-loop plan rule (a)–(c)) → merging two transactions
  into one changes no ownership. Validation still runs for all packs before the first write (MF-0012).
- Grants allow-list (MF-0005) unchanged: a new column on `attempts` is covered by the existing
  `select` grant + "read own" policy.

## Decided without a question

- **Optional `p_content_hash text default null`**, not required. Source: the `review_item` precedent
  (MF-0007 migration header). The frozen MF-0003 / MF-0016 / MF-0029 DB acceptance tests call the 2-arg
  form, and the dev seed calls it too. A learner calling the RPC directly with NULL gains nothing they can't
  already do: they can send any answer. The app always sends the hash (SC-4, SC-5).
- **One snapshot**: `record_attempt` reads key + registry hash in one statement (join), not two
  `select … into`. plpgsql under READ COMMITTED takes a fresh snapshot per statement (torn read, gap 2).
- **Sync writes keys + items in one transaction per pack** (gap 2). Follows from SC-2.
- **Hash given but no registry row** → refused `P0002` ("unknown item"): fail closed. NULL hash + no
  registry row keeps today's behaviour (MF-0003 tests seed keys without registry rows).
- **App layer keeps its own check** (sent ≠ deployed file hash → `changed`, no RPC). It covers deploy-ahead
  and keeps the revealed key and rationales (read from the files) on the version the learner read. The
  MF-0016 cuckoo check (`checkCuckooAnswer`) already does this. Questions get the same pure check.
- **DB `55000` maps to `changed`**, not `not-gradable`, in both grade paths. The learner sees the same
  message for either direction.
- **A question with no deployed hash is not served** (mirrors the cuckoo page filter). It can't happen for
  a parsed file. It is guarded rather than sent with an empty hash.
- MF-0016 Out of Scope called this "MF-0024 territory". MF-0024 is the composite-key ticket, so this ticket
  is the one that owns question hashes (reserve note: "for every item type that is graded").
- No `pnpm db:reset` / `supabase stop|start` needed: the migration goes on with `supabase migration up`
  on the local stack; DB tests seed their own rows. Preflight 2026-11-04: typecheck, lint and test are
  green (83 files / 337 tests). `test:db` has 2 pre-existing reds in
  `src/dev-seed/__tests__/mf-0034-regressions.db.test.ts` (MF-0034, another session), so SC-8 counts NEW
  failures only.

## Edge inputs (SC-1, SC-3, SC-4)

| Input | Result | Decided by |
|---|---|---|
| `p_content_hash` NULL | graded as today; `attempts.content_hash` = registry hash if a row exists, else NULL | precedent (review_item) |
| hash = registry hash | graded; row stores that hash | SC-1 |
| hash ≠ registry hash | `55000` "item changed since it was read"; no row | SC-1 |
| hash given, no registry row | `P0002`; no row | fail closed (above) |
| no key row | `P0002` "unknown question" (unchanged) | MF-0003 |
| empty-string hash from a client | zod `min(1)` refuses before the DB | SC-4 |
| sent hash ≠ deployed file hash (app) | `changed`, no RPC, no row | SC-3 |
| item flagged/rejected and changed | `withdrawn` wins (checked first, as in `checkCuckooAnswer`) | MF-0006 SC-8 order |

## Success Criteria

- [x] SC-1: **DB refuses a stale version.** `record_attempt(id, chosen, hash)` grades and inserts when the
  hash equals `private.items.content_hash`. It raises `55000` and inserts nothing when the hash differs, and
  `P0002` when a hash is given but no registry row exists. The 2-arg call still grades. Proof:
  `src/server/db/__tests__/mf-0032-attempt-hash.db.acceptance.test.ts` (local stack, frozen; also SC-2, SC-6, SC-7).
- [x] SC-2: **One snapshot, one version.** An answer is never graded against a key from a different sync than
  the hash it was checked against. (a) the sync writes a pack's keys and items in one transaction;
  (b) `record_attempt` reads both in one statement. Proof: DB test that runs the sync's upsert of a new key +
  hash in an open transaction, while a second connection grades the old hash: graded against the OLD key
  (or blocked until commit, then refused), never against the new key with the old hash. Plus a read of
  the function body for a single key/registry statement (diff review).
- [x] SC-3: **App refuses before the DB.** A pure `checkQuestionAnswer` in `src/engine/content` (beside `checkCuckooAnswer`; engine/content already imports question types, the reverse would cycle) returns
  `not-in-pack` / `withdrawn` / `changed` / ok (same order as `checkCuckooAnswer`). `gradeAnswer` calls it,
  sends `p_content_hash` and maps a DB `55000` to `changed`. `gradeCuckoo` sends `p_content_hash` and maps
  `55000` to `changed`. Proof: `src/engine/content/__tests__/mf-0032-answer-hash.acceptance.test.ts` (frozen); `gradeAnswer`/`gradeCuckoo` 55000 mapping by inner unit tests.
- [x] SC-4: **Every graded answer carries the hash.** `AnswerInput` requires `contentHash` (1–128 chars).
  `PlayableQuestion` has `contentHash`, set by `toPlayableQuestion(question, hash)` from `getItemHashes` on
  the duel, walk and plant pages. The duel, walk and seed-checks hooks send it. Proof: `mf-0032-answer-hash.acceptance.test.ts` (AnswerInput), re-frozen MF-0003 DTO-keys test (C-2),
  `src/features/__tests__/mf-0032-answer-hash.acceptance.test.tsx` (each mode sends `contentHash`), and the
  last case of `mf-0032-changed-message.acceptance.test.ts` (the action passes it to `gradeAnswer`).
- [x] SC-5: **The learner is told.** Each mode maps `changed` to "This question changed since you opened it."
  plus its existing restart hint: Duel "Start a new duel.", Walk "Go back to Today to start a fresh walk.",
  Seed Planting "Reload the page for a fresh set of checks." (typed `satisfies Record<GradeError, string>`).
  Proof: `src/features/__tests__/mf-0032-changed-message.acceptance.test.ts` (frozen).
- [x] SC-6: **The attempt records its version** (C-1: user chose store). `public.attempts.content_hash text null`,
  written by `record_attempt` from the registry row (never from the client), readable only by the owner
  (existing policy). Proof: DB acceptance test reads the row back as the learner (hash present) and as
  another learner (no row).
- [x] SC-7: **Grants unchanged.** `private/public.record_attempt(text, text[], text)` EXECUTE for
  `authenticated` only; the `(text, text[])` signature no longer exists; anon cannot call it. Proof: DB test.
- [x] SC-8: Gates. `pnpm typecheck && pnpm lint && pnpm test` green; `pnpm test:db` no new failures vs the
  baseline; `pnpm build` green; browser check on port 3001 of one Duel answer and one Cuckoo answer graded
  after the change (attempt row shows a hash). Evidence in `.planning/evidence/MF-0032.md`; fresh-context
  diff review (high-risk).

## Concerns

| # | Collision | Owner | Status |
|---|-----------|-------|--------|
| C-1 | Store the hash on `attempts` (SC-6)? For: an attempt is a judgement record, and the version it judged can't be reconstructed later (no history of hashes is kept). Against: no reader uses it yet (YAGNI). Recommended: store it. | user | resolved 2026-11-04: store it (SC-6 stands) |
| C-2 | Adding `contentHash` to the client DTO breaks two frozen tests. **MF-0003** `mf-0003-questions.acceptance.test.ts:125` pins `toPlayableQuestion` keys → new expected list adds `"contentHash"`, and the call gains the hash argument. **MF-0012** `mf-0012-duel.acceptance.test.tsx:14` builds a `PlayableQuestion` literal → the fixture adds `contentHash: "h-<id>"`. Reason: the hash is a deliberate pre-answer field, as in `toPlayableCuckoo`. No assertion weakens. Re-freeze both, with `history` entries. | user | resolved 2026-11-04: approved; re-freeze at PLAN approval |

## Out of Scope

- Using the stored hash in the memory replay (e.g. resetting a skill when a question changes). Product
  decision, no ticket yet.
- Composite `(pack_slug, question_id)` keys (MF-0024).
- Changing the deploy/sync order in the runbook (still deploy, then sync). This ticket makes either order
  safe.
- The dev seed sending hashes (it grades as an SQL-side caller; NULL keeps it working).

## Open questions

- (none beyond C-1 and C-2)

## Iteration Log

<!-- append-only -->
- 2026-11-04 INTAKE+DESIGN from the MF-0016 K-4 reservation. Baseline preflight recorded. Checkpoint: C-1, C-2.
- 2026-11-04 Checkpoint: user resolved C-1 (store hash) and C-2 (approve MF-0003 + MF-0012 re-freeze). SCs frozen.
- 2026-11-04 RED: 4 acceptance files frozen (FROZEN.json). SC-5 wording: per-mode restart hint (was "Start a new round.", which doesn't fit Walk/Seed). Flagged to the user.
- 2026-11-04 PLAN approved (high-risk). Re-freeze batch approved: MF-0003 + MF-0012 (C-2) and MF-0008 :70 (found at PLAN). BUILD started.
- 2026-11-04 TEST: VERIFY DONE @ b350c8d0; review changes-requested (SC-2 db case vacuous: lazy RPC ran after COMMIT). User approved re-freeze of that case; delta re-reviewed approve @ 4ac92f74. test:db 55/55, build green. Browser held by another session: HTTP-render substitute. HAND-OFF.
