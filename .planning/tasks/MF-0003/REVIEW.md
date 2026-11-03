---
verdict: approve
reviewed_hash: 0293104946228b321e631d731cfcb37bc74f7e30d5b8ee3af1596e6c5471a6cb
reviewed_at: 2026-11-03T08:50:56Z
---
## Findings

Second pass. I re-reviewed only the delta since the first-pass tree (44a6fc17…), which got changes-requested at 2026-11-03T08:47:24Z. reviewed_hash is the last line of receipt.txt: PASS at 08:50:33Z, unit 49, db 12, frozen ok. The repo has no `ticket:verify` command, so I couldn't recompute the hash myself. No file under src/, packs/, scripts/, supabase/, README.md or package.json is newer than receipt.txt. The three frozen tests still match FROZEN.json (77081ab09eb2 / 91cabad8f95f / aaaeeb3cef14). The live `private.record_attempt` contains the new bound check.

### Original findings: status

- [blocking → FIXED] src/server/memory/list-my-attempts.ts:11 now delegates to src/server/memory/fetch-attempts.ts:19-38.
  - It reads pages of 500 with `.range()`, which is below `max_rows = 1000`.
  - Order is `(answered_at, id)`, a total order, so pages can't skip or repeat rows.
  - The loop stops on a short page.
  - Errors are thrown, not swallowed.
  - The regression test src/server/memory/__tests__/fetch-attempts.db.test.ts seeds 1205 rows and asserts the count and that the newest row is included. RED was shown at 1000.
  - All three callers (group page, /today, duel) go through `listMyAttempts`.
- [note → DEFERRED] Learn the key from the feedback, then answer it. This yields a sprout only (stability ≈ 2.3). Going to the hardening ticket.
- [note → DEFERRED] Stale-key mismatch between the file-based feedback and the DB grade, plus the days-long `cacheLife`.
- [note → ACCEPTED as-is] The action maps every RPC error to the "sync keys" message, and an unknown pack slug gives a 500. No key leaks either way. The coordinator didn't list this one, so I'm recording it as accepted, not fixed.
- [note → FIXED] scripts/sync-question-keys.mjs:31-36. Only ENOENT means "no questions"; any other read error throws before the delete.
- [note → DEFERRED] The sync script doesn't run the validator, and the cross-pack `question_id` PK / orphaned keys remain.
- [note → FIXED] package.json:14. `db:reset` now runs `SUPABASE_DB_URL= node …`, and the empty value is falsy in `dbUrl()` (sync-question-keys.mjs:19), so it always syncs to the local stack. `db:sync-keys` still honours `$SUPABASE_DB_URL` on purpose.
- [note → FIXED] supabase/migrations/20261103083446_mf0003_attempts.sql:63-66. A null element, or an element whose length isn't 1..8, raises 22023 before anything is inserted. Test: src/server/db/__tests__/mf-0003-review.db.test.ts. Per-user rate limiting is DEFERRED.
- [note → ACCEPTED] `service_role` keeps TRUNCATE on attempts, and the identity sequence keeps its default grants. Neither is reachable via the Data API.
- [note → FIXED] src/engine/questions/schema.ts:25 uses `z.url({ protocol: /^https?$/ })`. I checked it: `javascript:` is rejected and `https:` is accepted. Test: src/engine/questions/__tests__/schema.test.ts.
- [note → FIXED] src/features/duel/components/duel-session/duel-session.tsx:177. The text "Correct! Recalled and recorded." no longer claims growth.
- [note → DEFERRED] Double-submit guard in use-duel-session.ts:50.
- [note → DEFERRED] a11y: live region mounted already filled, focus lost on the check/next swap, `aria-labelledby` on the card div.
- [note → DEFERRED] Raw `<fieldset>`/`<legend>` instead of shadcn `FieldSet`/`FieldLegend`.
- [note → DEFERRED] Back link goes to `/groups`, not the group the duel was opened from.
- [note → ACCEPTED] Plan `owns` paths moved under `(app)` because of the parallel UI session; recorded in LOOP-VERIFY.
- [note → ACCEPTED] MDN citations in D2.S4 (a SWE skill; the content brief allows them). The coordinator reports the official samples were verified against the Exam Guide via pypdf (B/B/B). I didn't re-verify that myself.

### New in the delta

- [note] src/server/memory/fetch-attempts.ts:1 — no `import "server-only"`. It's harmless today: it only takes a client its caller passes in, and the only importer (list-my-attempts.ts) is server-only. Adding the guard would keep it from being imported into a client bundle later.

No blocking findings remain.
