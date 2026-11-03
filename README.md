# MindForge

Learn by playing, remember through nature: a pack-agnostic, game-based group learning app.
The first pack is the Claude Certified Developer – Foundations exam. The product spec is in [`docs/MINDFORGE.md`](docs/MINDFORGE.md).

## Stack

Next.js 16 (App Router, Cache Components) · Tailwind · Supabase (Postgres + Auth + RLS) · Vitest · Biome · pnpm.

## Prerequisites

You install only two things yourself:

- **Node.js 24+** (`node -v`). pnpm comes through Corepack: run `corepack enable`. On Node versions that no longer bundle Corepack, run `npm i -g corepack` first.
- **Docker**, installed **and running**: [Docker Desktop](https://docs.docker.com/get-docker/), OrbStack or Colima. The local Supabase stack runs in containers.

Everything else comes from the repo. The **Supabase CLI** is a pinned dev dependency (no global install), and Postgres, Auth, Studio and **Mailpit** run inside the local stack.

## Quick start

```bash
corepack enable        # once: provides the pnpm version pinned in package.json
pnpm install           # app deps + the pinned Supabase CLI
pnpm dev:setup         # starts the local stack, applies migrations, syncs answer keys, writes .env.local
pnpm dev               # http://localhost:3001
```

The first `pnpm dev:setup` downloads the Supabase images, which takes a few minutes. It's safe to re-run at any time: it applies only **pending** migrations and never deletes your local data. (It's `dev:setup`, not `setup`, because `pnpm setup` is a pnpm built-in.)

| Local service | URL |
|---|---|
| App | http://localhost:3001 |
| Mailpit: sign-in links land here | http://127.0.0.1:54324 |
| Supabase Studio: browse the local DB | http://127.0.0.1:54323 |

Sign in with any email, then open its magic link in Mailpit. To start from a clean database, run `pnpm db:reset` (it **wipes** local data). Run `pnpm exec supabase stop` to stop the stack.

## Checks

| Command | What it runs |
|---|---|
| `pnpm typecheck` | `next typegen` + `tsc --noEmit` |
| `pnpm lint` | Biome |
| `pnpm test` | unit tests (no database needed) |
| `pnpm test:db` | RLS / database acceptance tests against the **local** stack (`pnpm dev:setup` first) |
| `pnpm build` | production build |
| `node scripts/check-hooks.mjs` | the Claude Code hooks in `.claude/` load and run |
| `pnpm db:types` | regenerate `src/server/db/database.types.ts` from the local schema |
| `pnpm db:sync-keys` | copy answer keys from `packs/*/questions/*.yaml` into the DB (the DB grades answers against them); run after editing questions |

## How work is done

Every change is a ticket (`MF-####`) taken through Plan → Design → Build → Test → Hand-off with the
`/gsd-goal-loop` skill. Records live in `.planning/tasks/<ID>/` and `.planning/evidence/<ID>.md`.

## Writing a migration

`supabase migration new <name>`, then in the SQL:

- enable RLS on every new table and write policies scoped by ownership or membership;
- `revoke all on <table> from anon, authenticated` **before** granting exactly what is needed. Otherwise new tables can give these roles `TRUNCATE`, which bypasses RLS;
- `SECURITY DEFINER` functions only in the `private` schema, with `set search_path = ''`, an `auth.uid()` check, and `EXECUTE` revoked from `public, anon`.

Then `pnpm db:reset && pnpm test:db && supabase db advisors --local`.

## Writing questions

One file per skill: `packs/<slug>/questions/<skill-code>.yaml` (format in `.planning/tasks/MF-0003/GOAL.md`).
Every option needs a rationale and every question an official `source.url`. Drafts are `status: unreviewed`
until reviewed. After editing: `pnpm test` (validates all files) and `pnpm db:sync-keys`.
