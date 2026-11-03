---
phase: 1-planning
ticket_id: MF-0002
status: executing
verdict: IN_PROGRESS
started_at: "2026-11-03"
resume_with: /gsd-goal-loop
---

# Loop Plan — Iteration 1

## Discovery summary

- Precedent: MF-0001 (uncommitted): `src/engine/**` (pure, pack-agnostic), `src/server/packs/get-pack.ts` (`"use cache"` read of `packs/<slug>/pack.yaml`), `src/features/forest/components/forest/` (presentational), `src/app/page.tsx` (container). Gates: none (`gate:*` absent); `scripts/check-hooks.mjs` exists.
- Supabase CLI 2.120.0; `supabase init` + `supabase start` done; `config.toml`: `auto_expose_new_tables = false`, `site_url = http://localhost:3000`, redirects `localhost:3000/**`, `localhost:3001/**`. Mailpit at :54324. Imperative migrations (no `supabase/schemas/`).
- Packages pinned: `@supabase/supabase-js` 2.118.0, `@supabase/ssr` 0.12.7, `postgres` (dev). `@supabase/ssr` `setAll(cookies, headers)` must also copy the no-cache headers onto the response (`dist/main/types.d.ts:25-58`). auth-js recommends `getClaims()`/`getUser()` over `getSession()` (`GoTrueClient.d.ts:1406-1411`).
- Supabase docs: env names `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; Next 16 → `proxy.ts` refreshes the session with `getClaims()` and must return the response that `setAll` built. Next docs `01-app/01-getting-started/16-proxy.md`: Proxy is for optimistic checks only, not full authorization → every page and action re-checks the user server-side.
- Changelog 2026-04-28: tables not auto-exposed → explicit GRANTs. 2025-03-18: custom objects in the `auth` schema are restricted; an AFTER INSERT trigger *on* `auth.users` calling a function in our own schema is still the documented profile pattern (verified at migration time; fallback below).
- Frozen contract: `src/server/db/__tests__/mf-0002-rls.db.acceptance.test.ts` (sha `84ef58af0671`), red for "relation does not exist" / `PGRST202`.

## SC coverage

| SC | Steps | Proof |
|----|-------|-------|
| SC-1 | 1 | `supabase db reset` log + `relrowsecurity` query |
| SC-2..SC-7 | 1 | frozen DB acceptance file (`pnpm test:db`) |
| SC-8 | 1 | `supabase db advisors` output |
| SC-9 | 2–8 | browser on local stack + Mailpit; secret grep |
| SC-10 | all | VERIFY receipt (unit + db + typecheck + lint + build + check-hooks) + REVIEW.md |

## Steps

1. **Migration** `supabase migration new mf0002_groups` → one SQL file:
   - `create schema private`; `revoke all on schema private from public`; `grant usage on schema private to authenticated`.
   - Tables: `profiles(id uuid pk → auth.users on delete cascade, display_name text 1..60, created_at)`; `groups(id uuid pk default gen_random_uuid(), name text 1..80, pack_slug text check kebab-case, invite_code text unique not null, created_by uuid → auth.users on delete cascade, created_at)`; `group_members(group_id → groups on delete cascade, user_id → auth.users on delete cascade, role text check in ('admin','member'), joined_at, pk(group_id,user_id))` + index on `group_members(user_id)`.
   - `enable row level security` on all three.
   - Helpers in `private`, all `stable security definer set search_path = ''`, each reading `(select auth.uid())`: `is_member(gid)`, `is_admin(gid)`, `shares_group(other_user)`. They exist to avoid RLS recursion on `group_members`. `new_invite_code()` = 32 hex chars from `gen_random_uuid()`.
   - Privileged ops in `private` (`security definer`, `set search_path = ''`, raise when `auth.uid()` is null): `create_group(p_name, p_pack_slug)` inserts the group and the admin membership in one transaction and returns the id; `join_group(p_code)` looks up the code, raises `invalid invite code` if unknown, inserts the member `on conflict do nothing`, returns the group id; `rotate_invite_code(p_group_id)` raises unless `is_admin`, sets a new code, returns it.
   - `public` wrappers (`security invoker`, `language sql`) with the same names and args, calling the private ones. These are the only RPC surface.
   - `private.handle_new_user()` (`security definer`) + `after insert on auth.users` trigger → profile with `display_name = left(split_part(email,'@',1), 60)`. **Fallback** if the trigger is refused: create the profile in `/auth/callback` via an upsert RPC; the SC-7a expectation stays the same.
   - Policies: `profiles` select `id = auth.uid() or private.shares_group(id)`, update own (`using` + `with check`); `groups` select `private.is_member(id)`, update `private.is_admin(id)` (`using` + `with check`); `group_members` select `private.is_member(group_id)`. All `TO authenticated`.
   - Grants: `select, update(display_name)` on profiles; `select, update(name)` on groups (column grant, so `invite_code`/`created_by` can't be set directly); `select` on group_members; **no** insert/delete grants; nothing to `anon`. `revoke execute … from public, anon` on every function; `grant execute` to `authenticated` on the public wrappers and on the private helpers the policies and wrappers call.
   - Apply: `supabase db reset` (local only) → `pnpm test:db` → `supabase db advisors` → fix → repeat.
2. `.env.example` (committed: names only) + `.env.local` (git-ignored: local URL + local publishable key from `supabase status`).
3. `src/server/supabase/env.ts` (reads and validates the two public vars); `server.ts` (`createServerSupabase()` with `cookies()` getAll/setAll; `setAll` wrapped in try/catch for RSC); `src/proxy.ts` + `src/server/supabase/proxy-session.ts` (`updateSession`: create the client, call `getClaims()` immediately, copy cookies + cache headers onto the response; optimistic redirect of anonymous `/groups*` → `/sign-in?next=…`). The matcher excludes `_next/static`, images and favicon.
4. `src/server/auth/current-user.ts`: `getCurrentUser()` → `{ id, email } | null` via `getClaims()`. `src/server/auth/safe-next.ts`: `safeNextPath(raw)` allows only same-origin relative paths (rejects `//evil`, `https:`, `\\`, missing leading `/`) + unit tests `src/server/auth/__tests__/safe-next.test.ts`.
5. Auth routes: `src/app/sign-in/page.tsx` + `src/features/auth/components/sign-in-form/` (client form, `useActionState`) + `src/features/auth/actions.ts` (`sendMagicLink`: zod email, `signInWithOtp({ email, options: { emailRedirectTo: <origin>/auth/callback?next=<safe> } })`; `signOut`). `src/app/auth/callback/route.ts`: `exchangeCodeForSession(code)` → redirect to `safeNextPath(next) ?? "/groups"`; on error → `/sign-in?error=link`.
6. Group reads `src/server/groups/`: `list-my-groups.ts`, `get-group.ts` (incl. invite code), `list-members.ts` (joins profiles for display names). All go through the user's server client, so RLS decides. Uncached.
7. Group actions `src/features/groups/actions.ts`: `createGroup` (auth → zod `{name, packSlug}` → `getPack(packSlug)` must load → `rpc('create_group')` → `redirect('/groups/<id>')`); `joinGroup` (auth → `rpc('join_group')` → redirect); `rotateInviteCode` (auth → rpc → `refresh()`). Every action re-checks the user (`getCurrentUser()`), whatever Proxy did.
8. Pages (containers, per-user reads under `<Suspense>`): `/groups` (my groups + create form with a pack picker listing the `packs/` dirs); `/groups/[groupId]` (404 if the RLS read returns nothing; forest via `buildForest(await getPack(group.pack_slug))`; members; invite link `<origin>/join/<code>` for any member; "Rotate link" for admins only); `/join/[code]` (anonymous → redirect to sign-in with `next`; signed in → a **Join** button posting to `joinGroup`. No mutation on GET, so link prefetching can't join anyone). `/` keeps the public forest and gains a header with "Sign in" / "My groups" in a `<Suspense>`. Components go under `src/features/groups/components/<name>/` (folder split).
9. `package.json`: `db:reset` script. `README` section "Local stack": `supabase start`, `.env.local`, `pnpm test:db`.

## Divergences from the plan (recorded after review note 6)

- The header went into `src/app/layout.tsx` (it shows on every page), not `page.tsx`.
- `src/server/http/request-origin.ts` was extracted so sign-in and invite links share one origin helper.
- `src/server/packs/list-packs.ts` was added for the create-group pack picker.
- `src/server/db/database.types.ts` was generated so queries are typed (strict TS: no `any`).
- `src/test/local-stack.ts`, `vitest.config.ts` (unit/db split, C-1) and `.gitignore` (`!.env.example`).
- `createServerSupabase()` awaits `connection()`: the browser check hit "blocking route: Date.now() while prerendering" (Partial Prefetching + `getClaims()` expiry check).

## Riskiest step

Step 1, the `SECURITY DEFINER` functions. If one forgets `auth.uid()`, or is reachable by `anon`, any visitor could join any group or read invite codes. Guarded by: (a) the frozen SC-6 privilege assertions on every `private.*` function plus anon RPC refusal; (b) SC-3/SC-4 negative cases (unknown code, member rotate, stale code); (c) `supabase db advisors`; (d) the fresh-context reviewer reads the SQL whole.

Second riskiest: the open redirect via `next` in `/auth/callback` and `/sign-in`. Guarded by `safeNextPath` unit tests with hostile inputs.

Server refusals behind UI predicates: the "Rotate link" button shows only for admins, but `private.rotate_invite_code` raises for non-admins (SC-4 calls it as member B directly). The "Join" button is backed by `join_group`, which validates the code server-side and is idempotent (SC-3 calls it twice). Create is refused for anonymous users at the DB (SC-6) and in the action.

## Rejected options

- Service-role client inside server actions for join/create: puts a privileged key in app code, and RLS no longer protects anything.
- RLS-only create (insert group, then insert member): not atomic, and the creator can't `SELECT` the new group back before the membership exists.
- Roles in JWT `app_metadata`: stale until token refresh, and a per-group role doesn't fit one claim.
- Joining on GET `/join/[code]`: link prefetch and crawlers would add memberships.
- Typed 6-digit OTP: needs a custom email template, which free-plan default SMTP blocks (changelog 2026-06-03).
- Declarative schemas (pg-delta, public alpha): too new for a high-risk ticket.

## Verify

- VERIFY (default receipt): `pnpm typecheck` · `pnpm lint` · `pnpm test` · `pnpm test:db` · `pnpm build` · `node scripts/check-hooks.mjs` · frozen hashes (MF-0001 + MF-0002) + tree hash.
- `supabase db reset` log, `relrowsecurity` query, `supabase db advisors`.
- Browser (local stack + Mailpit, two isolated contexts): SC-9 a–c; grep for d.
- Fresh-context `diff-reviewer` → `REVIEW.md` bound to the tree hash.

## Tasks

```json tasks
[
  { "id": "T1", "title": "migration: tables, RLS, private functions, wrappers, grants, profile trigger", "agent": "inline",
    "owns": ["supabase/migrations/**", "supabase/config.toml", "src/server/db/**", "src/test/**", "vitest.config.ts"], "depends_on": [], "closes": ["SC-1", "SC-2", "SC-3", "SC-4", "SC-5", "SC-6", "SC-7", "SC-8"],
    "done_when": ["supabase db reset", "pnpm test:db", "supabase db advisors"], "context": ["skill:supabase", "skill:supabase-postgres-best-practices"] },
  { "id": "T2", "title": "supabase clients, proxy, current user, safeNextPath + tests", "agent": "inline",
    "owns": ["src/server/supabase/**", "src/server/auth/**", "src/server/http/**", "src/proxy.ts", ".env.example", ".gitignore"], "depends_on": [], "closes": ["SC-9"],
    "done_when": ["pnpm test", "pnpm typecheck"], "context": ["skill:nextjs-data", "skill:typescript-strict"] },
  { "id": "T3", "title": "sign-in, callback, sign-out", "agent": "inline",
    "owns": ["src/app/sign-in/**", "src/app/auth/**", "src/features/auth/**"], "depends_on": ["T2"], "closes": ["SC-9"],
    "done_when": ["pnpm build"], "context": ["skill:react-client-patterns"] },
  { "id": "T4", "title": "group reads, actions, pages, header", "agent": "inline",
    "owns": ["src/server/groups/**", "src/features/groups/**", "src/app/groups/**", "src/app/join/**", "src/app/page.tsx", "src/app/layout.tsx", "src/server/packs/list-packs.ts", "src/features/site-header/**"], "depends_on": ["T1", "T2", "T3"], "closes": ["SC-9"],
    "done_when": ["pnpm build", "browser: SC-9 a-c"], "context": ["skill:react-feature-architecture", "skill:react-client-patterns", "skill:nextjs-data"] },
  { "id": "T5", "title": "verify, review, evidence", "agent": "inline",
    "owns": [".planning/tasks/MF-0002/**", ".planning/evidence/MF-0002.md", "README.md", "package.json"], "depends_on": ["T1", "T2", "T3", "T4"], "closes": ["SC-10"],
    "done_when": ["VERIFY receipt PASS", "REVIEW.md approve for the receipt's tree"], "context": [] }
]
```
