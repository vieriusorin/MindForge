---
verdict: approve
reviewed_hash: b7a1fb531f97744759e75af1cc0d18525c53d654c9850cdc7264a6da502da8d8
reviewed_at: 2026-11-05T09:49:21Z
---
Delta re-review. The previous review (changes-requested on 0229eac5…) is void, since the tree changed.
Scope: the 27 MF-0017 paths. `.claude/hooks/stop-gate.mjs` (MF-0023) not reviewed.

Frozen files recomputed, LF-normalised sha256, all match FROZEN.json:
- engine acceptance 42cc22c7… (unchanged)
- DB acceptance 8a9d5b30… (re-frozen, `history` entry from be8f1bbc…, approved_by user 2026-11-05)
- form acceptance cb420e1e… (unchanged)

## Findings

- [resolved] B1. supabase/migrations/20261105100000_mf0017_expeditions.sql:138-141. The member
  join now has `a.answered_at >= m.joined_at`, so a join adds 0 to every past or running total.
  The jump on join, which was the per-member oracle, is gone. Recalls after joining blend into the
  others' sum, which is the step-of-1 residual the user already accepted (GOAL C-2 (b)).
  `joined_at` creates no new inference. When someone joined is already observable from the member
  list (`listMembers` orders by it), and the filter only removes rows, so it exposes no figure.
- [note] Parity after the fix. The `joined_at` cut, like the window, domain and `correct` filters
  before it, is applied in the test (db test :522, :543), because `countableAttempts` has no
  membership concept. That part matches by construction. The fix is still pinned independently by
  the literal: the new pre-join M2 row (db test :157, `counts: false`) keeps `EXPECTED_PROGRESS` at
  7. The evidence shows the unfixed SQL failing at 8, so the SC-2 literal assertion does detect a
  regression. Not blocking.
- [note] supabase/migrations/20261105100000_mf0017_expeditions.sql:2. The header summary still says
  "counted over every current member". The B1 bullet at :14 and the inline comment at :138
  qualify it. Comment only. Since the migration is uncommitted, it can be touched up in place.
- [note] Accepted residual recorded. Alt accounts can fill a group to 4 (migration :15, GOAL (e)
  with a follow-up). I am not re-raising it.
- [resolved] nits. rpc-errors.ts:13 uses `EXPEDITION_MIN_MEMBERS`. The card's "none" copy moved to
  `utils.ts` `noneLine` (expedition-card.tsx:49), with tests in `__tests__/utils.test.ts:41-46`.
  CONTEXT.md:37 and GOAL SC-2 now say "since they joined the group".
- Unchanged from the first review and still good (unchanged code): definer functions with
  `search_path = ''`, the same 42501 for an unknown id and a non-member, the ≥ 4 gate on start and
  progress, the table with RLS on, no policy and no grant, an exclusion constraint that holds under
  races, DB-set times, and an action that re-parses its input with the DB re-checking it. The card
  and form follow the split rules, with figures from `summarizeExpedition`.

Zero blocking findings.
