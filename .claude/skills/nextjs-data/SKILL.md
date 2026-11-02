---
name: nextjs-data
description: Next.js 16 data rules under Cache Components — "use cache"/cacheLife/cacheTag, when a read may NOT be cached (role-scoped, per-user, PII, money), <Suspense> deferral for cookies()/headers()/auth reads, updateTag vs revalidateTag vs refresh, Server Action shape, screen/export calculation parity, and the forbidden pre-Cache-Components APIs (unstable_cache, export const runtime/dynamic/revalidate). Load before writing or editing any page.tsx, layout.tsx, route.ts, actions.ts or server-side read function, and before choosing a caching or revalidation strategy.
---

# Next.js Data Access — fetching, mutating, caching, revalidating

Sources (Next.js 16 docs — re-check the installed version in `node_modules/next/dist/docs/`):
[Fetching](https://nextjs.org/docs/app/getting-started/fetching-data) ·
[Mutating](https://nextjs.org/docs/app/getting-started/mutating-data) ·
[Caching](https://nextjs.org/docs/app/getting-started/caching) ·
[Revalidating](https://nextjs.org/docs/app/getting-started/revalidating) ·
[`cacheLife`](https://nextjs.org/docs/app/api-reference/functions/cacheLife) ·
[`cacheTag`](https://nextjs.org/docs/app/api-reference/functions/cacheTag)

Layering (which layer may do what) is the `react-feature-architecture` skill. This file is about
the framework primitives: what runs when, what gets cached, and what invalidates it.

## Project bindings

Resolve these from `package.json`, `CLAUDE.md`/`AGENTS.md`, `next.config.*` and the codebase
before writing code. Examples below use the defaults.

| Binding | What to look for | Default if absent |
|---|---|---|
| Server read layer | folder holding single-purpose read functions | `server/services/<feature>/` |
| Action files | where Server Actions live | `src/modules/<feature>/actions.ts` |
| DB client | ORM / query client (Drizzle, Prisma, supabase-js…) | `db` |
| Session-scoped DB client | a client whose row visibility depends on the viewer (RLS, tenant filter) | none — ask if unsure |
| Auth check | the helper that authorizes a capability and returns the actor | `requireCapability(cap)` |
| Auth read | server-verified user read (e.g. Supabase `getUser()`, not `getSession()`) | `getUser()` |
| DTO / field-stripping layer | where PII/financial fields are removed per role | `server/authz/dto.ts` |
| Calculation engine | the single owner of derived figures (money, hours, totals) | `server/services/<calc>/` |
| Export route | Route Handler producing files (xlsx/pdf/csv) | `app/api/export/[report]` |
| Client data library | TanStack Query, or none | TanStack Query |
| Form primitives | see the `ui-shadcn` skill | — |
| Decisions log | where architecture decisions are recorded | `docs/adr/` or `.planning/PROJECT.md` |

## 0. Prerequisite — Cache Components

Every rule below assumes `next.config.ts` sets `cacheComponents: true`. Check it first.

`cacheLife` and `cacheTag` **do not exist** without that flag; the docs route non-flag projects
to the "previous model" caching guide whose APIs — `unstable_cache`, `export const revalidate`,
`export const dynamic` — throw or are ignored under the flag. Mixing the two models is the single
most likely way to produce caching code that looks right and does nothing. If the project is not
on the flag, stop and say so rather than applying this file.

Two consequences that are not local to one file:

- **Partial Prerendering (PPR) becomes the default rendering model** — see §2.
- **`GET` Route Handlers follow the same prerendering model as pages**, export routes included — §7.

## 1. Fetching

Reads happen in Server Components and in the server read layer. `fetch` and the DB client are
both fine; there is no HTTP hop to your own API for a read.

| Rule | Why |
|---|---|
| `fetch` is **not** cached by default in Next 16 | An uncached `fetch` blocks the route until it resolves. Cache it (§3) or stream it (§2) — deliberately, either way. |
| Identical `fetch` calls in one render are request-memoized | Fetch in the component that needs the data instead of prop-drilling. Does not apply to DB-client queries. |
| `React.cache` is **per-request only** | Dedupes a DB read called from several places in one render (e.g. `getCurrentUser()`). Not a cross-request cache (that is `use cache`), and it does **not** make its caller prerenderable — a `React.cache`'d read of `cookies()` still has to be deferred per §2. |
| Start independent reads together | Two sequential `await`s in one component are two round-trips. |

```ts
// Wrong — sequential for no reason
const project = await getProject(id);
const entries = await getEntries(id, range);

// Correct — both reads need only `id`
const [project, entries] = await Promise.all([getProject(id), getEntries(id, range)]);
```

`Promise.all` rejects if any read rejects. Use `Promise.allSettled` only where a partial page is
genuinely acceptable (a KPI tile that can render "—"); never for rows or any figure that feeds a
total — a silently missing row is a wrong number.

Sequential is correct when the second read needs the first's result. Put the dependent part in
its own `<Suspense>` so the page does not wait on the whole chain.

Client-side reads: the project's client data library, or pass a promise from the RSC page into a
Client Component and read it with React's `use()` inside a `<Suspense>`. Do not add a second
data-fetching library.

## 2. Suspense and PPR — the rule that bites first

With Cache Components on, Next.js renders the tree at build time and requires every branch to be
cached (§3), deterministic, or explicitly deferred under `<Suspense>`. Anything else fails the
build with `Uncached data was accessed outside of <Suspense>`.

Runtime APIs that force deferral: `cookies()`, `headers()`, `searchParams`, and `params` (unless
`generateStaticParams` provides a sample).

**Any app with cookie-based auth reads `cookies()` on essentially every authenticated page.** So
the default page shape is a static frame, with the authenticated/data-bearing subtree under a
`<Suspense>` with a real skeleton.

```tsx
const EntriesPage = () => (
  <section>
    <h1>Entries</h1>
    <Suspense fallback={<EntriesTableSkeleton />}>
      <EntriesPanel />
    </Suspense>
  </section>
);
export default EntriesPage;
```

- Put the boundary **close to the runtime data access**, not at the route root. `loading.js`
  covers a page but not a layout that itself reads `cookies()` — that blocks navigation.
- Fallbacks are meaningful (skeleton rows shaped like the table, in the UI's language), not `Loading...`.
- Do **not** "fix" the build error by wrapping `<body>` in the root layout in an empty-fallback
  `<Suspense>`. That opts the whole app out of the static shell and makes every request block.
- `<Suspense>` alone does not make a component dynamic; it only provides the fallback.
- Non-deterministic calls (`Date.now()`, `crypto.randomUUID()`, `Math.random()`) must sit after
  `await connection()` inside a deferred component, or be cached. "Today" is request-time data,
  so a screen defaulting to the current day is deferred by definition.

## 3. Caching — `use cache`, and what is forbidden

`use cache` at the top of an async function or component body caches its return value across
requests. At file top level it caches every export in the file.

```ts
import { cacheLife, cacheTag } from "next/cache";

export const getCategories = async (): Promise<Category[]> => {
  "use cache";
  cacheLife("days");
  cacheTag("categories");
  return db.select().from(categories);
};
```

### The prohibition

**Never `use cache` anything whose result varies by who is viewing it.** Arguments *and
closed-over values* form the cache key, so:

- A cached function that calls `cookies()` / the auth read internally is either a build error or
  a cache entry shared across users.
- Caching a read **before** the DTO layer strips fields puts PII or financial fields into a
  shared store. Caching **after** stripping means the role must be part of the key — one entry per
  role, a cache you now have to reason about on every permission change.

| Data | Treatment |
|---|---|
| Reference / lookup lists (categories, types, roles) | `use cache` + `cacheLife` + `cacheTag`. Role-invariant. |
| Entity metadata not varying by viewer (name, address, config flags) | `use cache` + tag per entity. Cache the *row*, never a filtered "items I can see" list. |
| Transactional rows (entries, requests, transfers, logs) | **Never cached.** Stream under `<Suspense>`. |
| Anything role-, tenant- or RLS-scoped ("my items") | **Never cached.** The scope comes from the session. |
| Any figure carrying money, hours, or PII | **Never cached** unless §7 is satisfied. |
| Live presence / KPI dashboards | Not cached server-side; poll from the client. |

If a cached function genuinely needs a runtime value, extract it in an uncached parent and pass
it as an argument so it joins the key — only when that value is *not* a permission scope:

```tsx
// Acceptable — id comes from the URL, not from the viewer's role
async function ProjectHeader({ id }: { id: string }) {
  "use cache";
  cacheLife("hours");
  cacheTag(`project-${id}`);
  const project = await getProject(id);
  return <h1>{project.name}</h1>;
}
```

### The connection clause

A `use cache`'d read must **not** run on a connection whose row visibility derives from the
session. If the runtime DB client assumes the authenticated role (the session-scoped client
binding, e.g. RLS as the security boundary), then even `getProject(id)` is silently
session-scoped: one entry keyed on `id` alone can serve a row user A may see to user B who may
not. That is an authorization bug wearing a cache.

Until the project has a recorded decision on scoped vs unscoped DB access, treat the examples
above as conditional: correct only for a read on an explicitly unscoped connection. Under a
scoped client, either move the read to an unscoped connection deliberately, or don't cache it.

Default cache storage is **in-memory**, which does not persist across requests in serverless —
an entry may re-evaluate every request. `'use cache: remote'` exists for durable shared caching;
treat it as a deliberate choice, never for anything the table above forbids.

## 4. `cacheLife`

Call it in the same function that declares `use cache`, never at module scope, never abstracted
into a shared helper. **Always call it explicitly** — the omitted case is the trap (see nesting).

| Profile | `stale` | `revalidate` | `expire` | Use for |
|---|---|---|---|---|
| `default` | 5m | 15m | never | — (prefer naming one) |
| `seconds` | 30s | 1s | 60s | real-time; excluded from prerender |
| `minutes` | 5m | 1m | 1h | frequently changing |
| `hours` | 5m | 1h | 1d | entity metadata |
| `days` | 5m | 1d | 1w | reference lists |
| `weeks` | 5m | 1w | 30d | rarely edited config |
| `max` | 5m | 30d | 1y | effectively static |

`stale` is the client router window (30s minimum), `revalidate` is background regeneration,
`expire` the hard ceiling — `expire` must exceed `revalidate` or Next.js errors. An inline object
is allowed for one-offs and inherits omitted fields from `default`. Custom named profiles go in
`next.config.ts` under `cacheLife`.

Two hazards:

- **Short-lived caches are dropped from the prerender** (`seconds`, `revalidate: 0`, or `expire`
  under 5 minutes) and become dynamic holes. Wrap them in `<Suspense>`.
- **Nesting.** With an explicit outer `cacheLife`, the outer profile wins. Without one, an inner
  cache with a *shorter* life silently shortens the outer, and an inner *short-lived* cache inside
  an unspecified outer one **throws at prerender**. The inner cache may be in a module you did not
  write. Explicit profiles everywhere makes this unreachable.

Only one `cacheLife` call may execute per invocation — branching to different profiles is fine
as long as exactly one runs.

## 5. `cacheTag` and revalidating

Tag inside the `use cache` scope; invalidate from a Server Action or Route Handler.

```ts
cacheTag("categories");                  // collection
cacheTag(`project-${id}`);               // one row
cacheTag("projects", `project-${id}`);   // both, one call
```

Tags are idempotent. Limits: 128 tags per call, 256 characters each — overflow is **silently
dropped** with a console warning, so build tag names from IDs, never from free text.

| API | Where | Behaviour | Use for |
|---|---|---|---|
| `updateTag(tag)` | Server Actions only | expires **immediately** | read-your-own-writes |
| `revalidateTag(tag, 'max')` | Actions + Route Handlers | stale-while-revalidate | background freshness where delay is fine |
| `revalidatePath(path)` | Actions + Route Handlers | invalidates a whole route | last resort when tags are unknown |
| `refresh()` | Server Actions | re-renders the client router; **does not** revalidate tagged data | a change needing no cache invalidation |

**Pick by what the mutation touched — a tag only invalidates something that was tagged.**

| The mutation changed… | Invalidate with |
|---|---|
| cached reference data or entity metadata | `updateTag(...)` — immediate, the actor sees it |
| uncached transactional rows | `refresh()` server-side + client cache invalidation. There is no tag to expire — `updateTag` here is a no-op that reads as invalidation. |
| both | both, in that order |
| a cached read written by a background job | `revalidateTag(tag, 'max')` — the only one callable from a Route Handler |

Never `revalidatePath` when the tag is known — paths over-invalidate. Never `revalidateTag` on
something the acting user is about to look at: stale-while-revalidate reads as "my correction
didn't save".

### Composition with a client cache — still required

`revalidatePath` / `revalidateTag` / `updateTag` affect **server** caches only. A screen mixing
server-rendered content with a client `useQuery` table needs **both**:

```ts
const mutation = useMutation({
  mutationFn: correctEntry,              // Server Action; calls refresh() inside
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ["entries", projectId] }),
});
```

## 6. Mutating

Writes are Server Actions in the action files. Thin: authorize → parse (zod) → call a service →
invalidate → return.

```ts
"use server";
import { refresh } from "next/cache";

export const correctEntry = async (input: unknown): Promise<ActionResult> => {
  const actor = await requireCapability("entries:correct"); // server-verified user read
  const parsed = correctEntrySchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten() };

  await correctEntryService(parsed.data, actor);
  refresh(); // entries are uncached (§3) — no tag to expire; client table still invalidates
  return { ok: true };
};
```

Rules:

- **Authorize inside every Server Action.** They are reachable by direct `POST`, not only through
  your UI. Use the server-verified auth read, never a cookie-only session read.
- **Validate with zod inside the action.** Client-side form validation is UX, not a boundary.
- `'use server'` marks the boundary — never in a file that also exports helpers you did not mean
  to expose.
- Server Functions cannot be defined in Client Components; import them from an action file and
  pass them as `action` / `formAction` / props.
- **`redirect()` last.** It throws a control-flow exception; anything after it — including
  `updateTag` / `refresh()` — never runs.
- Pending state via `useActionState`. The client dispatches Server Actions one at a time; do not
  use them for parallel reads.
- Setting or deleting a cookie in an action re-renders the current tree; no extra refresh needed.
- If audit logging is done by a DB trigger, the action is what threads the actor into the same
  transaction (e.g. `set_config('app.current_user_id', …, true)`).

## 7. Caching and calculation parity

A figure shown on screen and in an export that disagree destroys trust. Caching adds a new way to
cause it, and under Cache Components the export route is prerendering-aware too.

Rule: **for any figure on both a screen and an export, the RSC page and the export route call the
same calculation-engine function, and the cache scope lives inside that function — or neither
caches.** Never a `use cache` wrapper on the page side only.

```ts
// Wrong — page reads a cached wrapper, export recomputes. They will drift.
const cached = await getCostCached(id, range);   // page
const fresh = await getCost(id, range);          // export route
```

Since money/hour figures are usually role-gated, the practical answer is **do not cache them** —
stream under `<Suspense>` and keep the engine the single source of truth. Chart numbers are
figures too: same function as the table beside them.

Export handlers using Node-only libraries (exceljs, `@react-pdf/renderer`) stay on Node.js —
the default under `cacheComponents: true`. Do **not** add `export const runtime`.

## 8. Do not use

| API / pattern | Why |
|---|---|
| `unstable_cache` | Previous model; replaced by `use cache`. |
| `export const revalidate = N` | Previous model. Use `cacheLife`. |
| `export const dynamic = "force-dynamic"` / `"force-static"` | Previous model. Defer with `<Suspense>`, cache with `use cache`. |
| `export const runtime = "nodejs"` / `"edge"` | Blocked under `cacheComponents`. Node.js is default; Edge unsupported. |
| `export const fetchCache`, `unstable_noStore` | Same. `fetch` is uncached by default. |
| A cookie-only session read for authorization | Not revalidated server-side. Use the server-verified user read. |
| `use cache` on role-scoped, per-user, PII, or money-bearing reads | §3. |
| `revalidatePath` as the only invalidation for a client `useQuery` table | §5 — does nothing to the client cache. |
| `updateTag` / `revalidateTag` for a tag no `use cache` scope sets | Silent no-op that reads like invalidation. |
| `use cache` on a read whose visibility comes from the session's DB role | §3 connection clause. |
| An empty-fallback `<Suspense>` around `<body>` | §2 — opts the whole app out of the static shell. |
| A second data-fetching library | One client-side choice per project. |
