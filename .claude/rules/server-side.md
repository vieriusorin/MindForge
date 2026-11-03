---
paths:
  - "src/server/**"
  - "src/engine/**"
  - "src/app/**"
  - "src/features/**/actions.ts"
  - "supabase/**"
---

# Server Side

**Normative from 2026-11-03.** Pages, layouts, Route Handlers, Server Actions, server reads and
the domain engine. The state-tool table and the mutation contract live in `state-and-data.md`;
this file covers the layers underneath. How-to: `nextjs-data`, `react-feature-architecture`,
`api-design`, `supabase`, `supabase-postgres-best-practices`.

## 1. Layers, one job each

| Layer | Path | Does | Never |
|---|---|---|---|
| Page / layout | `src/app/**/page.tsx` | auth gate, parallel reads, `notFound()`, engine calls, composes feature components | arithmetic, Supabase queries, `"use client"` |
| Route Handler | `src/app/api/**/route.ts` | GET reads for TanStack, auth callback, exports | writes (use a Server Action) |
| Server Action | `src/features/<f>/actions.ts` | auth → zod re-parse → write → `ActionResult` | reads for display, business arithmetic |
| Server read | `src/server/<domain>/<verb>-<noun>.ts` | one Supabase query → camelCase DTO | importing another domain's read to widen itself |
| Engine | `src/engine/<m>/` | pure domain rules (forest, memory, packs, questions) | React, Supabase, `fetch`, `process.env`, clock reads |

## 2. Server reads (`src/server/**`)

- A read that creates its own Supabase client or touches cookies/session starts with
  `import "server-only";`. **Exceptions** are files Vitest or the proxy must import, because
  `server-only` throws outside the React server runtime: pure helpers (`safe-next.ts`),
  functions that take the client as a parameter (`fetch-attempts.ts`), `supabase/env.ts`,
  `supabase/proxy-session.ts`, and file-backed `"use cache"` reads (`get-pack.ts`).
- **Single-purpose.** One read per domain noun (`getGroup`, `listMembers`). No
  `getGroupWithMembers`. Compose at the page. A deliberate joined read is allowed only to kill an
  N+1, and it gets its own named file.
- **Map at the edge.** Select explicit columns (never `select("*")`) and return a camelCase DTO
  typed in `src/server/<domain>/types.ts`. Raw rows and `snake_case` never leave this folder.
- Validate untrusted ids before querying (see `getGroup`). Return `null` when a row is missing or
  hidden. Throw on Supabase errors.
- Supabase clients come only from `src/server/supabase/*`. Never pass a client, a session or a
  service-role key out of `src/server/**`.
- Call `connection()` (or another dynamic API) before reading the Supabase auth session under
  Cache Components.
- Per-user, role-scoped or PII reads are **never** `"use cache"`. Shared, user-independent reads
  may be cached with `cacheTag`/`cacheLife` (see `nextjs-data`).

## 3. Pages and layouts

- `page.tsx` is the container. It awaits `params`/`searchParams` (both are Promises; type them
  with `PageProps<"/route">`), checks auth, reads in **parallel** with `Promise.all`, and passes
  DTOs and `ReactNode` slots down.
- Put per-user work in an async child component under `<Suspense>` with a real skeleton
  fallback. The static shell renders outside it.
- Redirect unauthenticated users with `redirect("/sign-in?next=…")` built from a safe internal path.
- A layout never fetches page data and never gates authorization alone. Every page and action
  re-checks.

## 4. Server Actions

- Start the file with `"use server"` and export async functions only.
- Order: `getCurrentUser()` → `Schema.safeParse(input)` with `input: unknown` → write → sync
  (`updateTag` / `refresh()` / `revalidatePath`) → return `ActionResult`.
- **Authorization is server-side and twice-checked:** RLS on the table *and* an explicit
  membership/role check in the action when the rule is about who may act. A hidden button is not
  authorization.
- Never trust ids, roles or prices from the client. Derive them from the session and the DB.
- An action does no reads for display. If the screen needs new data, it refreshes.

## 5. Route Handlers

- GET only, unless it is a webhook or callback. Respond `{ data }` on success and
  `{ error: { code, message } }` with the correct status otherwise (see `api-design`).
- Call the **same** `src/server/**` read the RSC uses, never a second query.
- Authenticate inside the handler. Middleware/proxy is not an auth boundary.

## 6. Engine (`src/engine/**`)

- Pure TypeScript: deterministic and side-effect free. Inputs in, value out. The clock, randomness
  and config are parameters.
- Each module exposes its public API through `index.ts`, and has `__tests__/` covering every
  exported decision.
- Every number shown on screen or exported comes from an engine function, and every surface calls
  the same one.

## 7. Database (`supabase/**`)

- Schema changes only via a new migration. Never edit an applied one. Run `pnpm db:types` after.
- Every table has RLS on. Revoke all before granting (TRUNCATE bypasses RLS). Each policy gets a
  `*.db.test.ts`.
- Migrate the **local** stack only. Remote changes are a human step.

## 8. Secrets and env

- Read server-only env vars only under `src/server/**` or config files. Expose to the client only
  `NEXT_PUBLIC_*` values that are safe to publish.
- Never log tokens, cookies, invite codes or full rows.
