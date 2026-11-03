---
name: nuqs-typescript-zod
description: MindForge URL state with nuqs 2 + zod on Next.js 16 (Cache Components) — the per-feature search-params.ts (parsers, createLoader, createSerializer, inferred types) imported from nuqs/server because the bare nuqs entry is "use client"; parseAsStringLiteral sharing literals with zod enums; useQueryStates in the component hook with intent-named callbacks; shallow true vs false (client query vs RSC read); the mandatory Suspense boundary that dev mode hides and next build enforces; debounce for search; typed links; testing loaders; anti-patterns. Load for any filter, tab, sort, page, search box or selected-id that should survive reload, back button or a shared link.
---

# URL state with nuqs

Contract: `.claude/rules/state-and-data.md` §1 and §5. **Installed:** `nuqs` 2.10.
**Wired:** `NuqsAdapter` (from `nuqs/adapters/next/app`) in `src/components/app-providers.tsx`.
Defaults that matter: `shallow: true`, `clearOnDefault: true`, `history: "replace"`,
`scroll: false`.

**Use nuqs when** the state should survive a reload, the back button, or a link pasted to a
groupmate: filters, tabs, sort, page number, search text, a selected item id. **Don't use
it** for ephemeral UI (popover open, hover) or for form input. Those are `useState` and RHF.

## 0. The import rule, which is the trap

| File | Import from |
|---|---|
| `search-params.ts`, `queries.ts`, page, Route Handler: anything a Server Component touches | **`nuqs/server`** |
| `hooks/use-<name>.ts` (`useQueryState`, `useQueryStates`) | `nuqs` |

The bare `nuqs` entry starts with `"use client"`. Import `parseAsInteger` or `createLoader`
from it into a server file and you get client references, not functions: it fails at runtime
on the server. `nuqs/server` has no directive and exports every parser, `createLoader`,
`createSerializer` and `createSearchParamsCache`. It's safe in client code too.

## 1. `src/features/<f>/search-params.ts`: declared once

```ts
// src/features/review/search-params.ts   (illustrative — the review feature is not built yet)
import {
  createLoader, createSerializer, debounce, type inferParserType,
  parseAsInteger, parseAsString, parseAsStringLiteral,
} from "nuqs/server";
import { z } from "zod";

// One literal list, shared by the URL parser and by zod (action input, Route Handler).
export const REVIEW_STATES = ["unreviewed", "approved", "flagged", "rejected"] as const;
export const ReviewState = z.enum(REVIEW_STATES);
export type ReviewState = z.infer<typeof ReviewState>;

export const reviewQueueParsers = {
  state: parseAsStringLiteral(REVIEW_STATES).withDefault("unreviewed"),
  domain: parseAsString,                                         // nullable: "all domains"
  q: parseAsString.withDefault("").withOptions({ limitUrlUpdates: debounce(300) }),
  page: parseAsInteger.withDefault(1),
};

export const reviewQueueUrlKeys = { domain: "d" } as const;      // optional short keys

export type ReviewQueueParams = inferParserType<typeof reviewQueueParsers>;
export const loadReviewQueueParams = createLoader(reviewQueueParsers, { urlKeys: reviewQueueUrlKeys });
export const serializeReviewQueue = createSerializer(reviewQueueParsers, { urlKeys: reviewQueueUrlKeys });
```

- Every param has a default, or is deliberately nullable. An unparsable value
  (`?state=banana`, `?page=x`) falls back to the default, so the URL can never crash the page.
  Parsing isn't range-checking: `?page=-3` parses to `-3`. Clamp in the server read (or
  use a custom `createParser`).
- Use literal unions (`parseAsStringLiteral`) for anything enumerable. Never `parseAsString`
  + a cast.
- Use flat params. Reach for `parseAsJson(ZodSchema)` (it accepts a Standard Schema) only for
  a genuinely structured value. JSON in a URL is ugly and fragile.
- `inferParserType` is the type. Don't redeclare it.

## 2. Reading in a Server Component (`shallow: false` params)

```tsx
// page.tsx
async function QueueSlot({ searchParams }: PageProps<"/review/[packSlug]">) {
  const { state, domain, page } = await loadReviewQueueParams(searchParams); // async overload
  const items = await listReviewQueue(packSlug, { state, domain, page });
  return <ReviewQueueView items={items} />;
}
export default function Page(props: PageProps<"/review/[packSlug]">) {
  return <Suspense fallback={<QueueSkeleton />}><QueueSlot {...props} /></Suspense>;
}
```

`searchParams` is request data, so the read sits under `<Suspense>` (Cache Components).

## 3. Writing from the client: in the component's hook

```ts
// hooks/use-review-filters.ts
"use client";
import { useQueryStates } from "nuqs";
import { useTransition } from "react";
import { reviewQueueParsers, reviewQueueUrlKeys, type ReviewState } from "../../../search-params";

export function useReviewFilters(): UseReviewFiltersReturn {
  const [isPending, startTransition] = useTransition();
  const [params, setParams] = useQueryStates(reviewQueueParsers, {
    urlKeys: reviewQueueUrlKeys,
    shallow: false,          // ← the RSC reads these, so ask the server to re-render
    startTransition,         // ← gives a pending flag while the server render streams
  });
  return {
    ...params,
    isPending,
    selectState: (state: ReviewState) => void setParams({ state, page: 1 }),  // reset paging
    search: (q: string) => void setParams({ q, page: 1 }),
    goToPage: (page: number) => void setParams({ page }),
    clear: () => void setParams(null),                                        // all → defaults
  };
}
```

- Expose **intent** (`selectState`, `goToPage`), never `setParams` itself
  (`react-client-patterns.md`: no setters in a hook return).
- Changing a filter resets `page` to 1, in the same `setParams` call (one history entry).
- `history: "push"` only for state the back button should step through (tabs a user
  navigates between). Filters keep the default `replace`.

### `shallow: true` or `false`

| Who consumes the param | Option | What happens |
|---|---|---|
| A TanStack query (key contains the params) | `shallow: true` (default) | URL updates, key changes, the query refetches. No RSC render |
| The RSC page (`loadX(searchParams)`) | `shallow: false` (+ `startTransition`) | URL updates, the server re-renders the page |
| Only client UI (tab panel already loaded) | `shallow: true` | URL updates, nothing else |

Pick one per param. Never both an RSC read and a TanStack query on the same param: two
fetches, two sources of truth. Combined example: `client-data-tanstack-query` §1 and §4.

## 4. Suspense: mandatory, and dev won't warn you

Every client component that calls `useQueryState(s)` reads `useSearchParams` under the hood.
On a prerendered route, Next requires a `<Suspense>` above it. **`pnpm dev` renders fine
without one; `pnpm build` fails** ("Missing Suspense boundary with useSearchParams"). Put
the boundary in the page, around the smallest client subtree that reads the URL:

```tsx
<Suspense fallback={<FiltersSkeleton />}>
  <ReviewFilters />
</Suspense>
```

## 5. Links that carry state

```tsx
<Link href={`/review/${packSlug}${serializeReviewQueue({ state: "flagged" })}`}>Flagged</Link>
```

Use the serializer. It applies `urlKeys`, drops defaults and encodes correctly. Never
template `?state=${x}` by hand.

## 6. Testing

Loaders and serializers are pure, so test them in the feature's `__tests__/`. The cases that
matter are the fallbacks:

```ts
import { loadReviewQueueParams, serializeReviewQueue } from "../search-params";

it("falls back to defaults on garbage", () => {
  expect(loadReviewQueueParams("?state=banana&page=x")).toEqual({
    state: "unreviewed", domain: null, q: "", page: 1,
  });
});
it("drops defaults from links", () => {
  expect(serializeReviewQueue({ state: "unreviewed", page: 2 })).toBe("?page=2");
});
```

## 7. Anti-patterns

| Don't | Do |
|---|---|
| `useState` for a filter / tab / page | parser in `search-params.ts` + `useQueryStates` |
| `useSearchParams()` + `new URLSearchParams` + `router.push` | `setParams({...})` |
| Parsers declared inline in a component | `search-params.ts`, imported by page, hook, Route Handler |
| `import { parseAsX } from "nuqs"` in a shared/server file | `from "nuqs/server"` |
| `parseAsString` then `as ReviewState` | `parseAsStringLiteral(REVIEW_STATES)` |
| `useQueryStates` with no `<Suspense>` above | boundary in the page (build fails otherwise) |
| A param read by both an RSC and a TanStack key | choose one consumer |
| `?page=` left unchanged when a filter changes | reset `page: 1` in the same update |
| Returning `setParams` from the hook | intent-named callbacks |
| Debounce implemented with `setTimeout` in a hook | `limitUrlUpdates: debounce(300)` on the parser |
