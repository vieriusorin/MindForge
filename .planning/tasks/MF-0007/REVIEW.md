---
verdict: approve
reviewed_hash: 610f7c1cc4acca6f806308d109dd335b69f4fe9f9b245aac7569d708b616496e
reviewed_at: 2026-11-04T08:50:06Z
---

> Fresh-context re-review after the iteration-1 fix. Written by the orchestrator from the
> diff-reviewer's final report: the agent-scope hook refused the reviewer's own Write to this path
> (absolute Windows path vs the hook's `.planning/tasks/*/REVIEW.md` pattern). Round 1
> (changes-requested, hash e1a4c4d3…) is summarised in LOOP-PLAN.md "Review iteration".

## Findings

Blocking: none. Round 1's blocking finding (verdict bound to the hash at write time) is closed.

- [note] Migration `:184,235,283,445-455`: `p_content_hash text default null` skips the version
  check. Accepted with the reason stated: not a security hole. `list_reviewable` already returns the
  registry's current `content_hash` to any member, so a direct-API caller could always send the right
  hash anyway. The check protects honest clients against sync/deploy skew, and every app path sends it
  (`actions.ts:38,58,79,96`; zod `min(1)`). The frozen acceptance test calls the 3-arg form. Grants and
  revokes name only the 4-arg and 2-arg signatures, and no older overload exists.
- [note] `flags/page.tsx:35` + `flag-queue/components/item-decision.tsx:6`: `list_open_flags`
  returns no `content_hash`, so the flags page detects "not deployed" but not "another version
  deployed". During skew a maintainer's decision gets 55000 "Reload the page", which won't help until
  the deploy lands. Fails safe; only the message is wrong. Follow-up: return `content_hash` from
  `list_open_flags` / `list_pending_analogies`.
- [note] `review/[packSlug]/page.tsx:96-98,121`: the "N in your queue" badge counts candidates that
  `nextReviewItem` skips during skew. Display only. Follow-up: count matching candidates in an engine helper.
- [note] `flag-queue.tsx:31,51`: `ResolveFlagForm` is keyed by `itemId`, not `id@hash`. A stale hash in
  a mounted form gets 55000. Safe. Follow-up: key `ItemDecision` by `${itemId}@${hash}`.
- [note] Migration `:298`: `approve_analogy` has no `for update`. A concurrent sync stores the approval
  against the old hash, so it doesn't count for the new version. Safe; recorded.
- [note] Round-1 notes still open and handed to the user: cascade delete of reviews and rejections;
  no way to flag approved/official items; hosted "Confirm email" runbook line.

## Verified for this iteration

Hash parity: `itemHashes` over zod `looseObject` output equals `contentHash(raw YAML item)`. Checked
empirically on all 56 items in `packs/**`, and bound by `item-hashes.test.ts` + SC-1. The row lock
comes before the version check and the inserts, and the check runs after all authorization, so 55000
leaks nothing. `nextReviewItem` shows only items whose deployed hash equals the registry's and passes
that hash on. `ReviewActions` is keyed `id@hash`. `getItemHashes` is a cached read of the deployed
files with a validated slug. The new DB test covers stale-hash refusal for approve, flag, reject and
analogy, plus `list_reviewable.content_hash`.

## Checked and sound (carried over)

RLS + revoke-all, no grants/policies; helpers not executable by clients; entry points
authenticated-only on the new signatures; `search_path = ''`; membership and author checks (null-safe;
the sync now refuses human/ai items without an author); maintainer-only flag/analogy functions;
flagger identity to maintainers only; no email leaves the DB; the 48 h clock counts from
`hash_synced_at`; everything is filtered on the current hash; a reject is final; re-flag works; sync
deletes only its own pack's rows; hash helper parity; replay parity on today, groups and duel;
`getReviewContext` signature unchanged; feature code follows the repo rules.
