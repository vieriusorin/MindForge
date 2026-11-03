---
ticket_id: MF-0004
tier: high-risk                   # infra + auth wiring + a migration on create_group
stage: design
branch: feat/MF-0004
builds_on: []
last_iteration: 0
goal_status: in-progress
track: P                          # seat Coder A (docs/plan/ROADMAP.md §6)
week: W1
depends_on: [Phase 0]
---

> Drafted 2026-11-03 from the planning grill (ROADMAP §2, Q12). The SCs are proposals: the claimant
> confirms them in DESIGN, then freezes the acceptance tests (gsd-goal-loop Stage 2b).

## Objective

Today MindForge runs only on a laptop: the ~30-person cohort can't use it, and the default Supabase
mailer can't send 30 magic links. Four review notes from MF-0002 are still open.

End state: the app runs on Vercel against a hosted Supabase project in the EU, magic links arrive
through Resend, the sign-in redirect can't be pointed at a foreign host, and the platform owner has
a written post-merge checklist (migrations, answer keys, promote).

## Affected

- **Roles:** every learner (sign-in, groups); platform owner (runs the checklist).
- **Surfaces:** Supabase hosted project `mindforge-prod`, Vercel project, `supabase/config.toml`, `src/proxy.ts`, `src/server/supabase/proxy-session.ts`, `src/server/http/request-origin.ts`, `src/features/auth/actions.ts`, `src/features/groups/actions.ts`, `create_group` (new migration), `docs/runbook/deploy.md` (new).

## Constraints

- No service-role or secret key in the app or in Vercel env; only URL + publishable key → SC-8.
- No Claude API key on Vercel (ROADMAP D-2) → SC-8.
- Migrations reach the hosted project only after merge to `main`, run by the platform owner → SC-7.
- Every new or changed table/function follows `project-supabase-migration-rules` (revoke all first, `connection()` before auth reads).
- Email provider is installed through the Vercel Marketplace (keys provisioned, not pasted).

## Decided without a question

- One hosted Supabase project, Frankfurt region; previews share it, behind Vercel Authentication. Staging / Supabase branching after Dec 7 (ROADMAP Q12).
- Resend for SMTP; default `*.vercel.app` domain until a company subdomain exists (user, 2026-11-03).
- Group cap: 10 groups created per user (enough for study groups + a cohort group; stops spam).
- Site origin = a server-only `SITE_URL` env var (no `NEXT_PUBLIC_`); when it's unset, dev falls back to `http://localhost:3001` and production throws (fail closed). It also replaces header-derived origins for invite URLs (src/app/(app)/groups/[groupId]/page.tsx:34), so `requestOrigin()` is deleted. Source: SC-4 + MF-0002 REVIEW note 2.
- The group cap is race-safe: a per-user `pg_advisory_xact_lock` inside `private.create_group`, plus distinct errcodes (unknown pack / cap reached) so the action can show the right message. Source: SC-6 + correctness.
- `pnpm dev` runs on port 3001 to match `site_url` (memory: 3000 belongs to another project).
- Local allowlist paths narrowed to `/auth/callback**` per exact origin. Source: SC-4.

## Success Criteria

- [ ] SC-1: Hosted project exists in an EU region; `supabase db push` applied every migration; `supabase db advisors` (security) on hosted reports nothing for MindForge objects. Proof: command output in evidence.
- [ ] SC-2: Production deploys from `main` on `*.vercel.app`; a preview URL returns the Vercel login to an anonymous visitor. Proof: browser.
- [ ] SC-3: A magic link sent from production reaches two real inboxes via Resend and signs the user in. Proof: browser.
- [ ] SC-4: The `emailRedirectTo` origin comes from a configured site origin, never from `Host` / `X-Forwarded-Host` / `Origin`; the Auth redirect allowlist holds exact origins only. Proof: unit test with hostile headers → configured origin.
- [ ] SC-5: When the proxy redirects a dead session to `/sign-in`, the response keeps the no-store `Cache-Control` headers set by `@supabase/ssr`. Proof: unit test on `proxy-session`.
- [ ] SC-6: `create_group` refuses a well-formed but unregistered pack slug and refuses the 11th group created by one user. Proof: DB test (local stack).
- [ ] SC-7: `docs/runbook/deploy.md` lists the post-merge steps (`supabase db push`, `pnpm db:sync-keys` against hosted, promote) and one dry run is recorded. Proof: evidence.
- [ ] SC-8: `grep -rn "SERVICE_ROLE\|sb_secret\|ANTHROPIC" src` is empty outside `src/test/`; Vercel env lists only `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and the site origin. Proof: grep + env list pasted.
- [ ] SC-9: `rotateInviteCode` returns an error result that the group page shows; `site_url` and local redirect URLs use port 3001. Proof: unit test + browser.

## Concerns

| # | Collision | Owner | Status |
|---|-----------|-------|--------|
| C-1 | `create_group` needs a list of known pack slugs in the DB. This ticket owns it (`private.packs`, written by the sync script); MF-0007 does not depend on it. | Coder A | resolved 2026-11-03 |
| C-2 | `db:sync-keys` against hosted needs the DB password locally; keep it out of the repo and out of Vercel. | Coder A | open |
| C-3 | Resend won't send to other people's inboxes until a sending domain is verified by DNS. With only `*.vercel.app` (which has no DNS we control), SC-3's "two real inboxes" can't pass. | user / DNS owner | open |
| C-4 | Installing Resend through the Vercel Marketplace puts `RESEND_API_KEY` in Vercel env, which breaks SC-8 (only three vars). The app sends no mail: Supabase Auth sends it over SMTP, so the key belongs in Supabase, not in Vercel. | user | open |
| C-5 | Preview sign-in: a wildcard allowlist entry `mindforge-*-<team>.vercel.app` can be matched by another Vercel team whose slug ends in `-<team>`, so it isn't an exact origin (SC-4). Exact origins only means previews can't receive magic links. | user | open |

## Out of Scope

- Custom domain, staging environment, Supabase branching, Google OAuth / passkeys.

## Open questions

- none.

## Iteration Log

<!-- append-only -->
