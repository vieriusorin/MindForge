# MF-0004 LOOP-VERIFY

## RED at freeze (2026-11-03)

TYPECHECK green with the tests in place (`pnpm typecheck` exit 0). Each test fails for its SC's own reason:

| File | SC | First failure |
|---|---|---|
| mf-0004-site-origin.acceptance.test.ts | SC-4 | `expected 'https://evil.example' to be 'https://mindforge.vercel.app'` |
| 〃 | SC-4 | `Error: not implemented` (typed stub `src/server/http/site-origin.ts`) |
| 〃 | SC-4 | header scan offenders: `src/app/(app)/groups/[groupId]/page.tsx`, `src/features/auth/actions.ts`, `src/server/http/request-origin.ts` |
| 〃 | SC-4 | `expected [ 'http://localhost:3001', …(1) ] to include 'http://localhost:3000'` |
| 〃 | SC-9 | `site_url` does not match `http://localhost:3001` |
| mf-0004-proxy-session.acceptance.test.ts | SC-5 | `expected null to be 'private, no-cache, no-store, must-revalidate, max-age=0'` (307 + location pass) |
| mf-0004-rotate-invite.acceptance.test.ts | SC-9 ×3 | `TypeError: Cannot read properties of undefined (reading 'ok')` |
| mf-0004-invite-link.acceptance.test.tsx | SC-9 | `Unable to find role="alert"` (rotateAction called once) |
| mf-0004-create-group.db.acceptance.test.ts | SC-6 ×2 | `expected null not to be null`. Run 2 identical: no fixture leftovers |

## Baseline (before any code, 2026-11-03)

`pnpm test`: 10 failed / 66 passed (all 10 = MF-0004 frozen); `pnpm test:db`: 2 failed / 12 passed (both = MF-0004 frozen); `pnpm lint`: 3 format errors in MF-0004 frozen files only → re-frozen formatter-only with user approval (FROZEN.json history). No pre-existing reds. Logs: `logs/baseline-*.log`.

## Iteration 1, local stack (stage: test)

| Check | Result | Log |
|---|---|---|
| `pnpm db:reset` (fresh migrate + sync) | exit 0; `pack registry: ccdv-f, team-onboarding-sample`; `ccdv-f: 53 key(s) synced` | logs/db-reset.log |
| `pnpm typecheck` | exit 0 | logs/typecheck.log |
| `pnpm lint` | exit 0, `Checked 196 files … No fixes applied.` | logs/lint.log |
| `pnpm test` (unit + ui) | `Test Files 27 passed (27)` / `Tests 84 passed (84)` | logs/test.log |
| `pnpm test:db` | `Test Files 5 passed (5)` / `Tests 14 passed (14)` | logs/test-db.log |
| `supabase db advisors --local --type security` | `No issues found` | logs/dryrun-local.log |
| advisors `--type all --level info` | 2 INFO `rls_enabled_no_policy` on `private.packs` and `private.question_keys`, intended deny-all (same as MF-0003) | logs/advisors.log |
| `pnpm build` (SITE_URL unset) | exit 0, `✓ Compiled successfully` | logs/build.log |

| SC | Verdict | Evidence |
|---|---|---|
| SC-1 | NOT RUN (hosted, T8) | local stand-in: advisors security `No issues found` |
| SC-2 | NOT RUN (hosted, T8) | |
| SC-3 | NOT RUN (hosted, T8; blocked on DNS owner, C-3) | |
| SC-4 | PASS (code + local config) / hosted allowlist NOT RUN | frozen `mf-0004-site-origin` 5/5 green. Live Auth: OTP with `redirect_to=https://evil.example/auth/callback` → email link `redirect_to=http://localhost:3000` (hostile host refused; fallback is the **old** site_url because the running Auth container predates the config.toml change, so it needs `supabase stop && supabase start`, not run: another session shares the stack) |
| SC-5 | PASS | frozen `mf-0004-proxy-session` green; live `curl` on :3001 `/groups` with a dead cookie → `307`, `cache-control: private, no-cache, no-store, must-revalidate, max-age=0`, `expires: 0`, `pragma: no-cache`, `set-cookie: sb-127-auth-token=; Max-Age=0` |
| SC-6 | PASS (local) | frozen `mf-0004-create-group.db` 2/2 green; MF-0002 RLS suite still green; `private.packs`: anon/authenticated select/insert/truncate = false; `private.create_group` ACL `{postgres=X/postgres,authenticated=X/postgres}` (unchanged) |
| SC-7 | PARTIAL | `docs/runbook/deploy.md` written; B1–B4 dry run against **local** (`--local`): up to date / registry synced / `No issues found` (logs/dryrun-local.log). Hosted dry run NOT RUN |
| SC-8 | PARTIAL | grep part below; Vercel env list NOT RUN (hosted) |
| SC-9 | PASS (tests) / browser NOT RUN | frozen `mf-0004-rotate-invite` 3/3 + `mf-0004-invite-link` 1/1 + `site_url`/`dev -p 3001` green; inner `rpc-errors` 5/5, `use-invite-link` 3/3. Browser check blocked: the shared chrome-devtools profile is held by another session |

SC-8 grep: `grep -rn "SERVICE_ROLE\|sb_secret\|ANTHROPIC\|RESEND" src | grep -v "^src/test/"` → no output (exit 1).

## Live check over HTTP (2026-11-03, after hand-off; no code change)

The browser is still unavailable (the chrome-devtools profile is held by another session). Instead: a throwaway user (admin API) signed in with a password, the @supabase/ssr cookie (`sb-127-auth-token=base64-…`) built from the real session, and a real group created by RPC. Then `GET http://localhost:3001/groups/<id>` against the running dev server with `X-Forwarded-Host: evil.example`, `Origin: https://evil.example`, `X-Forwarded-Proto: https`. Script: scratchpad `live-invite.mjs`; the user was deleted afterwards.

```
status 200
invite urls: [ 'http://localhost:3001/join/989fed27ad2b432f9fbfb04ab2f04985' ]
evil.example in page: false
reset button present: true
unknown pack errcode: 22023
```
→ SC-4 (invite URL origin from SITE_URL / dev default, hostile headers ignored) holds on the live server. SC-6's errcode holds over PostgREST.
Still unverified: the alert rendering in a real browser (covered by RTL), and live local Auth with the new config.toml (needs a stack restart).

## Live local Auth after a stack restart (user-approved, 2026-11-03)

`supabase stop && supabase start` (data kept; logs/stack-restart.log). OTP via the Auth REST API, link read from Mailpit:
```
asked https://evil.example/auth/callback -> email redirect_to: http://localhost:3001
asked http://localhost:3001/auth/callback?next=%2Fgroups -> email redirect_to: http://localhost:3001/auth/callback?next=%2Fgroups
asked http://localhost:3000/auth/callback -> email redirect_to: http://localhost:3000/auth/callback
```
→ SC-4 local half holds live: a foreign host falls back to site_url `http://localhost:3001`. Nuance: GoTrue also accepts any redirect whose **hostname** equals site_url's (any port), which is why :3000 passes. Hosted, site_url is the production host, so this admits only the production host itself, never a foreign one.
