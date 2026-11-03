# MF-0004 LOOP-PLAN (iteration 1)

## Discovery

- **Origin from headers:** `src/server/http/request-origin.ts` reads `Origin` / `X-Forwarded-Host` / `Host`. It has two callers: `src/features/auth/actions.ts:27` (`emailRedirectTo`) and `src/app/(app)/groups/[groupId]/page.tsx:34` (invite URL). MF-0002 REVIEW note 2.
- **Proxy:** `src/server/supabase/proxy-session.ts:46-52` copies cookies onto the redirect but drops the headers that `setAll` put on `response` (lines 29-30). REVIEW note 1.
- **create_group:** `supabase/migrations/20261103064106_mf0002_groups.sql:99-120` checks the slug by regex only and has no cap. `public.create_group` is a SECURITY INVOKER wrapper, and `authenticated` holds EXECUTE on both. REVIEW note 4.
- **Pack registry precedent:** `private.question_keys` (MF-0003): RLS on, `revoke all … from public, anon, authenticated`, written by `scripts/sync-question-keys.mjs` over `SUPABASE_DB_URL` or the local stack. `db:reset` already runs the script. Packs on disk: `ccdv-f`, `team-onboarding-sample`.
- **rotateInviteCode:** `src/features/groups/actions.ts:67-73` returns `void` and ignores the RPC error. The invite card (`components/invite-link/`) is a server-rendered `<form action>`. REVIEW note 3.
- **Staged by another session (not this ticket):** `ActionResult` / `FormActionResult` (`src/lib/action-result.ts`), `useMutation` forms, RTL `ui` project, and `CLAUDE.md`. The `create-group-form` folder is the reference shape. This plan edits `groups/actions.ts` and `types.ts` **on top of** the staged version.
- **Config:** `supabase/config.toml:161` `site_url = "http://localhost:3000"`, `:165` allowlist has `localhost:3000/**`, `127.0.0.1:3000/**`. `package.json` `dev` = `next dev` (port 3000). README and `scripts/dev-setup.mjs:136` print 3000.
- Gates: no `gate:*` scripts in package.json. The checks are `typecheck`, `lint` (biome), `test` (unit+ui), `test:db` and `build` (UI touched).

## SC → steps

| SC | Steps | Proof |
|---|---|---|
| SC-1 | T8 (human) | hosted `db push` + `db advisors` output |
| SC-2 | T8 | browser: prod URL; preview → Vercel login |
| SC-3 | T8 (+ DNS owner, C-3) | browser + Resend log |
| SC-4 | T3 (+ hosted allowlist in T8) | frozen `mf-0004-site-origin` + hosted config read-back |
| SC-5 | T4 | frozen `mf-0004-proxy-session` |
| SC-6 | T1, T2, T5 (message) | frozen `mf-0004-create-group.db` |
| SC-7 | T7 (+ dry run in T8) | runbook + dry-run log |
| SC-8 | T3 (no new secret), T8 | grep + `vercel env ls` |
| SC-9 | T3 (ports), T5, T6 | frozen `mf-0004-rotate-invite`, `mf-0004-invite-link`, `mf-0004-site-origin` SC-9 |

## Steps

1. **T1 migration** `supabase/migrations/<ts>_mf0004_create_group_guards.sql`:
   - `create table private.packs (slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'), updated_at timestamptz not null default now())`; RLS on; `revoke all … from public, anon, authenticated`. There are no grants: only the definer function reads it.
   - `create or replace function private.create_group` (this keeps its ACL). After the auth check: `perform pg_advisory_xact_lock(hashtextextended('create_group:' || v_uid::text, 0))`; an unknown slug → `raise … using errcode = '22023'` ("unknown learning pack"); `count(*) from public.groups where created_by = v_uid >= 10` → `errcode = '54000'` ("group limit reached").
   - Apply to the local stack (`supabase migration up`), `pnpm db:sync-keys`, `pnpm db:types` (expect no diff: private schema).
2. **T2 sync script:** `scripts/sync-question-keys.mjs` upserts one `private.packs` row per `packs/<dir>` and deletes rows whose folder is gone, in the same run, **before** keys. The header documents the hosted usage (`SUPABASE_DB_URL` inline from the password manager).
3. **T3 site origin:**
   - `src/server/http/site-origin.ts`: `SITE_URL` must parse as a URL whose `origin + "/"` equals its normalised href (no path, query or hash) and use http(s), or it throws a message naming `SITE_URL`. If unset or empty: production throws, otherwise `http://localhost:3001`.
   - Delete `request-origin.ts` and switch both callers to `siteOrigin()`.
   - Add a `SITE_URL=` line with a comment to `.env.example`. `dev-setup.mjs` writes `.env.local`: add `SITE_URL=http://localhost:3001` there only if the script already writes a keyed template (check while building; otherwise rely on the dev default).
   - `config.toml`: `site_url = "http://localhost:3001"`, allowlist `["http://localhost:3001/auth/callback**", "http://127.0.0.1:3001/auth/callback**"]`.
   - `package.json` `dev`: `next dev -p 3001`. README and dev-setup text: 3000 → 3001.
4. **T4 proxy:** in the redirect branch, copy `response.headers` entries that `setAll` set (cache headers) onto `redirect`. Track them in a local `Record<string,string>` captured in `setAll`, so request-pass-through headers are not blindly copied.
5. **T5 actions:**
   - `rotateInviteCode(groupId: unknown): Promise<ActionResult>`: auth guard, then `z.uuid()` parse → `{ok:false,error:"This group link is not valid."}`; RPC error → `{ok:false,error:"Only the group admin can reset the link."}` for `42501`, otherwise "Could not reset the link. Try again."; success → `refresh()` and `{ok:true}`.
   - `createGroup`: RPC `22023` → packSlug field error; `54000` → "You can create up to 10 groups."
   - `RotateInviteResult = ActionResult` in `types.ts`.
   - Inner unit test `src/features/groups/__tests__/create-group-errors.test.ts` for the errcode mapping. The mapping lives in `src/features/groups/utils/rpc-errors.ts` (pure) so it can be tested.
6. **T6 invite card** (folder split per react-client-patterns):
   - `invite-link.tsx` becomes a `"use client"` view (no hooks).
   - `hooks/use-invite-link.ts` owns `useMutation({ mutationFn: rotateAction })` and returns `{ reset, isResetting, errorMessage }`.
   - The error renders in an `Alert` (`role="alert"`). Install it with `pnpm dlx shadcn@latest add alert` if missing. The button is disabled while pending.
   - `types.ts`: `rotateAction: () => Promise<RotateInviteResult>`. The page keeps passing `rotateInviteCode.bind(null, group.id)`, and a bound Server Action may cross the boundary.
7. **T7 runbook** `docs/runbook/deploy.md`:
   - One-time setup: Supabase project in Frankfurt; Resend via the Supabase integration with the sending subdomain; Auth URL config (site URL = prod origin, allowlist = `<prod>/auth/callback**` + `http://localhost:3001/auth/callback**`); email rate limit raised for the cohort; Vercel project with 3 env vars (Production + Preview) and Vercel Authentication on previews.
   - Post-merge: `supabase link`, `supabase db push`, `SUPABASE_DB_URL=$(<password manager>) pnpm db:sync-keys`, `supabase db advisors --linked`, promote/verify.
   - Rollback notes.
8. **T8 hosted (human-gated):** the user creates or authorizes each account step. I run read-only checks and the commands they approve, and record the output in evidence.

## Riskiest step

T1. `create or replace` on a SECURITY DEFINER function that holds grants, plus a new table in a schema that `authenticated` has USAGE on. If the revoke is missed, `authenticated` could read the registry (harmless) or, worse, inherit default `Dxtm` privileges. Checks: re-run MF-0002's SC-6 privilege query, `supabase db advisors --local`, and the full `test:db`, including MF-0002's own `create_group('ccdv-f')`, which now needs the registry, so `db:reset` and `db:sync-keys` must have run first.

## Rejected options

- **Validate the slug in the action only** (`listPacks`, today). The RPC can be called directly with a user token, so the DB has to refuse it (REVIEW note 4).
- **FK `groups.pack_slug → private.packs`.** Deleting a pack folder would then break `sync` for packs that have groups. A check inside the function is enough for creation.
- **Trigger-based cap.** It would fire for admin/maintenance inserts too, and the function is the only insert path.
- **Wildcard preview allowlist.** A foreign Vercel team can spoof it (C-5, user decision).
- **`supabase config push` for hosted auth settings.** The repo's `config.toml` is the local config, and pushing it would overwrite prod `site_url` with localhost. Hosted auth URLs are set in the dashboard per the runbook and read back as evidence.
- **Keep the invite card server-only and show the error via a search param.** It conflicts with the staged `useMutation` contract for client writes.

## Tasks

```json tasks
[
  {"id":"T1","agent":"schema-builder","owns":["supabase/migrations/*_mf0004_create_group_guards.sql","src/server/db/database.types.ts"],"depends_on":[],"closes":["SC-6"],"done_when":"migration applied locally; mf-0004-create-group.db green after db:sync-keys; mf-0002 db tests still green; db advisors --local clean","context":"LOOP-PLAN step 1"},
  {"id":"T2","agent":"service-builder","owns":["scripts/sync-question-keys.mjs"],"depends_on":["T1"],"closes":["SC-6","SC-7"],"done_when":"pnpm db:sync-keys prints pack registry rows; private.packs = folders under packs/","context":"step 2"},
  {"id":"T3","agent":"service-builder","owns":["src/server/http/**","src/features/auth/actions.ts","src/app/(app)/groups/[groupId]/page.tsx",".env.example","supabase/config.toml","package.json","scripts/dev-setup.mjs","README.md"],"depends_on":[],"closes":["SC-4","SC-8","SC-9"],"done_when":"mf-0004-site-origin green","context":"step 3"},
  {"id":"T4","agent":"service-builder","owns":["src/server/supabase/proxy-session.ts"],"depends_on":[],"closes":["SC-5"],"done_when":"mf-0004-proxy-session green","context":"step 4"},
  {"id":"T5","agent":"service-builder","owns":["src/features/groups/actions.ts","src/features/groups/types.ts","src/features/groups/utils/rpc-errors.ts","src/features/groups/__tests__/create-group-errors.test.ts"],"depends_on":["T1"],"closes":["SC-9","SC-6"],"done_when":"mf-0004-rotate-invite green; inner errcode test green","context":"step 5"},
  {"id":"T6","agent":"ui-builder","owns":["src/features/groups/components/invite-link/**","src/components/ui/alert.tsx"],"depends_on":["T5"],"closes":["SC-9"],"done_when":"mf-0004-invite-link green; pnpm build green; browser: non-admin error visible","context":"step 6"},
  {"id":"T7","agent":"service-builder","owns":["docs/runbook/deploy.md"],"depends_on":["T1","T2","T3"],"closes":["SC-7"],"done_when":"runbook lists one-time setup + post-merge steps with exact commands","context":"step 7"},
  {"id":"T8","agent":"human","owns":[],"depends_on":["T7"],"closes":["SC-1","SC-2","SC-3","SC-8"],"done_when":"hosted outputs pasted into evidence","context":"step 8; C-3 DNS owner for SC-3"}
]
```
