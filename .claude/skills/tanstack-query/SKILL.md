---
name: tanstack-query
description: >
  TanStack Query (React Query v5) patterns for React + TypeScript apps.
  Use this skill whenever writing data fetching, caching, or server state code —
  including useQuery, useMutation, queryOptions factories, cache invalidation,
  optimistic updates, prefetching, Suspense, infinite lists and SSR hydration.
  Triggers: "how do I fetch data", "useQuery hook", "cache after mutation", "invalidate queries".
allowed-tools: [Read]
---

# TanStack Query (React Query v5): Quick Reference

> **Project rules win.** This skill works in any project and is not tied to one. If the project has
> its own data-layer skill, `CLAUDE.md`/`AGENTS.md` rules, or an existing `queries.ts`
> convention, follow that and use this file only for the library mechanics.

## Supporting Files

- `template.md`: boilerplate for `api.ts`, `queries.ts`, `mutations.ts`, `types.ts`
- `examples/sample.md`: an annotated end-to-end feature example
- `references/full-guide.md`: queryOptions factories, Suspense, select, pagination, infinite, prefetch, SSR
- `references/advanced.md`: optimistic updates, QueryClient config, provider, error boundaries, testing
- `scripts/validate.mjs`: heuristic checker for common mistakes (tell the developer to run it)

---

## Before Writing Anything: Discover the Project

1. Check whether `@tanstack/react-query` is installed and which major version (`package.json`).
2. Find the existing `QueryClient` and provider. **Never create a second client.**
3. Find the HTTP layer (a shared fetch wrapper, axios instance, generated SDK, RPC client, or framework
   route handlers) and use it. Don't add a new one.
4. Find where existing queries live (`features/<f>/queries.ts`, `api/<domain>/`, `hooks/`…) and
   follow that layout and naming.
5. In frameworks with server rendering (Next.js App Router, Remix, TanStack Start), decide first
   whether the data belongs in a server read. Use TanStack Query for **server state the client
   must refetch, poll, paginate, or update optimistically**. Don't use it for data that is only
   needed on the first render.

---

## Key Rules Checklist

- [ ] Define every query once with `queryOptions()` in a per-feature factory. Components call
      `useQuery(featureQueries.x(args))`, with no inline `queryKey` arrays.
- [ ] Order keys from generic to specific, e.g. `['todos', 'list', filters]` or `['todos', 'detail', id]`.
- [ ] Put **every input that changes the result** in the key (filters, page, search, locale, user scope).
- [ ] `queryFn` must **reject on failure**. `fetch` does not throw on 4xx/5xx, so check `res.ok`.
- [ ] Handle conditional queries with `skipToken` (type-safe), or `enabled: !!id` when skipToken doesn't fit.
- [ ] Set `staleTime` deliberately, either globally or per query. The default `0` refetches on every mount and focus.
- [ ] After a mutation, call `invalidateQueries` using the factory's prefix keys, or `setQueryData` when the response is the new state.
- [ ] Never copy query data into `useState`. The cache is the source of truth, and `select` handles derivations.
- [ ] Let `queryOptions()` infer types. Don't pass `useQuery<T>()` generics by hand.
- [ ] Keep the query object intact (`query.isSuccess && query.data`) when you need type narrowing.

---

## v4 → v5 Changes That Still Show Up in Generated Code

| v4 | v5 |
|---|---|
| `useQuery(key, fn, opts)` | `useQuery({ queryKey, queryFn, ...opts })` (object form only) |
| `cacheTime` | `gcTime` |
| `isLoading` (no data yet) | `isPending` (`isLoading` = `isPending && isFetching`) |
| `keepPreviousData: true` | `placeholderData: keepPreviousData` |
| `onSuccess`/`onError`/`onSettled` on `useQuery` | removed: use `select`, effects on data, or `QueryCache` callbacks |
| `enabled: false` for a missing param | `queryFn: skipToken` |
| `useErrorBoundary` | `throwOnError` |
| `status: 'loading'` | `status: 'pending'` |
| Manual `useQuery<T>` generics | `queryOptions()` infers via `DataTag` |

---

## Query Factory Skeleton

```typescript
// features/todos/queries.ts
import { queryOptions, skipToken } from '@tanstack/react-query';
import { fetchTodo, fetchTodos } from './api';
import type { TodoFilters } from './types';

export const todoQueries = {
  all: () => ['todos'] as const,
  lists: () => [...todoQueries.all(), 'list'] as const,
  list: (filters: TodoFilters) =>
    queryOptions({
      queryKey: [...todoQueries.lists(), filters] as const,
      queryFn: () => fetchTodos(filters),
    }),
  details: () => [...todoQueries.all(), 'detail'] as const,
  detail: (id: string | undefined) =>
    queryOptions({
      queryKey: [...todoQueries.details(), id] as const,
      queryFn: id ? () => fetchTodo(id) : skipToken,
    }),
};

// component
const query = useQuery(todoQueries.list(filters));
```

## Mutation Hook Skeleton

```typescript
// features/todos/mutations.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createTodo } from './api';
import { todoQueries } from './queries';

export function useCreateTodo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createTodo,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: todoQueries.lists() }),
  });
}

// component: per-call callbacks for UI side effects (toast, close dialog, navigate)
createTodo.mutate(input, { onSuccess: () => toast.success('Created') });
```

---

## Anti-Patterns

| Avoid | Use instead |
|---|---|
| Inline `queryKey: ['todos', id]` scattered across components | One `queryOptions` factory per feature |
| `fetch` without checking `res.ok` | Throw on non-2xx so `isError`/retries work |
| Copying query data into `useState` / `useEffect` sync | Read the query result; derive with `select` |
| `refetch()` after mutations | `invalidateQueries()` by prefix |
| Wrapper hooks that only call `useQuery` | `useQuery(factory.x())` directly |
| Checking `isError` before `data` | Check `data` first, so stale data shows while retrying |
| A generic `useApiQuery(url)` abstraction | Specific factories per feature |
| `new QueryClient()` inside a component body | One client created once (see `references/advanced.md`) |
| `try/catch` in `queryFn` that only rethrows | Let the promise reject |
| Retrying mutations by default | `mutations: { retry: 0 }` (writes aren't idempotent) |

---

## After Writing Hooks

Tell the developer to run the heuristic validator from the project root:

```bash
node .claude/skills/tanstack-query/scripts/validate.mjs [path-filter]
# e.g.
node .claude/skills/tanstack-query/scripts/validate.mjs features/todos
```
