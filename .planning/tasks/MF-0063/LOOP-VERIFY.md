---
phase: 1-verification
ticket_id: MF-0063
status: complete
verdict: PASS
started_at: "2026-11-06"
completed_at: "2026-11-07"
resume_with: /gsd-goal-loop
---

# Verification — Iteration 1

## RED at freeze (Stage 2b)

| SC | Acceptance test | Red reason at freeze (pasted) |
|----|-----------------|-------------------------------|
| SC-1 | `mf-0063-discussion-link.acceptance.test.ts` | `Error: not implemented` (DiscussionUrl transform stub), 5 cases |
| SC-2 | same file | `Error: not implemented` (action stub) ×7; `expected [Function] to throw error matching /redirect \/sign-in/ but got 'not implemented'` |
| SC-3 | `mf-0063-discussion-link.db.acceptance.test.ts` | `expected 'PGRST202' to be 'ok'` (function missing); `expected 'PGRST204' to be '42501'`; `PostgresError: column "discussion_url" does not exist`. Red twice, no leftovers |
| SC-4 | same DB file | `http://example.com: expected '42703' to be '23514'` (column missing) |
| SC-5 | `mf-0063-discussion-link-form.acceptance.test.tsx` | `TestingLibraryElementError: Unable to find a label with the text of: Chat link` (stub renders null), 7 of 8 cases; the 8th ("offers no Remove while no link is set") is a negative paired with the Remove case |

Inner tests seen red first: `rpc-errors.test.ts` `discussionLinkRpcError` (`TypeError: discussionLinkRpcError is not a function` ×3); `discussion-link-card/__tests__/utils.test.ts` (`Cannot find module '../utils'`).

## SC verdicts

| SC | Verdict | Evidence |
|----|---------|----------|
| SC-1 | PASS | frozen unit file, SC-1 block 5/5 (`Tests 1113 passed (1113)` in the full run) |
| SC-2 | PASS | frozen unit file, SC-2 block 8/8 |
| SC-3 | PASS | frozen DB file 8/8 SC-3 cases (`Test Files 35 passed (35)`, `Tests 191 passed (191)`) |
| SC-4 | PASS | frozen DB file 2/2 SC-4 cases |
| SC-5 | PASS | frozen ui file 8/8 |
| SC-6 | PASS | browser on `next dev -p 3003`: admin invalid → field error, save → link + "on chat.example.com" (`_blank`, `noopener noreferrer`), member link without form, remove → member sees no card; light, dark, 375px; 7 screenshots in `.planning/evidence/MF-0063/` |
| SC-7 | PASS | `mf-0005-grants` 3/3 unedited; no frozen file edited (FROZEN.json hashes); CONTEXT.md "Discussion link"; ladder below |

## Review fixes (REVIEW.md, approve, reviewed_hash 91915747…)

- Finding 1 (should-fix): regression test `src/features/groups/__tests__/discussion-url.test.ts`, run against the
  unfixed `schemas.ts` first: `Tests  4 failed | 1 passed (5)`, `AssertionError: expected true to be false // Object.is
  equality` (`https://example.com:99999`, `https://chat.example.com:80800/c`, `https://999.1.1.1`, `https://1.2.3.4.5`
  accepted). Fix: `URL.canParse(url)` added to the `DiscussionUrl` refine (zod-only; the CHECK can't express it).
  After: 5/5, and the frozen SC-1/2 file is still 13/13.
- Finding 4: new `src/server/db/__tests__/mf-0063-cross-group-admin.db.test.ts` (admin of group A sets or clears
  group B → 42501, B's link unchanged), green under the db lock after `pnpm db:reset`. It is a coverage lock on the
  existing `is_admin(p_group_id)` check, not a bug fix, so there is no RED.
- Finding 3: unicode-edge drift documented in the schema comment. Findings 2 and 5 need no change.
- Post-review change to `src/features/groups/schemas.ts` (zod refine) and two new test files have not been re-read by
  the reviewer. No delete, auth or privileged-client path changed.

## Gates and suite

After the review fixes: typecheck 0 · lint 0 (`Checked 778 files … No fixes applied.`) · `pnpm test --maxWorkers=4` 0
(`Test Files 199 passed (199)`, `Tests 1118 passed (1118)`) · `pnpm test:db` 0 after `pnpm db:reset` (`Test Files 36 passed
(36)`, `Tests 192 passed (192)`) ·
`pnpm build` 0 · `pnpm gate:planning` ok · `pnpm gate:workspace` ok.

Load notes: two earlier full runs under load average 45 timed out in files this ticket does not touch (`Test timed out in
5000ms`, `Hook timed out in 120000ms`, `Failed to start forks worker`); each passed alone and in the re-runs above.

## Receipt (no `ticket:verify` script)

Tree hash = sha256 of `git diff HEAD` plus the untracked files' contents, taken before this receipt line was written.

- `2026-11-07T10:30Z · tree 051c12421ae455302c96d2c0a1a53f9716fd802857dd1029b5c814568b35ca69 · typecheck 0 · gates 2/2 (planning, workspace) · lint 0 · test 1113/1113 · test:db 191/191 · build 0 · collisions 0 · frozen 3/3 hashes match · PASS`
- `2026-11-07 (after review fixes) · review-recipe hash e0f121e493e2ce0b29e2ff249d8658ddc35c9363879a5438f1e76ab32ac067a4 ((git diff HEAD -- . ':!.planning'; git ls-files --others --exclude-standard -- . ':!.planning' | sort | xargs cat) | shasum -a 256) · typecheck 0 · gates 2/2 · lint 0 · test 1118/1118 · test:db 192/192 · build 0 · frozen 3/3 hashes match · PASS`

## Not verified

- Review approved at 91915747…; the post-review delta (schemas.ts refine + 2 new tests) has not been re-read by the reviewer.
- Browser check ran on port 3003 (3001 is the user's server, 3002 held by another main-checkout server); sign-in used the PKCE code from the magic link opened on 3003 (evidence).
- Hydration warning in the app shell after mid-session mobile emulation (evidence, Not verified).

## Verdict: PASS
