---
ticket_id: MF-0007
tier: high-risk                   # schema + RLS + SECURITY DEFINER; decides what learners are taught
stage: handoff
branch: feat/MF-0007
builds_on: [MF-0006, MF-0005]
last_iteration: 1
goal_status: complete-pending-manual-commit
track: S                          # seat Coder E
week: W2
depends_on: [MF-0006]
blocks: []                        # others read review state through MF-0006's getReviewContext seam
---

> Drafted 2026-11-03 from the planning grill (Q1, Q2, Q6, Q13; ADR 0001). SCs are proposals; the
> claimant confirms and freezes them.

## Objective

Today nothing is approved: G3 needs 25 skills × 15 approved questions (750 approvals), and G4 needs
every item checked by two people. There is no way to approve, flag or reject an item.

End state: **Pollination.** Any learner in a group for a pack reviews items in a queue: approve, or
flag with a reason. Two approvals from two non-authors make an item approved; one open flag hides it
until a content maintainer fixes it (PR) or dismisses the flag; only maintainers reject. Every game
mode serves only playable items, and the forest ignores attempts that shouldn't count.

## Affected

- **Roles:** reviewer (any learner in a group for the pack), content maintainer, analogy owner (cards).
- **Surfaces:** new tables `item_reviews`, `flag_resolutions` (or equivalent), `private.items` registry, `private.content_maintainers`; extended `scripts/sync-question-keys.mjs` (→ sync all items); `src/features/review/**`; routes `/review/[packSlug]`, `/review/[packSlug]/flags`; readers in `src/server/questions/**`; replay filter in `src/engine/memory/`.

## Constraints

- Terms and rules as in `CONTEXT.md` (Review state, Reviewer, Flag, Content maintainer, Analogy owner, Spoiled, Playable, Attempt).
- Review state is derived, never written to files (ADR 0001).
- Revoke-all-first on every new table; SECURITY DEFINER only in `private` with an `auth.uid()` check; grants gate (MF-0005) stays green.
- Implements the body of `getReviewContext` (MF-0006 SC-8); its signature does not change, so storms, heatmap and walk pick up real review state without edits.
- Migrations follow the parallel rule in ROADMAP §4.
- Reviewers' identities on flags are visible to maintainers only.

### Constraints → how met (draft, 2026-11-03)

- CONTEXT terms → `private.items`, `private.item_reviews`, `private.flag_resolutions`, `private.content_maintainers`; states exactly `unreviewed | approved | flagged | rejected`.
- ADR 0001 → state is computed by a `private` function from reviews + the registry's current hash; nothing is written back to `packs/`.
- Revoke-all-first / definer-in-private / grants gate → **every new table lives in `private` with RLS on, `revoke all … from public, anon, authenticated`, and no grants at all.** All reads and writes go through `private.*` SECURITY DEFINER functions (`set search_path = ''`, `auth.uid()` check) behind `public.*` security-invoker shims, executable by `authenticated` only (the MF-0003 `record_attempt` pattern). The MF-0005 allow-lists therefore stay unchanged; the gate passing *is* SC-10's grants proof.
- `getReviewContext` signature unchanged → only the body of `src/server/content/get-review-context.ts` changes.
- ROADMAP §4 parallel rule → one migration, only this ticket's objects, timestamp newer than `20261103150000_mf0004…`; `pnpm db:reset && pnpm test:db` before hand-off.
- Flag identities → a flag's reviewer is returned only by the maintainer-only flags function; everyone else gets the item's state.
- Author ↔ account (C-1) → the registry keeps the file's `author` email; a `private` function compares it with the `auth.users.email` of `auth.uid()` (lower-cased). No email ever leaves the database.

## Decided without a question

- The sync script publishes an item registry (id, pack, skill, type, content hash, origin, author email) next to the answer keys; reviews bind to (item id, content hash).
- Official items are approved from the start but can be flagged.
- A flag needs a non-empty comment. Maintainer actions: dismiss (with comment) or reject. Fixing = a PR that changes the hash.
- Nature cards also need the analogy owner's approval; after 48 h without it, any maintainer may give it. Analogy owner = Coder F seat.
- Reviewing a question spoils it for that reviewer; attempts on rejected questions drop out of the replay; flagged still count (Q2, Q6).
- Maintainer list is a table edited by migration/SQL; no admin UI.
- `private.content_maintainers (pack_slug, email, is_analogy_owner)` keyed by **email**, so a maintainer can be listed before first sign-in; the migration seeds nobody (KICKOFF: the Owner adds maintainers by SQL). Tests seed their own fixtures. — follows from "edited by migration/SQL" + KICKOFF Owner task.
- With no analogy owner listed for a pack, a card can only be approved through the 48-hour maintainer fallback — follows from ROADMAP D-6.
- No table grants (see Constraints → how met); the MF-0005 allow-lists are not edited — follows from MF-0005's frozen gate and the loop's "never edit a gate allowlist" rule.
- `getPackQuestions` stays a shared `"use cache"` file read; per-user filtering stays at the page/action via `getReviewContext` (never cached: spoiled is per-user) — follows from server-side.md §2 and MF-0006's duel wiring.
- **Consequence noted, not changed:** since MF-0006 every CCDV-F item has `author: vlad.parvana@ddroidd.com`, so that account can never approve them and its `ccdv-f` queue starts empty; SC-9's browser proof uses two other local test accounts.

## Success Criteria

- [x] SC-1: `pnpm db:reset` syncs every item (questions, cards, diagrams) into the registry with its current hash; running it twice changes nothing. Proof: DB test.
- [x] SC-2: A user with no group for the pack cannot review (refused); a member can. Proof: DB acceptance test with real tokens.
- [x] SC-3: The author's own approval is refused; two approvals from two distinct non-authors on the current hash → `approved`; the same reviewer approving twice counts once. Proof: DB test.
- [x] SC-4: A flag without a comment is refused; one open flag → `flagged`; a maintainer's dismiss → back to the state the approvals give; a non-maintainer can't dismiss or reject. Proof: DB test.
- [x] SC-5: After the item's content changes (new hash synced), its state is `unreviewed` again and old reviews no longer count. Proof: DB test.
- [x] SC-6: Official items read as `approved` with zero reviews; a nature card with 2 approvals but no analogy-owner approval is not approved; with the 48-hour fallback it is. Proof: DB test with a fixed clock or timestamp fixture.
- [x] SC-7: Duel (and the shared question reader) serve only approved + unreviewed items; flagged and rejected never appear. Proof: test on the reader.
- [x] SC-8: Replay: attempts on rejected questions and a reviewer's attempts after reviewing that question are excluded. Proof: engine acceptance test with fixtures.
- [x] SC-9: `/review/[packSlug]` shows the next item I didn't author and haven't reviewed, heavy skills first, with the full item (key and rationales); approve/flag work; maintainers see `/review/[packSlug]/flags`. Proof: browser on local stack, two users.
- [x] SC-10: Advisors clean; grants gate green; shadcn + tokens only. Proof: receipt.

## Concerns

| # | Collision | Owner | Status |
|---|-----------|-------|--------|
| C-1 | Author = email in the file; matching it to `auth.users.email` must happen inside a `private` function, never by exposing emails. | Coder E | resolved 2026-11-03: private-function comparison (Constraints → how met) |
| C-3 | SC-6's 48-hour fallback has no start time: from when the card's current version was synced, or from when it reached 2 approvals? | user | resolved 2026-11-03 (user): from when the card's current content hash was first synced into the registry; an edit restarts it. |
| C-4 | Seat Coder E; KICKOFF asks Coder E to send the schema sketch to the Owner before writing the migration. High-risk tier also requires plan approval. | user / Owner | resolved 2026-11-03 (user): the user takes the seat and approves the plan (schema sketch in LOOP-PLAN.md) at the high-risk checkpoint; forwarding it to the Owner is the user's call. |
| C-2 | MF-0004 owns the pack-slug table; this ticket's item registry stores `pack_slug` as text and does not depend on it. | Coder E | resolved 2026-11-03 |

## Out of Scope

- "Reviewing waters the tree" reward, review leaderboards, editing items in the app.

## Open questions

- none.

## Iteration Log

<!-- append-only -->

- 2026-11-03 · design → plan · Claimed on `feat/MF-0007` after MF-0005 merged. User: takes seat Coder E and approves the plan (C-4); 48 h clock = first sync of the current hash (C-3). Design choice: no table grants, all access through definer functions, so MF-0005's frozen allow-list stays unchanged. `ReviewContext` gains `spoiledAt`. Froze 2 files, 8 tests red (FROZEN.json, LOOP-VERIFY.md). LOOP-PLAN.md written; waiting for the user's approval (high-risk).
- 2026-11-04 · plan → build · User approved LOOP-PLAN.md iteration 0 (high-risk checkpoint) unchanged.
- 2026-11-04 · build → test → handoff · BUILD T1–T5 (migration, sync registry, engine, server reads +
  actions + replay parity, review + flags UI). Receipt for code-diff hash 610f7c1c…: typecheck, lint,
  136 unit/ui, 27 DB tests ×2, advisors + db lint clean, build, browser with two local users. Review
  round 1 changes-requested (verdict bound to registry hash, not version read) → iteration 1: optional
  `p_content_hash` + 55000, deployed-file hashes in the app, row lock + clock_timestamp, sync author
  guard; regression test shown RED then GREEN. Round 2 approve on the same hash. Open follow-ups
  (fail-safe) listed in REVIEW.md and the hand-off.
