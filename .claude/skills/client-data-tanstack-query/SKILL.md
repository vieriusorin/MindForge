---
name: client-data-tanstack-query
description: MindForge's TanStack Query v5 patterns on Next.js 16 (Cache Components) — when to use it at all versus an RSC read, the per-feature queries.ts cache contract (key + queryOptions + tag), GET Route Handlers as the client queryFn calling the same src/server read, server prefetch into HydrationBoundary under Suspense, nuqs values in query keys, useMutation wrapping Server Actions with ActionResult, invalidation vs router.refresh vs updateTag, optimistic updates, and the anti-patterns. Load before writing useQuery, useSuspenseQuery, useMutation, a queries.ts, or an api/ Route Handler for client reads. Supersedes any generic "tanstack-query" skill copied from another project.
---

# Client data with TanStack Query

Contract: `.claude/rules/state-and-data.md` §1, §3, §4. Next's own guide for this version:
`node_modules/next/dist/docs/01-app/02-guides/client-side-data-fetching/tanstack-query.md`.
Read that before changing the provider or the hydration helpers.

**Installed:** `@tanstack/react-query` 5.x. **Wired:** `src/components/app-providers.tsx`
(root layout) and `src/lib/query-client.ts` (`makeQueryClient`, `getQueryClient`, with
`staleTime: 60s` and pending-query dehydration).

## 0. Do you need it?

Most reads don't. An RSC read passed as props is simpler, streams, and needs no endpoint.
Use TanStack Query only when the **client** has to get fresh server data **without a
navigation**:

- the list re-queries as a nuqs filter changes with `shallow: true` (no RSC round-trip)
- polling / `refetchInterval` (a live group heatmap)
- infinite scroll (`useInfiniteQuery`)
- an optimistic update shared by several components on the screen
- data shown in a client-only surface (a `Sheet` opened on demand)

Every **mutation** from a client component goes through `useMutation`, even when no query
exists on the screen. It's the one place pending, error and success handling live.

## 1. The cache contract — `src/features/<f>/queries.ts`

One object per resource. Key, options and (optional) server tag live together, so the server
prefetch, the client hook and the invalidation all name the same cache entry. **No
`server-only` or `"use client"` import in this file.** Both sides import it.

```ts
// src/features/review/queries.ts   (illustrative — the review feature is not built yet)
import { queryOptions } from "@tanstack/react-query";
import { createSerializer } from "nuqs/server";   // NOT "nuqs": that entry is "use client"
import type { ReviewQueueItem } from "@/server/review/types";  // type-only: erased, safe
import { reviewQueueParsers, type ReviewQueueParams } from "./search-params";

const serialize = createSerializer(reviewQueueParsers);

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  return ((await res.json()) as { data: T }).data;       // api-design envelope: { data }
}

export const reviewQueueCache = {
  all: ["review-queue"] as const,                          // prefix for broad invalidation
  key: (packSlug: string, params: ReviewQueueParams) =>
    [...reviewQueueCache.all, packSlug, params] as const,  // EVERY input that changes the result
  options: (packSlug: string, params: ReviewQueueParams) =>
    queryOptions({
      queryKey: reviewQueueCache.key(packSlug, params),
      queryFn: () =>
        getJson<ReviewQueueItem[]>(`/api/review/${packSlug}/queue${serialize(params)}`),
      staleTime: 30_000,
    }),
};
```

Rules:
- Keys are arrays, starting with the resource name, ending with an object of the inputs. Put
  the nuqs params object in the key as-is. TanStack hashes it deterministically.
- `queryOptions` gives you typed `getQueryData` / `setQueryData` for free; never re-type them.
- Hoist `getJson` to `src/lib/` on the **second** feature that needs it (rule 9), not before.

## 2. The read endpoint — a GET Route Handler calling the same server read

```ts
// src/app/api/review/[packSlug]/queue/route.ts
import { NextResponse } from "next/server";
import { loadReviewQueueParams } from "@/features/review/search-params";
import { getCurrentUser } from "@/server/auth/current-user";
import { listReviewQueue } from "@/server/review/list-review-queue";

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/review/[packSlug]/queue">,
) {
  const user = await getCurrentUser();                       // server-verified, never getSession
  if (!user)
    return NextResponse.json(
      { error: { code: "unauthenticated", message: "Sign in again." } },
      { status: 401 },
    );
  const { packSlug } = await ctx.params;
  const params = loadReviewQueueParams(request);             // same parsers as the URL
  const data = await listReviewQueue(packSlug, params);      // same read the RSC would use
  return NextResponse.json({ data });
}
```

The handler is thin: auth, parse, call `src/server/**`, wrap in `{ data }`. RLS does the
row filtering. Status codes and error envelope: `api-design` skill. No `export const runtime`
or `dynamic`; reading cookies already makes it dynamic.

## 3. Server prefetch → `HydrationBoundary` (when the first paint needs the data)

```tsx
// src/app/(app)/review/[packSlug]/page.tsx (server)
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { Suspense } from "react";
import { ReviewQueue } from "@/features/review/components/review-queue";
import { reviewQueueCache } from "@/features/review/queries";
import { loadReviewQueueParams } from "@/features/review/search-params";
import { makeQueryClient } from "@/lib/query-client";
import { listReviewQueue } from "@/server/review/list-review-queue";

async function QueueSlot({ params, searchParams }: PageProps<"/review/[packSlug]">) {
  const { packSlug } = await params;
  const filters = await loadReviewQueueParams(searchParams);
  const queryClient = makeQueryClient();
  void queryClient.prefetchQuery({                     // not awaited → streams as it resolves
    ...reviewQueueCache.options(packSlug, filters),
    queryFn: () => listReviewQueue(packSlug, filters), // server: call the read directly
  });
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ReviewQueue packSlug={packSlug} />
    </HydrationBoundary>
  );
}

export default function ReviewPage(props: PageProps<"/review/[packSlug]">) {
  return (
    <Suspense fallback={<ReviewQueueSkeleton />}>
      <QueueSlot {...props} />
    </Suspense>
  );
}
```

- The prefetch lives **inside** `<Suspense>`. Under Cache Components, `dehydrate()` reads the
  current time; outside a dynamic boundary that is a prerender error.
- Never `use cache` the prefetched read: it's per-user. Next's "prerenderable hydration
  state" helper is only for data that's the same for everyone (pack files). Ask before
  adding it.
- If the client doesn't need to refetch, delete all of this and pass the RSC read as props.

## 4. The client hook

```ts
// src/features/review/components/review-queue/hooks/use-review-queue.ts
"use client";
import { useQuery } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";
import type { ReviewQueueItem } from "@/server/review/types";
import { reviewQueueCache } from "../../../queries";
import { reviewQueueParsers, type ReviewState } from "../../../search-params";

export interface UseReviewQueueReturn {
  items: ReviewQueueItem[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  state: ReviewState;
  selectState: (state: ReviewState) => void;
}

export function useReviewQueue(packSlug: string): UseReviewQueueReturn {
  const [params, setParams] = useQueryStates(reviewQueueParsers);   // shallow: true
  const query = useQuery(reviewQueueCache.options(packSlug, params));
  return {
    items: query.data ?? [],
    isLoading: query.isPending,
    isRefreshing: query.isFetching && !query.isPending,
    error: query.isError ? "Couldn't load the review queue." : null,
    state: params.state,
    selectState: (state) => void setParams({ state, page: 1 }),     // intent, not a setter
  };
}
```

- The URL change (shallow) changes `params` → changes the key → TanStack fetches. No effect,
  no manual refetch.
- `useQuery` for inline loading states; `useSuspenseQuery` when a `<Suspense>` above owns the
  loading UI. Independent suspense queries go in sibling components (or
  `useSuspenseQueries`), or they run as a waterfall.
- Add `placeholderData: keepPreviousData` when a filter change shouldn't blank the list.
- Map `query.error` to a user-facing string in the hook. Never render `error.message`.

## 5. Mutations — `useMutation` over a Server Action

The action (`actions.ts`): auth → re-parse with the shared schema → write → return
`ActionResult`. It may call `refresh()` / `updateTag()` for RSC data. It does not `redirect()`
on success.

```ts
// hooks/use-review-actions.ts
"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { approveItem } from "../../../actions";
import { reviewQueueCache } from "../../../queries";

export function useReviewActions(): UseReviewActionsReturn {
  const queryClient = useQueryClient();
  const approve = useMutation({
    mutationFn: approveItem,                       // (input: unknown) => Promise<ActionResult>
    onSuccess: (result) => {
      if (!result.ok) return;                      // result.error rendered via the return value
      return queryClient.invalidateQueries({ queryKey: reviewQueueCache.all });
    },
  });
  return {
    approve: (itemId: string) => approve.mutate({ itemId }),
    approvingId: approve.isPending ? approve.variables?.itemId ?? null : null,
    error: approve.data && !approve.data.ok ? approve.data.error : null,
  };
}
```

**Two failure channels, both handled.** A thrown error (network, 500) goes to `onError`. A
domain refusal comes back as `{ ok: false }` in `onSuccess`. Check `result.ok` every time.

### Keeping the screen in sync after a write

| The screen shows the changed data via… | After success |
|---|---|
| a TanStack query | `queryClient.invalidateQueries({ queryKey: xCache.all })`. Return the promise from `onSuccess` so `isPending` covers the refetch |
| RSC props (uncached, per-user) | `refresh()` inside the action, or `router.refresh()` in the hook |
| RSC props from a `use cache` + `cacheTag` read | `updateTag(xCache.tag(id))` inside the action |
| both | both. Server invalidation never touches the browser cache, and vice versa |
| a new page | `router.push(...)` in `onSuccess` (create flows; see `create-group-form`) |

### Optimistic updates (only when the latency is felt)

```ts
useMutation({
  mutationFn: approveItem,
  onMutate: async ({ itemId }) => {
    const key = reviewQueueCache.key(packSlug, params);
    await queryClient.cancelQueries({ queryKey: key });
    const previous = queryClient.getQueryData(key);
    queryClient.setQueryData(key, (old) => old?.filter((i) => i.id !== itemId));
    return { previous, key };
  },
  onError: (_e, _v, ctx) => ctx && queryClient.setQueryData(ctx.key, ctx.previous),
  onSettled: () => queryClient.invalidateQueries({ queryKey: reviewQueueCache.all }),
});
```

An `{ ok: false }` result must also roll back. Check it in `onSuccess` and restore
`previous`, the same as `onError`. Never optimistically update game state (memory, tree
stages, scores). It's computed by the engine from attempts and the DB grades answers; show a
pending state instead.

## 6. Anti-patterns

| Don't | Do |
|---|---|
| `useEffect` + `fetch` + `useState` | `useQuery(xCache.options(...))` |
| Inline `queryKey: ["x", id]` in a component | `xCache.options(id)` / `xCache.key(id)` |
| A Server Action as a `queryFn` | GET Route Handler. Actions run one at a time per client and POST |
| `new QueryClient()` in a component or hook | `useQueryClient()`; the provider owns the client |
| `fetch` from the client to Supabase directly | Route Handler → `src/server/**` (keeps RLS + DTO in one place) |
| `invalidateQueries()` with no key | invalidate the resource prefix (`xCache.all`) |
| `staleTime: 0` on a prefetched query | keep ≥ the default so hydration doesn't instantly refetch |
| Copying a query result into `useState` | read `query.data`; derive in the hook |
| `refetch()` after a mutation | `invalidateQueries` (refetches only what's mounted) |
| `use cache` on the read behind a learner's query | per-user = uncached, under `<Suspense>` |
| apiClient / axios patterns from other projects' skills | `fetch` to our Route Handler, `{ data }` envelope |
