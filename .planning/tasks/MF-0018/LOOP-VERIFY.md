---
phase: 1-verification
ticket_id: MF-0018
status: complete
verdict: PASS
started_at: "2026-11-03"
completed_at: "2026-11-03"
resume_with: /gsd-goal-loop
---

# Verification — Iteration 1

## RED at freeze

| SC | Test | Red reason |
|----|------|-----------|
| SC-2a/b/c | `src/test/__tests__/mf-0018-env-file.acceptance.test.ts` | `Error: not implemented` (`scripts/lib/env-file.mjs` stub) |

| SC | Verdict | Evidence |
|----|---------|----------|
| SC-1 | PASS | PATH = `/usr/local/bin:<shim with pnpm only>:~/.docker/bin:/usr/bin:/bin:…` → `global supabase: NONE`; `pnpm exec supabase --version` → `2.122.0`; `node scripts/sync-question-keys.mjs` (plain node) → `ccdv-f: 53 key(s) synced`; `pnpm db:types` ok; `pnpm vitest run --project db` (harness `src/test/local-stack.ts`) → `Tests 12 passed (12)`. (The first attempt still had `/opt/homebrew/bin` on PATH via pnpm. That was caught and redone with the shim.) |
| SC-2 | PASS | frozen acceptance 3/3 |
| SC-3 | PASS | Seeded marker user + group + membership + attempt: `BEFORE {'attempts': 1, 'groups': 1, 'members': 1, 'users': 1}` → `pnpm dev:setup` exit 0 → `AFTER` identical; two earlier consecutive runs exit 0 with `.env.local … already up to date`; `diff` before/after `.env.local` empty; 0 lines matching SECRET/sb_secret/SERVICE_ROLE. Marker removed afterwards (`CLEANED` all 0). Logs: `dev-setup-run{1,2,3}.log` |
| SC-4 | PASS (not-installed branch) | Docker off PATH → `✗ Docker is not installed. … Install Docker Desktop (…), OrbStack or Colima, start it, then re-run \`pnpm dev:setup\`.` exit 1, before any stack command (`dev-setup-no-docker.log`) |
| SC-5 | PASS | README "Prerequisites" (Node 24 + Corepack note, Docker) and "Quick start" at the top; `package.json` `engines.node ">=24"` |
| SC-6 | PASS | receipt below |

## Decisions during build

- `pnpm setup` is a pnpm built-in ("Sets up pnpm"), so the script is **`pnpm dev:setup`** (the planning session flagged this; verified with `pnpm setup --help`).
- `scripts/lib/planificare-report.ts` (a P4T file copied in at 10:56 local, which broke `pnpm typecheck` repo-wide) was **removed with the user's approval**. Nothing referenced it.

## Incident: over-broad formatter

`pnpm biome check --write scripts` also reformatted four copied P4T files (`clean-room`, `test-db-lock`, `ticket-eval`, `ticket-receipts`). They're untracked, so there was no git baseline. Proof that only formatting changed: each of the 12 copied `scripts/lib` files equals P4T's current file after formatting with this repo's Biome config (`equal-after-format` 12/12). They were left formatted, because restoring the unformatted originals would make `pnpm lint` fail.

## Receipt

`2026-11-03T09:40:27Z · tree eebf9a73fd3551b3a8048e9188a98f592eebef29afd5ce4a3c0840ad64889a38 · typecheck 0 · gates 0/0 · lint 0 · test 52 · test:db 12 · build 0 · check-hooks 0 · frozen True · PASS`

## Not verified

- The "Docker installed but not running" branch (it would need stopping your Docker).
- A truly fresh machine: first-time image download, Linux/WSL, a Node release without bundled Corepack.

## Verdict: PASS

## Re-verify on resume (2026-11-03T09:43Z)

The tree had moved since the 09:40Z receipt, so the checks were re-run. Logs are in `logs/reverify-*.log`.
`pnpm exec supabase --version` → `2.122.0`; frozen acceptance sha unchanged, 3/3 passed.
`… · tree 6d0dae87… · typecheck 0 · lint 0 · test 52 passed · test:db 12 passed · build 0 · check-hooks 0 · frozen True · PASS`

## Follow-up: keys redacted in `pnpm dev:setup` output (2026-11-03)

Cause: GitHub push protection blocked `feat/MF-0001`. `dev-setup-run{1,2,3}.log` held the `supabase start` JSON with the local stack's keys. The three logs were redacted.
Fix: `scripts/lib/redact-secrets.mjs` (`redactSecrets(line)`). `dev-setup.mjs` now streams `supabase start` stdout and stderr through it.
- RED first: `src/test/__tests__/mf-0018-redact-secrets.test.ts` against a stub → `Tests 3 failed (3)`, `Error: not implemented` ×3. After the fix: `Tests 3 passed (3)`.
- `pnpm dev:setup` on the running stack: exit 0; grep for key/secret values in `logs/dev-setup-redacted.log` → `0`.
- typecheck 0 · lint 0 (`Checked 183 files`) · test `55 passed (55)`.
