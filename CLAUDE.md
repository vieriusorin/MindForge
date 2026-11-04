# MindForge

Pack-agnostic, game-based group learning: learners grow a forest by remembering what they
study. First pack: the Claude Certified Developer – Foundations exam. Product spec:
`docs/MINDFORGE.md`. Domain terms: `CONTEXT.md` (it wins over code and tickets on naming).

@AGENTS.md

## Stack

Next.js 16 (App Router, **`cacheComponents: true`**) · React 19 · TypeScript strict · Tailwind 4
· shadcn/ui (`radix-nova`) · Supabase (Postgres + Auth + RLS) · zod 4 · **TanStack Query 5** ·
**nuqs 2** · **react-hook-form 7 + @hookform/resolvers** · **React Flow 12 + dagre** (diagrams,
ADR 0003) · Vitest · Biome · pnpm.

Next 16 differs from what you remember: read `node_modules/next/dist/docs/` before using an API.

## Commands

| Command | Use |
|---|---|
| `pnpm dev` | dev server. MindForge runs on **port 3001** locally (3000 is another project) |
| `pnpm dev:setup` | local Supabase stack + migrations + answer keys + `.env.local` |
| `pnpm typecheck` · `pnpm lint` · `pnpm test` | the fast gate (the Stop hook runs it on changed files) |
| `pnpm build` | required before hand-off for UI work: it catches missing `<Suspense>` that dev hides |
| `pnpm test:db` | RLS/DB tests against the **local** stack |
| `pnpm db:reset` · `pnpm db:types` | wipe + reseed local DB · regenerate DB types |

## Where things live

```
src/app/**                 routes. page.tsx = Server Component container (auth, reads, Suspense)
src/app/api/**/route.ts    GET Route Handlers: TanStack client reads, auth callback, exports
src/features/<f>/
  actions.ts               "use server" writes: auth → zod re-parse → DB → ActionResult
  schemas.ts               zod schemas shared by forms and actions
  search-params.ts         nuqs parsers + loader + serializer (imports from "nuqs/server")
  queries.ts               TanStack cache contract: key + queryOptions (+ server tag)
  types.ts                 feature types (result aliases, shared props)
  components/<name>/       one folder per component (see react-client-patterns rule)
src/server/**              server-only reads, auth, Supabase clients ("server-only")
src/engine/**              pure domain logic (forest, memory, packs, questions). No React/DB
src/lib/**                 cross-feature helpers: action-result.ts, query-client.ts, utils
src/components/ui/**       shadcn-owned; add with `pnpm dlx shadcn@latest add <name>`
```

## Client vs server: one tool per kind of state

| State | Tool |
|---|---|
| Needed for first render | RSC read from `src/server/**`, passed as props |
| Client must refetch without navigating | TanStack Query (`queries.ts` + GET Route Handler) |
| Any write from a client component | `useMutation` wrapping a Server Action |
| Survives reload / back / shared link (filters, tabs, page, search) | nuqs |
| Form input | react-hook-form + `zodResolver` + shadcn `Field` |
| Ephemeral UI | `useState` inside the component's hook |

No other state or data library (Redux, Zustand, SWR, Formik, the shadcn `Form` wrapper)
without an ADR in `docs/adr/`. Full contract: `.claude/rules/state-and-data.md`.

**Reference implementation** (copy its shape for any new form/mutation):
`src/features/groups/components/create-group-form/` + `src/features/groups/{schemas,actions,types}.ts`.

## Rules (normative, `.claude/rules/`)

| File | Covers |
|---|---|
| `state-and-data.md` | the table above: RSC vs client, TanStack, mutations, nuqs, forms |
| `react-client-patterns.md` | component folder layout, no behaviour in views, hook return limits |
| `ui-design.md` | shadcn-only, tokens-only theme, layout patterns, a11y |
| `no-commit.md` | never commit/push/open PRs; hand off a file list + commit message |

## Skills: load before writing the matching code

| Writing… | Skill |
|---|---|
| a page, a `"use client"` file, or deciding where state lives | `server-client-components` |
| `useQuery` / `useMutation` / `queries.ts` / an `api/` read route | `client-data-tanstack-query` |
| a form, form hook, `schemas.ts`, form-backing action | `forms-rhf-zod` + `ui-shadcn` |
| filters, tabs, pagination, search in the URL | `nuqs-typescript-zod` |
| `page.tsx` / `layout.tsx` / `actions.ts` / caching | `nextjs-data` |
| component split, hooks, `types.ts` / `utils.ts` | `react-client-patterns`, `react-component-split` |
| feature boundaries, service reads | `react-feature-architecture` |
| types, `ActionResult`, hook signatures | `typescript-strict` |
| Route Handler shape, status codes, envelope | `api-design` |
| tests | `testing-strategy`, `tdd` |
| a migration, RLS, SQL | `supabase`, `supabase-postgres-best-practices` |
| a ticket end to end | `gsd-goal-loop`, `ticket-traceability` |

Project skills win over generic library skills (e.g. `tanstack-query`): use those only for
library mechanics.

## Non-negotiables

- Server Actions: authorize first, re-parse `input: unknown` with the shared schema, return
  `ActionResult` (discriminate on `ok`). Validation is never client-only.
- Never `use cache` per-user data (memory, attempts, groups). Per-user reads go under `<Suspense>`.
- Displayed figures come from `src/engine/**` (e.g. `summarizeForest`), never component arithmetic.
- Migrations: RLS on, `revoke all` before grants, `SECURITY DEFINER` only in `private` (README).
- Run and verify on the **local** stack before anything hosted.
- Work is ticketed (`MF-####`) via `/gsd-goal-loop`; records in `.planning/`.
- **Never `git commit` / `push` / `gh pr create`.** End with changed files + a suggested message.
