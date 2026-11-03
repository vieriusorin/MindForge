---
phase: 1-verification
ticket_id: MF-0002
status: complete
verdict: PASS
started_at: "2026-11-03"
completed_at: "2026-11-03"
resume_with: /gsd-goal-loop
---

# Verification — Iteration 1

## RED at freeze (Stage 2b)

| SC | Acceptance test | Red reason at freeze (pasted) |
|----|-----------------|-------------------------------|
| SC-6 | `mf-0002-rls.db.acceptance.test.ts` | `PostgresError: relation "public.profiles" does not exist` |
| SC-5 | same | `AssertionError: expected { code: 'PGRST202', …(3) } to be null` (create_group not found) |
| SC-2 | same | `AssertionError: expected null to deeply equal []` (tables absent) |
| SC-7a | same | `AssertionError: expected null to deeply equal [ { …(2) } ]` |
| SC-3 | same | `AssertionError: expected { code: 'PGRST202', …(3) } to be null` (join_group not found) |
| SC-7b / SC-4 | same | `expected null to deeply equal […]` |

The file was run twice at freeze with an identical red, so teardown is clean. No re-freezes (`FROZEN.json` history is empty).

| SC | Verdict | Evidence |
|----|---------|----------|
| SC-1 | PASS | `supabase db reset` → `Applying migration 20261103064106_mf0002_groups.sql… Finished supabase db reset` (exit 0). `select relname, relrowsecurity from pg_class where relnamespace='public'::regnamespace and relkind='r'` → group_members true · groups true · profiles true |
| SC-2 | PASS | frozen DB test SC-2 green (`pnpm test:db` 7/7) |
| SC-3 | PASS | frozen SC-3 green (idempotent join, unknown code rejected, C sees no rows) |
| SC-4 | PASS | frozen SC-4 green (member rename/rotate leave name + code unchanged; admin rotate → new code; stale code refused; fresh code joins) |
| SC-5 | PASS | frozen SC-5 green (one admin membership; forged group insert and forged member insert refused) |
| SC-6 | PASS | frozen SC-6 green (anon no SELECT; authenticated SELECT; ≥2 `private` functions, none anon-executable; anon RPC refused) |
| SC-7 | PASS | frozen SC-7a/7b green (own profile read/edit; stranger's profile hidden and unchangeable; visible after sharing a group) |
| SC-8 | PASS | `supabase db advisors --local` → `No issues found`; also `--type all --level info` → `No issues found` |
| SC-9 | PASS (d: see note) | Browser, `http://localhost:3001` (the user's dev server for this repo) + local stack + Mailpit, two isolated contexts. **(a)** anonymous `/groups` → `307 location: /sign-in?next=%2Fgroups` (curl), and in the browser the URL became `/sign-in?next=%2Fgroups`. **(b)** ana@mindforge.test: form → "Check ana@mindforge.test for a sign-in link" → Mailpit "Your sign-in link" (`/auth/v1/verify?token=pkce_…&redirect_to=…/auth/callback?next=%2Fgroups`) → landed on `/groups` signed in ("My groups · Sign out") → created "Cohort" / CCDV-F → `/groups/fde881da-…`: "Members (1) ana (you) · admin", invite link `http://localhost:3001/join/03bd87a9…`, "Reset link" button, 8 regions with exam weights, 25 seed tiles. **(c)** bob@mindforge.test in context "bob": invite URL → `/sign-in?next=%2Fjoin%2F03bd…` → magic link → back on `/join/03bd…`. DB check **before** pressing Join: only `ana/admin` in `group_members` (GET did not join) → "Join the group" → `/groups/fde881da-…`: "Members (2) ana · admin, bob (you)"; no Reset button for bob. **(d)** `grep -rnE "SERVICE_ROLE\|sb_secret\|SECRET_KEY" src --exclude-dir=test` → no match. NEXT_PUBLIC vars = `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` only. **Note:** taken literally, `grep … src` (incl. `src/test/`) hits `src/test/local-stack.ts`, the test-only harness that creates users with the local stack's default secret key. It's imported only from `__tests__` (`grep -rln "@/test/" src | grep -v __tests__` → empty), as the GOAL constraint allows. Reported to the user. |
| SC-10 | PASS | receipt below; MF-0001 frozen hashes unchanged; `/` still renders the public forest (now partial prerender because of the header); REVIEW.md `approve` |

## Found during verification (fixed inside BUILD)

- Browser (b) showed the dev overlay "Blocking Route: Next.js encountered the unstable value Date.now() while prerendering" at `src/app/layout.tsx:42 <AccountNav/>`. Cause: Partial Prefetching renders the App Shell with session data, and `getClaims()` compares token expiry with `Date.now()` (Next docs `optimizing-prefetching.md:208`). Fix: `await connection()` at the top of `createServerSupabase()`. After reload the overlay was gone and the flow completed.

## Gates and suite

typecheck 0 · gates 0/0 (none defined) · lint 0 (Biome, 73 files) · unit 18/18 (5 files) · db 7/7 (1 file) · build 0 · check-hooks PASS · frozen MF-0001 + MF-0002 match.

## Receipt (default; no VERIFY script)

Tree hash = sha256 of `git diff HEAD` + contents of untracked files outside `.planning/`.

```
2026-11-03T06:48:28Z · tree cd22c9492ace… · … · PASS                    (reviewed tree)
2026-11-03T06:52:13Z · tree e8291b6f3dbf27325a1b10f9879567c83faae1c8343231634865c42f75e39bdd · typecheck 0 · gates 0/0 · lint 0 · test 18/18 (5 files) · test:db 7/7 (1 file) · build 0 · check-hooks 0 · frozen True · PASS
```

The only change between the two trees is README.md.

## Reviewer notes deferred (not fixed here)

1. `proxy-session.ts`: the `/sign-in` redirect doesn't copy the no-cache headers from `setAll`.
3. `rotateInviteCode` ignores RPC errors (the DB still refuses non-admins).
4. `create_group` validates `pack_slug` by pattern only: a direct RPC with an unknown slug makes a group whose page errors (for that caller only). There's also no per-user group limit.
→ proposed follow-up ticket (hardening). Note 2 (exact hosted redirect URLs) → hand-off step. Note 5 (`revoke all` blocks TRUNCATE) → README "Writing a migration" + retro.

## Not verified

- Hosted Supabase / production SMTP / deployment (no hosted project, ❓Q-3).
- Session cookies on a production domain (Secure, SameSite) and real email deliverability.
- Light scheme and phone width of the new pages.
- `/auth/callback` error branch (expired or reused link) was not exercised in the browser; it's covered by reading the code only.

## Verdict: PASS
