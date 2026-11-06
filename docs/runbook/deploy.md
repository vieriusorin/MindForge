# Deploy runbook (MF-0004)

The platform owner runs this. Nothing here runs in CI, and an agent never runs it unattended.
There is one hosted Supabase project (`mindforge-prod`, Frankfurt) and one Vercel project.
Previews share the database and sit behind Vercel Authentication. Staging and Supabase branching
come after Dec 7 (ROADMAP Q12).

**Secrets rule:** the hosted DB connection string lives in your password manager and is passed
inline per command. It is never written to a file, the repo, or Vercel. The examples below use
1Password (`op read`). Swap in your own manager's CLI.

```sh
# shell helper used below: prints the hosted connection string, percent-encoded
DB_URL() { op read "op://<vault>/mindforge-prod/db-url"; }
```

---

## A. One-time setup

### A1. Supabase project
1. Create the project `mindforge-prod`, region **Central EU (Frankfurt)**, in the dashboard. Save the
   DB password straight into the password manager, with the session-pooler connection string as `db-url`.
2. Link the repo: `pnpm exec supabase link --project-ref <ref>`.
3. Apply the schema, then fill the pack registry and answer keys (see B2 and B3).

### A2. Email (Resend, via Supabase's integration)
1. In Resend, add the sending domain `mail.<company domain>` and give the DNS owner the records it
   lists (SPF, DKIM, and MX for bounces). Wait until it shows **Verified**.
2. Supabase dashboard → Integrations → **Resend** → connect. This configures Auth → SMTP. Check:
   sender `MindForge <login@mail.<company domain>>`.
   The Resend key lives only in Supabase. It never goes in Vercel env or the repo (SC-8).
3. Auth → Rate limits → *emails sent per hour*: raise it from the custom-SMTP default to **100**
   before a cohort sign-in day.

### A3. Auth URLs: exact origins only
Auth → URL Configuration:
- **Site URL:** `https://<prod-origin>` (e.g. `https://mindforge.vercel.app`)
- **Redirect URLs** (nothing else, and no host wildcards):
  - `https://<prod-origin>/auth/callback**`
  - `http://localhost:3001/auth/callback**` (local dev against hosted, only when needed; remove it afterwards)

Previews do **not** get an entry. A link requested from a preview lands on production
(decision C-5: a `*-<team>.vercel.app` wildcard can be matched by another Vercel team).

### A4. Vercel project
1. Import the GitHub repo. Framework: Next.js. Production branch: `main`.
2. Environment variables, for **Production and Preview**, and only these four (SC-8, amended by ADR 0004):
   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | the project's publishable key (`sb_publishable_…`) |
   | `SITE_URL` | `https://<prod-origin>`, a bare origin with no path. If it's missing or malformed, sending a magic link and opening a group page throw (fail closed). |
   | `SUPABASE_SECRET_KEY` | the project's **secret** key (`sb_secret_…`), Sensitive, server-only (ADR 0004). Without it every group page throws. Never a `NEXT_PUBLIC_` name. |
3. Settings → Deployment Protection → **Vercel Authentication: Standard Protection** (previews).
4. Never add any other secret key (service-role JWT, a second `sb_secret_…`), `ANTHROPIC_*` or `RESEND_*`. Check with
   `vercel env ls`.

---

## B. After every merge to `main`

Run in order from an up-to-date `main` checkout. Vercel deploys `main` to production by itself.
Steps B1–B3 make the database match the code, so do them right after the merge.

| # | Step | Command |
|---|---|---|
| B1 | Preview the migrations | `pnpm exec supabase db push --linked --dry-run` |
| B2 | Apply the migrations | `pnpm exec supabase db push --linked` |
| B3 | Sync the pack and path registries + answer keys | `SUPABASE_DB_URL="$(DB_URL)" pnpm db:sync-keys` |
| B4 | Security advisors at WARN and above (must say "No issues found") | `pnpm exec supabase db advisors --linked --type security --level warn --fail-on warn` |
| B5 | Check the deployment | Vercel dashboard: the latest `main` deployment is **Ready** and aliased to production |
| B6 | Smoke test | open `https://<prod-origin>`, sign in by magic link, open a group, copy the invite link (must start with `SITE_URL`) |

Notes:
- B3 must follow B2: `create_group` refuses every pack until `private.packs` is filled, and
  the Duel grades only questions whose keys are synced.
- Changes to `packs/**/questions/**` or `paths/**` need B3 even when there is no migration
  (`create_path_group`, `join_group` and `advance_group_course` read the path registry, MF-0059).
- B4 ignores INFO on purpose. Without `--level warn` it lists `rls_enabled_no_policy` for `private.packs` and
  `private.question_keys`. Those are deliberate deny-all tables (RLS on, no grants, read only by definer functions).
  Any WARN/ERROR on a MindForge object means: open a ticket, don't hot-fix in the dashboard.
- B3 refuses to run against a remote DB unless the checkout is `main` with no local changes under `packs/` or `paths/`,
  because it unregisters every pack whose folder is missing. A stale branch would disable group creation for that pack.

## C. Rollback

- **App:** Vercel → Deployments → the previous production deployment → *Promote to Production*
  (instant rollback).
- **Schema:** migrations are forward-only. Write a new migration that reverts the change, merge it,
  then run B. Never edit an applied migration, and never change hosted schema by hand.
- **Answer keys:** check out the previous commit of `packs/` and re-run B3.

## E. Release gate run (MF-0020)

The gate: a colleague who has never seen the app joins from an invite on the hosted URL, plants 3 seeds,
wins a Scenario Duel, and sees their trees grow. You run all of it. It writes to the production DB only
through the app.

### E0. Before you start
- [ ] §A done once, §B done for the current `main`, and B4 says "No issues found".
- [ ] The latest `main` CI run is **success**. Don't run the gate on a red `main`.
- [ ] The gate pack has a nature card for each of the 3 skills you'll point the colleague at
      (`ls packs/<pack>/cards`). A skill without a card still plants, but then the gate doesn't show a card.
- [ ] The colleague has no account yet (they're new to the app), and they've agreed to have their run recorded.
- [ ] `psql` is on your PATH for E2. Without it, use `docker run --rm -i postgres:17 psql` in place of `psql`.

### E1. Run
1. Sign in as yourself on `https://<prod-origin>`, create a group on the gate pack, and copy the invite link.
   It must start with `SITE_URL`.
2. Send the link to the colleague. Don't give them any other instructions. The point is that a newcomer finds the way alone.
3. The colleague opens the link, signs in by magic link, and lands in the group.
   **Capture:** the group page with their avatar (S1), and their empty dashboard forest (S2).
4. The colleague plants 3 seeds, one per skill, on `/play/<pack>/plant/<skill>`.
   **Capture:** each plant screen with the card showing (S3–S5).
5. The colleague plays one Scenario Duel (`/play/<pack>/duel`) to the end screen.
   **Capture:** "Duel finished: X / N correct" (S6). It counts as a win when X ≥ ⌈N/2⌉ (MF-0020 C-3).
6. The colleague opens the dashboard. **Capture:** the forest with the planted skills beyond "Not yet" (S7).

### E2. Read back (read-only, counts only)
Run this as yourself, with the colleague's email passed as a variable. It prints no email and no uuid, so
the output can go into the evidence as-is.

```sh
psql "$(DB_URL)" -v email="<colleague email>" -v pack="ccdv-f" -X -A -F ' | ' -f - <<'SQL'
begin read only;
with u as (select id from auth.users where lower(email) = lower(:'email'))
select
  (select count(*) from u)                                              as user_found,
  exists (select 1 from public.group_members gm join u on gm.user_id = u.id)
                                                                        as is_member,
  (select count(*) from public.attempts a join u on a.user_id = u.id
     where a.pack_slug = :'pack')                                       as attempts,
  (select count(*) filter (where a.correct) from public.attempts a join u on a.user_id = u.id
     where a.pack_slug = :'pack')                                       as correct,
  (select count(distinct a.skill_code) from public.attempts a join u on a.user_id = u.id
     where a.pack_slug = :'pack')                                       as distinct_skills_attempted;
rollback;
SQL
```

Expected: `user_found = 1`, `is_member = t`, `distinct_skills_attempted ≥ 3`, and `attempts` covers the
3 plant checks plus the Duel.

### E3. Record
- Add a §D row: date, who ran it, "E1–E2", and the result.
- Put S1–S7 and the E2 output in `.planning/evidence/MF-0020.md`. Call the colleague "colleague A", never by
  name or email.
- A step that fails is a **new ticket** (evidence, the step, what was expected). Don't hot-fix it on production.

## D. Dry-run log

Record each first-time or unusual run here: date, who, steps, output summary.

| Date | Who | Steps | Result |
|---|---|---|---|
| 2026-11-03 | agent (local stack only) | B1–B4 against the **local** stack (`--local`) | up to date; registry + 53 keys synced; advisors (warn) No issues found. See `.planning/evidence/MF-0004.md` |
