# TanStack Query: Feature Template

Boilerplate for a new feature's data layer. Replace `[feature]` / `[Resource]` and **adapt the
paths and the HTTP helper to the project's existing conventions**. If the project already has a
fetch wrapper, axios instance, generated SDK or RPC client, use it in `api.ts` instead of
`httpJson` below.

```
src/features/[feature]/
├── types.ts       # input + response types
├── api.ts         # pure request functions: no React, no hooks, no keys
├── queries.ts     # queryOptions factory, the single source of query keys
└── mutations.ts   # one useMutation hook per write
```

---

## File 1: `types.ts`

```typescript
// Inputs are plain (callers build them)
export type [Resource]Filters = {
  page: number;
  pageSize: number;
  search?: string;
  // ...other filter fields
};

export type Create[Resource]Input = {
  // ...fields
};

export type Update[Resource]Input = { id: string } & Partial<Create[Resource]Input>;

// Responses are Readonly (server data is never mutated in place)
export type [Resource] = Readonly<{
  id: string;
  // ...fields
}>;

export type [Resource]Page = Readonly<{
  items: readonly [Resource][];
  total: number;
}>;
```

---

## File 2: `api.ts`

```typescript
import type {
  [Resource],
  [Resource]Filters,
  [Resource]Page,
  Create[Resource]Input,
  Update[Resource]Input,
} from './types';

const BASE = '/api/[feature]';

// Minimal helper. Replace with the project's shared HTTP client if one exists.
async function httpJson<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? `${res.status} ${res.statusText}`);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

function toSearchParams(filters: [Resource]Filters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  return params.toString();
}

export const fetch[Resource]Page = (filters: [Resource]Filters, signal?: AbortSignal) =>
  httpJson<[Resource]Page>(`${BASE}?${toSearchParams(filters)}`, { signal });

export const fetch[Resource] = (id: string, signal?: AbortSignal) =>
  httpJson<[Resource]>(`${BASE}/${id}`, { signal });

export const create[Resource] = (input: Create[Resource]Input) =>
  httpJson<[Resource]>(BASE, { method: 'POST', body: JSON.stringify(input) });

export const update[Resource] = ({ id, ...input }: Update[Resource]Input) =>
  httpJson<[Resource]>(`${BASE}/${id}`, { method: 'PATCH', body: JSON.stringify(input) });

export const delete[Resource] = (id: string) =>
  httpJson<void>(`${BASE}/${id}`, { method: 'DELETE' });
```

---

## File 3: `queries.ts`

```typescript
import { keepPreviousData, queryOptions, skipToken } from '@tanstack/react-query';
import { fetch[Resource], fetch[Resource]Page } from './api';
import type { [Resource]Filters } from './types';

export const [resource]Queries = {
  all: () => ['[feature]'] as const,

  lists: () => [...[resource]Queries.all(), 'list'] as const,
  list: (filters: [Resource]Filters) =>
    queryOptions({
      queryKey: [...[resource]Queries.lists(), filters] as const,
      queryFn: ({ signal }) => fetch[Resource]Page(filters, signal),
      placeholderData: keepPreviousData, // keeps the previous page visible while the next loads
    }),

  details: () => [...[resource]Queries.all(), 'detail'] as const,
  detail: (id: string | undefined) =>
    queryOptions({
      queryKey: [...[resource]Queries.details(), id] as const,
      queryFn: id ? ({ signal }) => fetch[Resource](id, signal) : skipToken,
      staleTime: 5 * 60 * 1000, // tune per resource
    }),
};
```

---

## File 4: `mutations.ts`

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { create[Resource], delete[Resource], update[Resource] } from './api';
import { [resource]Queries } from './queries';

export function useCreate[Resource]() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: create[Resource],
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [resource]Queries.lists() }),
  });
}

export function useUpdate[Resource]() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: update[Resource],
    onSuccess: (updated) => {
      queryClient.setQueryData([resource]Queries.detail(updated.id).queryKey, updated);
      return queryClient.invalidateQueries({ queryKey: [resource]Queries.lists() });
    },
  });
}

export function useDelete[Resource]() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: delete[Resource],
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: [resource]Queries.detail(id).queryKey });
      return queryClient.invalidateQueries({ queryKey: [resource]Queries.lists() });
    },
  });
}
```

> Returning the `invalidateQueries` promise from `onSuccess` keeps the mutation `isPending` until
> the refetch finishes, so the UI never flashes stale data.

---

## Component Usage Checklist

- [ ] `useQuery([resource]Queries.list(filters))`, with no inline keys
- [ ] Use `isPending` for the first load and `isFetching` for background refetches (v5 names)
- [ ] Render `data` first if it exists, then pending, then error
- [ ] Put UI side effects (toast, close dialog, navigate) in per-call `mutate(input, { onSuccess })`
      and cache side effects in the hook
- [ ] Use `mutateAsync` only when you must `await` (then handle the rejection)
- [ ] Never copy `data` into `useState`, and never call `refetch()` after a mutation
