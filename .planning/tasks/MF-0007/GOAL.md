---
ticket_id: MF-0007
tier: high-risk                   # schema + RLS + SECURITY DEFINER; decides what learners are taught
stage: design
branch: main
builds_on: []
last_iteration: 0
goal_status: reserved
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

## Decided without a question

- The sync script publishes an item registry (id, pack, skill, type, content hash, origin, author email) next to the answer keys; reviews bind to (item id, content hash).
- Official items are approved from the start but can be flagged.
- A flag needs a non-empty comment. Maintainer actions: dismiss (with comment) or reject. Fixing = a PR that changes the hash.
- Nature cards also need the analogy owner's approval; after 48 h without it, any maintainer may give it. Analogy owner = Coder F seat.
- Reviewing a question spoils it for that reviewer; attempts on rejected questions drop out of the replay; flagged still count (Q2, Q6).
- Maintainer list is a table edited by migration/SQL; no admin UI.

## Success Criteria

- [ ] SC-1: `pnpm db:reset` syncs every item (questions, cards, diagrams) into the registry with its current hash; running it twice changes nothing. Proof: DB test.
- [ ] SC-2: A user with no group for the pack cannot review (refused); a member can. Proof: DB acceptance test with real tokens.
- [ ] SC-3: The author's own approval is refused; two approvals from two distinct non-authors on the current hash → `approved`; the same reviewer approving twice counts once. Proof: DB test.
- [ ] SC-4: A flag without a comment is refused; one open flag → `flagged`; a maintainer's dismiss → back to the state the approvals give; a non-maintainer can't dismiss or reject. Proof: DB test.
- [ ] SC-5: After the item's content changes (new hash synced), its state is `unreviewed` again and old reviews no longer count. Proof: DB test.
- [ ] SC-6: Official items read as `approved` with zero reviews; a nature card with 2 approvals but no analogy-owner approval is not approved; with the 48-hour fallback it is. Proof: DB test with a fixed clock or timestamp fixture.
- [ ] SC-7: Duel (and the shared question reader) serve only approved + unreviewed items; flagged and rejected never appear. Proof: test on the reader.
- [ ] SC-8: Replay: attempts on rejected questions and a reviewer's attempts after reviewing that question are excluded. Proof: engine acceptance test with fixtures.
- [ ] SC-9: `/review/[packSlug]` shows the next item I didn't author and haven't reviewed, heavy skills first, with the full item (key and rationales); approve/flag work; maintainers see `/review/[packSlug]/flags`. Proof: browser on local stack, two users.
- [ ] SC-10: Advisors clean; grants gate green; shadcn + tokens only. Proof: receipt.

## Concerns

| # | Collision | Owner | Status |
|---|-----------|-------|--------|
| C-1 | Author = email in the file; matching it to `auth.users.email` must happen inside a `private` function, never by exposing emails. | Coder E | open |
| C-2 | MF-0004 owns the pack-slug table; this ticket's item registry stores `pack_slug` as text and does not depend on it. | Coder E | resolved 2026-11-03 |

## Out of Scope

- "Reviewing waters the tree" reward, review leaderboards, editing items in the app.

## Open questions

- none.

## Iteration Log

<!-- append-only -->
