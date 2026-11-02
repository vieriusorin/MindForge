# Verification — the proof ladder

The playbook's rule: *always give Claude a way to verify its own work, and make verification part
of "done".* In this repo the feedback loop exists; what fails is reading it wrong. Every trap
below has produced a false green here at least once.

Climb from the bottom. A rung that fails stops the climb — fix, then restart from that rung.

## 0. What the harness already does for you (PT-0315)

Three Claude Code hooks in `.claude/settings.json` turn part of this ladder into something that
runs whether or not the agent remembers it:

| Hook | Does | Cost |
|---|---|---|
| `track-changes.mjs` (Pre/Post tool) | records the files THIS session changed — Edit/Write paths, plus a `git status` diff around every Bash call (sessions share the worktree) | ~80 ms per Bash |
| `guard-protected.mjs` (PreToolUse) | Edit/Write to a frozen acceptance test, a `FROZEN.json`, a gate script, CI, lint/test/tsc config or the hooks → **asks the user** | ~30 ms |
| `stop-gate.mjs` (Stop) | when this session changed source since the last green: typecheck · every `gate:*` except client-bundle · biome + eslint on the changed files · tests (co-located tier; FULL related set at `stage: test`+) · frozen-hash integrity. Red blocks the turn twice, then releases with a RED banner to the user | 4–10 s cheap tier, minutes for the full related set of a central file |

The banner is evidence; a release is not a pass. The gate does NOT replace rungs 2, 6, 7, 8 below:
it never runs the full suite, a browser, `next build`, or `gate:client-bundle`. `P4T_STOP_GATE=off`
disables it for one session — say so in the evidence if you used it.

## 1. Oracle tests for the decision

For a ticket in the loop the SC-level oracles were already written and frozen RED in Stage 2b
(`pnpm ticket:freeze`); this rung is the inner unit tests that build up to them.

Pure logic lives in `utils.ts` / `src/lib` / `server/services/**/compute` and is tested in a
co-located `__tests__/`. Write the **expected value from the requirement**, not from running the
code: `expect(total).toBe(1234_00)`, never `expect(total).toBe(compute(x))`. One case per branch
of the decision, plus the empty case and the boundary (month end, DST day, 0, null).

```bash
pnpm test src/server/services/cost-engine/__tests__/x.test.ts
```

There is no React Testing Library, jsdom or `renderHook` — logic left inside a `.tsx` cannot be
tested. That is why the component split exists (`p4t-react-client-patterns`).

## 2. DB-backed tests on the test stack

A service read or write is proven against Postgres, with RLS on, as the role that will run it.

- **Only through `pnpm test <paths>`.** Bare `pnpm vitest run` loads `.env.local`, the
  production clone.
- Schema change: `pnpm db:test:migrate` first. A migration that dies silently there is usually
  a journal lagging the schema — backfill, never reset the shared stack.
- Read the row back. A new nullable column passes typecheck, every gate and the suite while
  never reaching the INSERT.
- Fixtures: `pontaj` inserts need a transaction-local `app.audit_reason`; `employees` writes in
  scripts need the provisioning GUC; `set_config(…, true)` only — a session GUC sticks to the
  pooled backend.
- RLS / authz: SQL-level suites live in `src/server/db/__tests__` and need plain `pnpm test`;
  `pnpm test:authz` does not run them.

## 3. Types

```bash
pnpm typecheck        # next typegen + four tsc layers; ~0.5 s warm
```

An upward import (`src/lib|server|i18n|types` → `@/modules|@/app`) fails as TS6307 — move the
code down, do not re-route the import.

## 4. Every gate, enumerated — never from memory

```bash
node -e "for (const k of Object.keys(require('./package.json').scripts)) if (k.startsWith('gate:')) console.log(k)" \
  | xargs -I{} sh -c 'printf "%-22s " {}; pnpm {} >/dev/null 2>&1 && echo PASS || echo FAIL'
```

Re-run a FAIL bare to read it. A gate failing on a file you did not touch is still reported, as
pre-existing, with the file named. `gate:rsc-boundary` and `gate:i18n` are the only things
before `next build` that catch the two traps that pass everything else.

## 5. Lint

```bash
pnpm lint:all
```

Run checkers bare. Biome's diagnostic limit and your own `| tail` both hide violations.

## 6. Full suite, to a log

```bash
# LOG = a file in the session scratchpad, never the repo
pnpm test > "$LOG" 2>&1; echo "exit $?"; grep -E "FAIL|Test Files|Tests " "$LOG"
```

Never pipe a suite to `tail` — you get tail's exit 0 and lose the failing names. Other sessions
leave failures in the shared tree: for each failure, show it is outside this diff (the file is
not in your change set, and it fails the same way without your change) or treat it as yours.
`pontaj` cutoff tests fail by calendar; `transfer-resolve-race` contends under load.

## 7. The screen — required for anything a user sees

A green suite is not validation. Look at the screen, as the role the SC names, on the **test
stack** (:3100, `.env.test.local`), from a copy of the tree (`rsync` + `cp -Rc node_modules`
into the scratchpad) because :3000 is the user's dev server and holds Next's directory lock.

- Browse via `localhost`, not `127.0.0.1` (dev blocks it as an origin; forms then fall back to
  GET and look unhydrated).
- Reuse a `storageState`; ~11 fresh logins trip the sign-in limiter.
- If the DevTools MCP browser is locked by another session, script Playwright with
  `channel: "chrome"` from the scratchpad copy.
- New page redirects to /dashboard? It is missing from `route-access.ts` — fails closed.
- Record what was seen in words in the evidence file; a screenshot goes under
  `.planning/evidence/screenshots/` if one helps.

## 8. Production-only traps

`next build` / `next start` are not in the gate. Run `pnpm build:local` when the change touches
`"use cache"`, a locale reader, a new `"use client"` import chain, or `next.config`. Never bare
`pnpm build` / `pnpm start` locally — they read `.env.production.local` first.

## 9. Fresh-context review — high-risk always, normal when the diff is large

The agent that wrote the code does not approve it. Launch a subagent (or `/code-review`) with
only: GOAL.md, LOOP-PLAN.md, and the diff paths. Ask it to check the diff against each SC and
Constraint, and for the three passes the playbook names — **bugs**, **security** (authz, RLS,
PII and `tarif_orar` in DTOs, service-role use), **compliance** (plan, CLAUDE.md invariants:
calculation parity, temporal tables, integer bani, one zone). Its findings go in the evidence
file with their disposition. Domain-specific reviewers: `asset-custody-auditor` for tools and
transfers, `accessibility-auditor` for a new interactive surface.

## What counts as evidence

| Counts | Does not |
|---|---|
| `17/17` with the test file named | "tests pass" |
| the gate table above, pasted | "gates green" |
| "the dialog lists *Adeziv C2TE · 10 m · fără preț*" | "UI works" |
| "not verified: the e-mail send" | silence about it |
