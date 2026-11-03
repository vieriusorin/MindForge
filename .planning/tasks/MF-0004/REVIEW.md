---
verdict: approve
reviewed_hash: 359c930e88d16035fac41631c50c03d14404a33cde9f06cf79315d0e1e5fd87f
reviewed_at: 2026-11-03T13:46:14Z
---
<!--
Re-review #2. The first review (hash c435155e…, changes-requested) is superseded.
reviewed_hash = `git diff HEAD | shasum -a 256`, as the coordinator asked. That diff also contains the
other session's staged conventions change, and it leaves out untracked files. `pnpm ticket:verify` is
not a script in package.json, and there are no MF-0004 receipts.
Untracked MF-0004 files reviewed: supabase/migrations/20261103150000_mf0004_create_group_guards.sql,
src/server/http/site-origin.ts, src/features/groups/utils/rpc-errors.ts (+ test),
src/features/groups/components/invite-link/{hooks/use-invite-link.ts, components/reset-link.tsx, __tests__/*},
src/components/ui/alert.tsx, docs/runbook/deploy.md, and the 5 frozen acceptance tests.
Re-checked myself: all 5 frozen hashes match FROZEN.json. Unit+ui tests for the touched folders: 8 files /
26 tests green. Sync guard: `SUPABASE_DB_URL=<x> node scripts/sync-question-keys.mjs` on feat/MF-0004
exits 1 before connecting.
-->

## Resolved since review #1
- The former [blocking] item is fixed: B4 at docs/runbook/deploy.md:70 now runs `--level warn --fail-on warn`, and :78 explains why the INFO `rls_enabled_no_policy` lint on `private.*` is expected. `logs/advisors-b4.log` shows "No issues found".
- deploy.md:53 now names the real symptom when `SITE_URL` is missing (sending a magic link and opening a group page throw).
- site-origin.ts imports `server-only`.
- The cap of 10 is cross-referenced in both places: migration line 32 and rpc-errors.ts:10-14.
- sync-question-keys.mjs refuses a remote sync unless it runs on `main` with no changes under `packs/`.
- The invite card is a server component again. The only client leaf is `components/reset-link.tsx`, and `ResetLinkProps` is a `Pick<InviteLinkProps, …>` declared in types.ts.
- use-invite-link.test.tsx now has a pending-state test.

## Findings
- [note] supabase/migrations/20261103150000_mf0004_create_group_guards.sql:32: a comment was added to a migration the local stack has already applied. `.claude/rules/server-side.md` §7 says "never edit an applied one". This edit is comment-only, the migration isn't merged, and it isn't on hosted, so the schema doesn't change. Flagging it so the rule's exception is a conscious one.
- [note] scripts/sync-question-keys.mjs (remote guard): it checks the branch name and a clean `packs/`, but not that `main` is up to date with `origin/main`. A stale local `main` that is missing a newly merged pack would still unregister that pack in production. The runbook's "up-to-date" wording covers this. The script doesn't.
- [note] docs/runbook/deploy.md:98: the dry-run row still points to `.planning/evidence/MF-0004.md`, which doesn't exist yet.
- [note] These are carried over and accepted by the coordinator. There is no concurrency test for the cap; my reasoning says the advisory lock plus READ COMMITTED makes it race-safe. The breadth of the SC-4 scan regex (that test is frozen). The callback route's same-host `nextUrl.origin`. No action-level admin check in `rotateInviteCode` (the DB raises 42501, the same as before this ticket). The ui-design.md "Installed" list doesn't include `alert`. The errcode test path differs from T5's `owns`.
- [note] SC-1, SC-2, SC-3 and SC-8 (hosted), and the hosted half of SC-4, still depend on T8. This approval covers the local, code-side work only.
