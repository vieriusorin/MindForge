---
ticket_id: MF-0002
tier: high-risk                   # schema + migrations, RLS, auth wiring, a privileged function
stage: handoff
branch: main
builds_on: [MF-0001]              # MF-0001 is complete-pending-manual-commit
last_iteration: 1
goal_status: complete-pending-manual-commit
---

## Objective

Today MindForge is a public, read-only forest page (MF-0001). Nobody can sign in, and there are no
groups, so "learn together" (spec §1.2 principle 5, §1.6 roles, slice B8) doesn't exist.

End state: on a **local Supabase stack**, a colleague signs in with an **email magic link**,
creates a **study group** for a pack (becoming its admin), and shares an **invite link**. Another
colleague opens the link, signs in, and lands as a member of that group. Each member sees the
group's forest (still all seeds, since memory arrives in MF-0003) and the member list. Every row is
protected by RLS at the database, not by the UI: a non-member can't read a group, its members or
its invite code, even by calling the Data API directly with their own token.

## Affected

- **Roles (spec §1.6):** anonymous visitor · signed-in learner · group **admin** (creator) · group **member**.
- **Surfaces:** `supabase/` (config, migrations); tables `profiles`, `groups`, `group_members`; functions `create_group`, `join_group`, `rotate_invite_code`; `src/server/supabase/*` (server/browser clients, proxy session refresh); `src/server/groups/*` (service reads + actions); routes `/sign-in`, `/auth/callback`, `/groups`, `/groups/[groupId]`, `/join/[code]`; `proxy.ts`; header on `/`.

## Constraints

- RLS on every table in `public`, policies scoped by ownership or membership, never just `TO authenticated` (supabase skill checklist) → SC-2..SC-5 are DB-level tests with real user tokens.
- New tables are not auto-exposed to the Data API (Supabase changelog 2026-04-28) → explicit `GRANT … TO authenticated` per table, nothing to `anon` → SC-6.
- `SECURITY DEFINER` only where a non-member must act on a group they can't see (join by code, atomic create). Those functions live in a non-exposed `private` schema, check `auth.uid()` in the body, and have `EXECUTE` revoked from `PUBLIC`/`anon`. A thin `SECURITY INVOKER` wrapper sits in `public` → SC-3, SC-6, SC-8.
- Never authorize on `user_metadata` → roles live in `group_members.role` only.
- No service-role / secret key in app code or in any `NEXT_PUBLIC_` variable. Only the test harness uses it, to create test users → SC-9 check.
- Server code verifies the user with `auth.getClaims()`/`getUser()`, never trusting `getSession()` alone. Per-user pages aren't cached (`nextjs-data`): reads sit under `<Suspense>`, never in `"use cache"`.
- Engine stays pack-agnostic and DB-free (MF-0001 SC-4 must stay green).
- Migrations are applied to the **local** stack only; no hosted project exists yet.

## Decided without a question

- Supabase (spec ❓Q-1): user, 2026-11-02 (`/gsd-goal-loop MF-0002 supabase`).
- Sign-in = email magic link, PKCE via `@supabase/ssr` → `/auth/callback` exchanges the code: user, 2026-11-02. Rationale for the link over a typed 6-digit code: free-plan default SMTP can't customise templates (changelog 2026-06-03), and the default template carries a link.
- Any signed-in user may create a group and becomes its admin: user, 2026-11-02.
- Joining = shareable invite link `/join/<code>`, no expiry, admin can rotate: user, 2026-11-02.
- Local stack only; the hosted project is created at hand-off: user, 2026-11-02.
- **Any member (not only the admin) can see and share the invite link.** This follows from spec principle 5 "learn together" and from rotation being admin-only; it's reversible, so it's not a question. Shown at the checkpoint.
- A group belongs to exactly one pack (`pack_slug`), validated against `packs/` at create time (spec §2.7 `groups.pack_id`). A user may be in many groups.
- Display name in member lists = `profiles.display_name`, defaulting to the email's local part. Emails of other members are **not** shown (PII).
- Leaving or removing members, deleting groups, group heatmap: later tickets (Out of Scope).

## Success Criteria

- [x] SC-1: From an empty local stack, `supabase db reset` applies all migrations with exit 0, and the three tables exist with RLS enabled. Proof: command log + `pg_class.relrowsecurity` query in LOOP-VERIFY.
- [x] SC-2: Isolation. Users A (admin of G1) and B (no group). With B's own token via supabase-js: `groups` select returns 0 rows for G1, `group_members` 0 rows for G1, and inserting `{group_id: G1, user_id: B}` into `group_members` is refused. With A's token: G1 is visible, and the member list shows A as `admin`. Proof: DB acceptance test `src/server/db/__tests__/mf-0002-rls.db.acceptance.test.ts`.
- [x] SC-3: Join by invite code. B calls `join_group(G1's code)` → returns G1's id; B now sees G1 and both members, with B's role `member`. Calling it again is idempotent (still 2 members, B still `member`). An unknown code raises an error and adds no row. Proof: same file.
- [x] SC-4: Admin-only changes. As member B: renaming G1 and `rotate_invite_code(G1)` change nothing (the name and code read back unchanged). As admin A: `rotate_invite_code(G1)` returns a new code, and the old code no longer joins (a third user C gets an error). Proof: same file.
- [x] SC-5: Create is atomic and self-scoped. A calls `create_group('Cohort', 'ccdv-f')` → exactly one group plus one `admin` membership for A. A user can't create a membership or group row on someone else's behalf by direct insert (`created_by`/`user_id` ≠ `auth.uid()` refused). Proof: same file.
- [x] SC-6: Anonymous and grants. With the publishable/anon key and no session, `profiles`, `groups` and `group_members` return 0 rows or a permission error, and `join_group`/`create_group` are refused. `has_function_privilege('anon', …)` is false for every `private.*` function. Proof: same file.
- [x] SC-7: Profiles. A user can read and update only their own profile, plus read the profiles of people who share a group with them. B can't read A's profile before joining but can after. Proof: same file.
- [x] SC-8: `supabase db advisors` (security) reports no warnings or errors for MindForge objects. Proof: output pasted.
- [x] SC-9: App wiring, in a browser against the local stack with Mailpit: (a) `/groups` redirects an anonymous visitor to `/sign-in`; (b) A signs in via the magic link from Mailpit, creates group "Cohort" for CCDV-F, and sees it with 8 regions / 25 seeds and the invite link; (c) B opens the invite link in an isolated browser context, signs in, and lands on the group page listed as a member; (d) `grep -rn "SERVICE_ROLE\|sb_secret" src` is empty and no `NEXT_PUBLIC_` variable holds a secret. Proof: browser observations + grep pasted.
- [x] SC-10: MF-0001 stays green (forest acceptance tests, `/` still renders the public CCDV-F forest); typecheck, lint, unit + DB suites, build, check-hooks all pass; fresh-context reviewer approves the diff; evidence file. Proof: VERIFY receipt + REVIEW.md.

## Concerns

| # | Collision | Owner | Status |
|---|-----------|-------|--------|
| C-1 | DB tests need Docker + `supabase start`; the Stop gate and `pnpm test` currently run every test. Proposal: split `pnpm test` (unit) from `pnpm test:db` (local stack), with VERIFY running both. This edits the protected `vitest.config.ts`/`package.json`. | user | resolved 2026-11-02: split `pnpm test` / `pnpm test:db`; VERIFY runs both |
| C-2 | Members seeing the invite link vs admins-only. | user | resolved 2026-11-02: any member can see and share; only admin rotates |

## Out of Scope

- Hosted Supabase project, production SMTP, deploy (hand-off lists the steps; ❓Q-3).
- Google OAuth, passkeys.
- Leaving or removing members, deleting groups, transferring admin.
- FSRS / `memory_states` (MF-0003), content items and review workflow, group heatmap, expeditions.
- Forest visibility rules between members (❓Q-4): nothing per-member exists yet.

## Open questions

- none.

## Iteration Log

<!-- append-only -->

### Iteration 1

```yaml
phase: 1-complete
verdict: PASS
started_at: "2026-11-02"
completed_at: "2026-11-03"
```

**Result:** PASS: SC-1..SC-10. SC-9(d): no secret in app code; the literal grep over all of `src` hits only the test harness `src/test/local-stack.ts`, which the Constraints allow (reported to the user). One BUILD fix came out of the browser check (`connection()` before Supabase auth, for the Partial Prefetching "blocking route" error). Reviewer approved with 7 notes; 1, 3 and 4 are deferred to a hardening ticket.
**Suggested commit message:** `MF-0002 feat: Supabase magic-link sign-in, study groups with invite links, RLS-isolated profiles/groups/members`
