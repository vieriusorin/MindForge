---
ticket_id: MF-0004
tier: high-risk                   # infra + auth wiring + a migration on create_group
stage: handoff
branch: feat/MF-0004
builds_on: []
last_iteration: 1
goal_status: complete-pending-manual-commit   # closed by user 2026-11-03: local slice done; hosted SCs carried as manual steps (docs/runbook/deploy.md)
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
  _Amended 2026-11-04 by ADR 0004 (MF-0011): one server-only `SUPABASE_SECRET_KEY` is now allowed; Vercel env holds four variables._
- No Claude API key on Vercel (ROADMAP D-2) → SC-8.
- Migrations reach the hosted project only after merge to `main`, run by the platform owner → SC-7.
- Every new or changed table/function follows `project-supabase-migration-rules` (revoke all first, `connection()` before auth reads).
- Resend is connected through Supabase's Resend integration, so the key lives only in Supabase Auth SMTP; nothing mail-related goes in Vercel env or the repo (user, 2026-11-03, replaces "install via Vercel Marketplace": see C-4) → SC-3, SC-8.

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
- [ ] SC-3: A magic link sent from production, from the verified company sending subdomain, reaches two real inboxes via Resend (Supabase integration) and signs the user in. Proof: browser + the Resend log line.
- [ ] SC-4: The `emailRedirectTo` origin and the invite URL origin come from the configured `SITE_URL`, never from `Host` / `X-Forwarded-Host` / `Origin`; an unset or non-origin `SITE_URL` fails closed in production; the Auth redirect allowlist (local `config.toml` + hosted) holds exact origins only, no host wildcards. Proof: unit test with hostile headers → configured origin; config read-back.
- [x] SC-5: When the proxy redirects a dead session to `/sign-in`, the response keeps the no-store `Cache-Control` headers set by `@supabase/ssr`. Proof: unit test on `proxy-session`.
- [x] SC-6: `create_group` refuses a well-formed but unregistered pack slug and refuses the 11th group created by one user. Proof: DB test (local stack).
- [ ] SC-7: `docs/runbook/deploy.md` lists the post-merge steps (`supabase db push`, `pnpm db:sync-keys` against hosted, promote) and one dry run is recorded. Proof: evidence.
- [ ] SC-8: `grep -rn "SERVICE_ROLE\|sb_secret\|ANTHROPIC\|RESEND" src` is empty outside `src/test/`; Vercel env lists only `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SITE_URL`. Proof: grep + env list pasted.
- [x] SC-9: `rotateInviteCode` validates `groupId` and returns an `ActionResult` error when the RPC fails, and the invite card shows it; `site_url`, the local redirect URLs and `pnpm dev` use port 3001. Proof: UI test (RTL, the staged ADR-0002 toolchain) + config read-back + browser.

## Concerns

| # | Collision | Owner | Status |
|---|-----------|-------|--------|
| C-1 | `create_group` needs a list of known pack slugs in the DB. This ticket owns it (`private.packs`, written by the sync script); MF-0007 does not depend on it. | Coder A | resolved 2026-11-03 |
| C-2 | `db:sync-keys` against hosted needs the DB password locally; keep it out of the repo and out of Vercel. | Coder A | resolved 2026-11-03 (user): the runbook passes `SUPABASE_DB_URL` inline from the password manager on each run; nothing written to disk. |
| C-3 | Resend won't send to other people's inboxes until a sending domain is verified by DNS. With only `*.vercel.app` (which has no DNS we control), SC-3's "two real inboxes" can't pass. | user / DNS owner | decided 2026-11-03 (user): send from a company subdomain (e.g. `mail.<company domain>`). **Open on the DNS owner** for the records; blocks only SC-3's proof, not Build. |
| C-4 | Installing Resend through the Vercel Marketplace puts `RESEND_API_KEY` in Vercel env, which breaks SC-8 (only three vars). The app sends no mail: Supabase Auth sends it over SMTP, so the key belongs in Supabase, not in Vercel. | user | resolved 2026-11-03 (user): use Supabase's Resend integration. |
| C-5 | Preview sign-in: a wildcard allowlist entry `mindforge-*-<team>.vercel.app` can be matched by another Vercel team whose slug ends in `-<team>`, so it isn't an exact origin (SC-4). Exact origins only means previews can't receive magic links. | user | resolved 2026-11-03 (user): no sign-in on previews. The allowlist holds the production origin + `localhost:3001` only; a link requested from a preview lands on production. |

## Coordination

- Another session has a **staged** conventions change (ActionResult, `useMutation` forms, RTL `ui` test project, new `CLAUDE.md`) that also edits `src/features/groups/actions.ts` and `types.ts`. This ticket builds on the staged version and changes only `rotateInviteCode` and createGroup's RPC-error mapping there. Both are flagged at hand-off.

## Out of Scope

- Custom domain, staging environment, Supabase branching, Google OAuth / passkeys.

## Open questions

- none.

## Iteration Log

<!-- append-only -->

- 2026-11-03 iter 1: DESIGN closed (C-2..C-5 decided by user), 5 acceptance files frozen red, LOOP-PLAN approved by user ("continue locally"): BUILD T1-T7 on the local stack only; T8 hosted deferred.
- 2026-11-03 iter 1: BUILD T1–T7 done on local; TEST: full ladder green (85 unit/ui, 14 db, typecheck, lint, build); review changes-requested → fixed → approve at 359c930e…; SC-5/6/9 closed, SC-4 code side closed, hosted SCs open (T8). Status blocked-on-user.
- 2026-11-03 close: user closed the ticket ("close the task"). Done and verified locally: SC-4 code + local config (live), SC-5, SC-6, SC-9. **Not verified, carried to the platform owner via docs/runbook/deploy.md:** SC-1, SC-2, SC-3 (needs the DNS owner), SC-8 Vercel env list, SC-4 hosted allowlist, SC-7 hosted dry run. These SCs stay unticked.
