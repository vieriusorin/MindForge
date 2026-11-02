---
name: p4t-nextjs-data
description: P4T Next.js 16 data rules: Cache Components, "use cache"/cacheLife/cacheTag, when a read may NOT be cached (role-scoped, PII, money), <Suspense> deferral for cookies()/getUser(), updateTag vs revalidateTag vs refresh, Server Action shape, and the forbidden pre-Cache-Components APIs (unstable_cache, export const runtime/dynamic/revalidate). Load before writing or editing any page.tsx, layout.tsx, route.ts, actions.ts, or any src/server/services read, and before choosing a caching or revalidation strategy.
---

# Next.js Data Access — fetching, mutating, caching, revalidating

Sources (Next.js 16.2.12 docs, read 2026-07-27):
[Fetching](https://nextjs.org/docs/app/getting-started/fetching-data) ·
[Mutating](https://nextjs.org/docs/app/getting-started/mutating-data) ·
[Caching](https://nextjs.org/docs/app/getting-started/caching) ·
[Revalidating](https://nextjs.org/docs/app/getting-started/revalidating) ·
[`cacheLife`](https://nextjs.org/docs/app/api-reference/functions/cacheLife) ·
[`cacheTag`](https://nextjs.org/docs/app/api-reference/functions/cacheTag)

Layering (which layer may do what) is `react-feature-architecture.md`. This file is about the
framework primitives: what runs when, what gets cached, and what invalidates it.

## 0. Prerequisite — this app uses Cache Components

Every rule below assumes `next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
};

export default nextConfig;
```

`cacheLife` and `cacheTag` **do not exist** without that flag; the docs route non-flag projects
to a different ("previous model") caching guide whose APIs — `unstable_cache`,
`export const revalidate`, `export const dynamic` — throw or are ignored under the flag. Mixing
the two models is the single most likely way to produce caching code that looks right and does
nothing.

Set the flag in the Phase 0 scaffold and log it in `.planning/PROJECT.md` → Key Decisions. Two
consequences worth stating up front, because they are not local to one file:

- **Partial Prerendering (PPR) becomes the default rendering model** — see §2.
- **`GET` Route Handlers follow the same prerendering model as pages.** That includes
  `app/api/export/[report]` — see §7.

## 1. Fetching

Reads happen in Server Components and in `src/server/services/`. `fetch` and the Drizzle client
are both fine; there is no HTTP hop to our own API for a read.

| Rule | Why |
|---|---|
| `fetch` is **not** cached by default in Next 16 | An uncached `fetch` blocks the route until it resolves. Cache it (§3) or stream it (§2) — deliberately, either way. |
| Identical `fetch` calls in one render are request-memoized | Fetch in the component that needs the data instead of prop-drilling. Does not apply to Drizzle queries. |
| `React.cache` is **per-request only** | Use it to dedupe a Drizzle read called from several places in one render (e.g. `getCurrentUser()`). It is request-scoped memoization, not a cache across requests (that is `use cache`), and it does **not** make its caller prerenderable — a `React.cache`'d read of `cookies()` still has to be deferred per §2. |
| Start independent reads together | Two sequential `await`s in one component are two round-trips. |

```ts
// Wrong — src/app/(dashboard)/santiere/[id]/page.tsx: sequential for no reason
const santier = await getSantier(id);
const entries = await getPontajEntries(id, range);
```

```ts
// Correct — both reads need only `id`
const [santier, entries] = await Promise.all([
  getSantier(id),
  getPontajEntries(id, range),
]);
```

`Promise.all` rejects if any read rejects. Use `Promise.allSettled` only where a partial page is
genuinely acceptable (a KPI tile that can render "—"); never for pontaj rows or any figure that
feeds a total — a silently missing row is a wrong number.

Sequential is correct when the second read needs the first read's result. In that case put the
dependent part in its own `<Suspense>` so the page does not wait on the whole chain.

Client-side reads: TanStack Query (`STACK.md`), or pass a promise from the RSC page into a
Client Component and read it with React's `use()` inside a `<Suspense>`. Do not add SWR.

## 2. Suspense and PPR — the rule that bites first

With Cache Components on, Next.js renders the tree at build time and requires every branch to
be one of: cached (§3), deterministic, or explicitly deferred under `<Suspense>`. Anything else
fails the build with:

```
Uncached data was accessed outside of <Suspense>
```

Runtime APIs that force deferral: `cookies()`, `headers()`, `searchParams`, and `params` (unless
`generateStaticParams` provides a sample).

**This app reads `cookies()` on essentially every page** — `supabase.auth.getUser()` via
`@supabase/ssr` is how authorization happens. So the default page shape is: a static frame, and
the authenticated/data-bearing subtree under a `<Suspense>` with a real skeleton.

```tsx
// Correct — src/app/(dashboard)/pontaj/page.tsx
import { Suspense } from "react";
import { PontajTableSkeleton } from "@/modules/pontaj/components/pontaj-table-skeleton";
import { PontajPanel } from "@/modules/pontaj/components/pontaj-panel";

const PontajPage = () => (
  <section>
    <h1>Pontaj</h1>
    <Suspense fallback={<PontajTableSkeleton />}>
      <PontajPanel />
    </Suspense>
  </section>
);

export default PontajPage;
```

- Put the boundary **close to the runtime data access**, not at the route root. `loading.js`
  covers a page but not a layout that itself reads `cookies()` — that blocks navigation.
- Fallbacks are Romanian and meaningful (skeleton rows shaped like the table), not `Loading...`.
- Do **not** "fix" the build error by wrapping `<body>` in the root layout in an empty-fallback
  `<Suspense>`. That opts the whole app out of the static shell and makes every request block.
- `<Suspense>` alone does not make a component dynamic; it only provides the fallback while
  deferred work completes.
- Non-deterministic calls (`Date.now()`, `crypto.randomUUID()`, `Math.random()`) must sit after
  `await connection()` inside a deferred component, or be cached. Relevant for pontaj: "today"
  is request-time data, so a screen defaulting to the current day is deferred by definition.

## 3. Caching — `use cache`, and what is forbidden

`use cache` at the top of an async function or component body caches its return value across
requests. At file top level it caches every export in the file.

```ts
// Correct — src/server/services/nomenclatoare/get-tipuri-unelte.ts
import { cacheLife, cacheTag } from "next/cache";

export const getTipuriUnelte = async (): Promise<TipUnealta[]> => {
  "use cache";
  cacheLife("days");
  cacheTag("tipuri-unelte");

  return db.select().from(tipuriUnelte);
};
```

### The prohibition

**Never `use cache` anything whose result varies by who is viewing it.** Arguments *and
closed-over values* form the cache key, so:

- A cached function that calls `cookies()` / `getUser()` internally is either a build error or a
  cache entry shared across users.
- Caching a read **before** `server/authz/dto.ts` strips fields puts `tarif_orar`,
  `personal_email`, `emergency_contact` into a shared store. Caching **after** stripping means
  the role must be part of the cache key — one entry per role, which is a cache you now have to
  reason about on every RBAC change.

So, concretely:

| Data | Treatment |
|---|---|
| Nomenclatoare / reference lists (tipuri unelte, categorii cheltuieli, roluri) | `use cache` + `cacheLife` + `cacheTag`. Role-invariant. |
| Șantier metadata (nume, adresă, `diurna_enabled`, `diurna_rate`) | `use cache` + tag per șantier. Not permission-varying — but cache the *row*, not a filtered "șantiere I can see" list. |
| Pontaj rows, allocations, cereri, transferuri, foi de parcurs | **Never cached.** Stream under `<Suspense>`. |
| Anything role-scoped or RLS-scoped ("șantierele mele", "uneltele depozitului meu") | **Never cached.** The scope comes from the session. |
| Any figure carrying money, hours, diurnă, or PII | **Never cached** unless §7 is satisfied. |
| Presence / KPI dashboard | Not cached server-side; it is a TanStack Query poll (`STACK.md`). |

If a cached function genuinely needs a runtime value, extract it in an uncached parent and pass
it in as an argument so it becomes part of the key — and only when that value is *not* a
permission scope:

```tsx
// Acceptable — santierId comes from the URL, not from the viewer's role
async function SantierHeader({ santierId }: { santierId: string }) {
  "use cache";
  cacheLife("hours");
  cacheTag(`santier-${santierId}`);
  const santier = await getSantier(santierId);
  return <h1>{santier.nume}</h1>;
}
```

### The connection clause — blocked on the Phase 0 authz decision

A `use cache`'d read must **not** run on a connection whose row visibility derives from the
session. If the runtime Drizzle client assumes the authenticated role (`getScopedDb`, the
RLS-as-security-boundary branch in `CLAUDE.md`), then even `getSantier(id)` is silently
session-scoped: one cache entry keyed on `santierId` alone can serve a row user A may see to
user B who may not. That is `PITFALLS.md` Pitfall 2 wearing a cache.

Until the RLS-vs-`service_role` fork is resolved in Phase 0 and logged in `PROJECT.md` → Key
Decisions, treat the two `use cache` examples above as conditional: they are correct only for a
read on an explicitly unscoped connection. Under `getScopedDb`, either the read moves to an
unscoped connection deliberately, or it is not cached.

Default cache storage is **in-memory**, which does not persist across requests in a serverless
deployment — a `use cache` entry there may re-evaluate every request. `'use cache: remote'`
exists for durable shared caching; treat it as a deliberate choice, not a default, and never
for anything the table above forbids.

## 4. `cacheLife`

Call it in the same function that declares `use cache`, never at module scope, never abstracted
into a shared helper. **Always call it explicitly** — the omitted case is the trap (see nesting).

| Profile | `stale` | `revalidate` | `expire` | Use for |
|---|---|---|---|---|
| `default` | 5m | 15m | never | — (prefer naming one) |
| `seconds` | 30s | 1s | 60s | real-time; excluded from prerender |
| `minutes` | 5m | 1m | 1h | frequently changing |
| `hours` | 5m | 1h | 1d | șantier metadata |
| `days` | 5m | 1d | 1w | nomenclatoare |
| `weeks` | 5m | 1w | 30d | rarely edited config |
| `max` | 5m | 30d | 1y | effectively static |

`stale` is the client router window (30s minimum enforced), `revalidate` is background
regeneration, `expire` is the hard ceiling — and `expire` must be greater than `revalidate` or
Next.js errors. An inline object is allowed for one-offs and inherits omitted fields from
`default`. Custom named profiles go in `next.config.ts` under `cacheLife`.

Two hazards:

- **Short-lived caches are dropped from the prerender** (`seconds`, `revalidate: 0`, or `expire`
  under 5 minutes) and become dynamic holes. Wrap them in `<Suspense>`.
- **Nesting.** With an explicit outer `cacheLife`, the outer profile wins. Without one, an inner
  cache with a *shorter* life silently shortens the outer cache, and an inner *short-lived*
  cache inside an unspecified outer one **throws at prerender**. The inner cache may be in an
  imported module you did not write. Explicit profiles everywhere makes this unreachable.

Only one `cacheLife` call may execute per invocation — branching to different profiles is fine
(`minutes` for a missing row, `days` for a published one) as long as exactly one runs.

## 5. `cacheTag` and revalidating

Tag inside the `use cache` scope; invalidate from a Server Action or Route Handler.

```ts
cacheTag("tipuri-unelte");                 // collection
cacheTag(`santier-${santierId}`);          // one row
cacheTag("santiere", `santier-${id}`);     // both, one call
```

Tags are idempotent. Limits: 128 tags per call, 256 characters each — overflow is **silently
dropped** with a console warning, so build tag names from IDs, never from free text.

| API | Where it may be called | Behaviour | Use for |
|---|---|---|---|
| `updateTag(tag)` | Server Actions only | expires the entry **immediately** | read-your-own-writes: the actor must see their change |
| `revalidateTag(tag, 'max')` | Server Actions + Route Handlers | stale-while-revalidate; 2nd arg = how long stale may be served | background freshness where a delay is acceptable |
| `revalidatePath(path)` | Server Actions + Route Handlers | invalidates a whole route | last resort when the tags are unknown |
| `refresh()` | Server Actions | re-renders the client router only; **does not** revalidate tagged data | reflecting a change that needs no cache invalidation |

**Pick by what the mutation touched — a tag only invalidates something that was tagged.**

| The mutation changed… | Invalidate with |
|---|---|
| cached reference data (nomenclatoare, șantier metadata, `diurna_rate`) | `updateTag('tipuri-unelte')` / `updateTag(\`santier-${id}\`)` — immediate, actor sees it |
| uncached transactional rows (pontaj, transferuri, cereri, foi de parcurs) | `refresh()` server-side + `invalidateQueries` client-side. There is no tag to expire — §3 forbids caching these — so a `updateTag('pontaj-…')` call here is a no-op that reads as invalidation. |
| both (e.g. a cerere approval that also flips a cached allocation) | both, in that order |
| a cached read written by a background job (cron alerts) | `revalidateTag(tag, 'max')` — stale-while-revalidate is fine, and it is the only one of the two callable from a Route Handler |

Never reach for `revalidatePath` when the tag is known — paths over-invalidate. And never
`revalidateTag` on something the acting user is about to look at: stale-while-revalidate reads as
"my correction didn't save", and trustworthy pontaj is the project's tiebreaker.

### Composition with TanStack Query — unchanged, and still required

`revalidatePath` / `revalidateTag` / `updateTag` affect **server** caches only. They do nothing
to a client-side TanStack Query cache. A screen that mixes server-rendered content with a client
`useQuery` table needs **both**:

```ts
// Correct — src/modules/pontaj/components/use-corectie-pontaj.ts (client)
const mutation = useMutation({
  mutationFn: corecteazaPontaj,          // Server Action; calls refresh() inside
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["pontaj", santierId] });
  },
});
```

## 6. Mutating

Writes are Server Actions in `src/modules/<feature>/actions.ts`. Thin: authorize → parse (zod) →
call a service → invalidate → return.

```ts
// Correct — src/modules/pontaj/actions.ts
"use server";

import { refresh } from "next/cache";
import { corectiePontajSchema } from "@/lib/schemas/pontaj";
import { corecteazaPontaj as corecteazaPontajService } from "@/server/services/pontaj/corecteaza-pontaj";
import { requireCapability } from "@/server/authz/require-capability";

export const corecteazaPontaj = async (input: unknown): Promise<ActionResult> => {
  const actor = await requireCapability("pontaj:correct");   // getUser(), never getSession()
  const parsed = corectiePontajSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten() };

  await corecteazaPontajService(parsed.data, actor);

  // Pontaj reads are uncached (§3), so there is no tag to expire — refresh the router so the
  // server-rendered parts re-render. The client `useQuery` table still needs invalidateQueries.
  refresh();
  return { ok: true };
};
```

Rules:

- **Authorize inside every Server Action.** They are reachable by direct `POST`, not only
  through our UI. Reaching an action does not mean the user saw the button. `getUser()`, never
  `getSession()`.
- **Validate with zod inside the action.** Client-side RHF validation is UX, not a boundary.
- `'use server'` marks the boundary — never put it in a file that also exports non-action
  helpers you did not intend to expose.
- Server Functions cannot be defined in Client Components; import them from an
  `actions.ts` and pass them as `action` / `formAction` / props.
- **`redirect()` last.** It throws a control-flow exception; anything after it — including your
  `updateTag` / `refresh()` — never runs.
- Forms use the shadcn `Form` primitives (`ui-shadcn.md`) with `useActionState` for pending
  state. The client dispatches Server Actions one at a time; do not use them for parallel reads.
- Setting or deleting a cookie in an action re-renders the current tree server-side; no extra
  refresh call is needed for that alone.
- The `audit_log` trail is written by a Postgres `AFTER` trigger, not by the action — but the
  action is what threads the actor via `set_config('app.current_user_id', …, true)` in the same
  transaction.

## 7. Caching and calculation parity

`PROJECT.md` calls screen/export divergence trust-destroying. Caching introduces a new way to
cause it, and with Cache Components the export route is prerendering-aware too (`GET` Route
Handlers follow the page model).

Rule: **for any figure that appears both on screen and in an export, the RSC page and
`app/api/export/[report]` call the same `server/services/cost-engine/` function, and the cache
scope lives inside that function — or neither caches.** Never a `use cache` wrapper on the page
side only.

```ts
// Wrong — page reads a cached wrapper, export recomputes. They will drift.
const cached = await getSantierCostCached(id, range);   // page
const fresh = await getSantierCost(id, range);          // export route
```

Since salarii / diurnă / cazare / cost-km are per-șantier financial figures gated by role, the
practical answer is **do not cache them** — stream them under `<Suspense>` and let the cost
engine be the single source of truth. Chart numbers are figures too: same function as the table
beside them.

Export handlers that use exceljs or `@react-pdf/renderer` must stay on the Node.js runtime.
With `cacheComponents: true` that is the default — do **not** add `export const runtime`
(route segment config is blocked; only `runtime = 'edge'` was ever meaningful here).

## 8. Do not use

| API / pattern | Why |
|---|---|
| `unstable_cache` | Previous caching model; replaced by `use cache`. |
| `export const revalidate = N` | Previous model. Use `cacheLife`. |
| `export const dynamic = "force-dynamic"` / `"force-static"` | Previous model. Deferral is expressed with `<Suspense>`, caching with `use cache`. |
| `export const runtime = "nodejs"` / `"edge"` | Blocked when `cacheComponents: true`. Node.js is the default; Edge is unsupported. |
| `export const fetchCache`, `unstable_noStore` | Same. `fetch` is uncached by default. |
| `getSession()` for any authorization decision | Reads the cookie without server-side revalidation. `getUser()`. |
| `use cache` on role-scoped, per-user, PII, or money-bearing reads | §3. |
| `revalidatePath` as the only invalidation for a client `useQuery` table | §5 — it does nothing to the TanStack cache. |
| `updateTag` / `revalidateTag` for a tag no `use cache` scope ever sets | Silent no-op that reads like invalidation. Uncached reads use `refresh()` + `invalidateQueries` (§5). |
| `use cache` on a read whose visibility comes from the session's DB role | §3 connection clause — blocked on the Phase 0 authz decision. |
| An empty-fallback `<Suspense>` around `<body>` in the root layout | §2 — opts the whole app out of the static shell. |
| SWR, or a second data-fetching library | TanStack Query is the client-side choice. |
