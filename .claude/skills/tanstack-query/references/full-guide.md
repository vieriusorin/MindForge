# TanStack Query (React Query v5): Full Guide

Library mechanics that work in any project. If the project already has a data-layer convention,
keep its layout and naming and apply these patterns inside it.

## Core Philosophy

1. **React Query is a server-state synchronization tool, NOT a data fetcher.** It manages the lifecycle (caching, deduplication, background refetching, stale detection). You provide the promise.
2. **Server state ≠ client state.** Never duplicate server data into `useState` or a global store. The query cache is the server-state manager.
3. **Co-locate everything.** Query keys, query functions and query options belong together in the feature's directory.
4. **Use `queryOptions()`.** Defining key, fn and options together through `queryOptions()` is the single most important pattern. It enables type-safe `getQueryData`, consistent prefetching and reliable invalidation.

---

## Architecture: Reference Folder Structure

```
src/
├── lib/
│   ├── http.ts                # shared fetch/axios wrapper (throws on non-2xx)
│   └── query-client.ts        # QueryClient factory + defaults (see advanced.md)
├── providers/
│   └── query-provider.tsx     # QueryClientProvider (client component)
└── features/
    └── todos/
        ├── types.ts
        ├── api.ts             # pure request functions: no React, no hooks, no keys
        ├── queries.ts         # queryOptions factory, THE key file
        ├── mutations.ts       # one useMutation hook per write
        └── components/
```

Common variations, all fine as long as they're applied consistently:

| Variation | Notes |
|---|---|
| `api.ts` folded into `queries.ts` | OK for small features. Keep request functions as named exports so mutations and tests reuse them |
| Generated SDK (OpenAPI, tRPC, GraphQL codegen) | The SDK replaces `api.ts`. Wrap its calls in `queryOptions` factories anyway, or use the generator's own `queryOptions` helpers |
| Framework route handlers / server functions as the backend | `queryFn` calls the endpoint. A server prefetch can call the underlying server read directly |
| Mutation hooks accepting `UseMutationOptions` overrides | OK. Merge carefully: spread caller options **first**, then compose `onSuccess` so the hook's invalidation is never overwritten |

---

## Layer 1: API Functions (Pure TypeScript)

No React, no hooks, no query keys. Each function owns one endpoint.

```typescript
// src/features/todos/api.ts
import { apiClient } from "@/api/client";
import type { Todo, CreateTodoInput, TodoFilters } from "./types";

export async function fetchTodos(filters: TodoFilters): Promise<Todo[]> {
  const { data } = await apiClient.get<Todo[]>("/todos", { params: filters });
  return data;
}

export async function fetchTodoById(id: number): Promise<Todo> {
  const { data } = await apiClient.get<Todo>(`/todos/${id}`);
  return data;
}

export async function createTodo(input: CreateTodoInput): Promise<Todo> {
  const { data } = await apiClient.post<Todo>("/todos", input);
  return data;
}

export async function updateTodo({ id, ...input }: { id: number } & Partial<Todo>): Promise<Todo> {
  const { data } = await apiClient.patch<Todo>(`/todos/${id}`, input);
  return data;
}

export async function deleteTodo(id: number): Promise<void> {
  await apiClient.delete(`/todos/${id}`);
}
```

---

## Layer 2: Query Factory with `queryOptions()` (Most Important Pattern)

One factory per feature. Keys go generic → specific. `queryOptions()` gives type-safe DataTag inference so `getQueryData` knows the return type automatically.

```typescript
// src/features/todos/queries.ts
import { queryOptions } from "@tanstack/react-query";
import { fetchTodos, fetchTodoById } from "./api";
import type { TodoFilters } from "./types";

export const todoQueries = {
  // Level 0: invalidate ALL todo queries
  all: () => ["todos"] as const,

  // Level 1: invalidate all list variants
  lists: () => [...todoQueries.all(), "list"] as const,

  // Level 2: specific list — full queryOptions
  list: (filters: TodoFilters) =>
    queryOptions({
      queryKey: [...todoQueries.lists(), filters] as const,
      queryFn: () => fetchTodos(filters),
      staleTime: 1000 * 60 * 5,
    }),

  // Level 1: invalidate all detail variants
  details: () => [...todoQueries.all(), "detail"] as const,

  // Level 2: specific detail — full queryOptions
  detail: (id: number) =>
    queryOptions({
      queryKey: [...todoQueries.details(), id] as const,
      queryFn: () => fetchTodoById(id),
      staleTime: 1000 * 60 * 10,
    }),
};
```

**Why this structure pays off:**

```typescript
// Type-safe getQueryData — no generic needed, inferred via DataTag
const todos = queryClient.getQueryData(todoQueries.list({ status: "all" }).queryKey);
//    ^? Todo[] | undefined — automatically inferred

// Surgical invalidation
queryClient.invalidateQueries({ queryKey: todoQueries.all() });      // everything
queryClient.invalidateQueries({ queryKey: todoQueries.lists() });    // only lists
queryClient.invalidateQueries({ queryKey: todoQueries.detail(1).queryKey }); // one item
```

---

## Layer 3: Using Queries in Components

With `queryOptions()` factories, components stay thin. Custom hooks are only needed when adding derived data or memoization.

```typescript
// ✅ Direct usage — no wrapper hook needed
function TodoList({ filters }: { filters: TodoFilters }) {
  const query = useQuery(todoQueries.list(filters));

  // Keep the query object intact for TypeScript narrowing
  if (query.isPending) return <TodoListSkeleton />;
  if (query.isError) return <ErrorDisplay error={query.error} />;

  return <ul>{query.data.map((todo) => <TodoItem key={todo.id} todo={todo} />)}</ul>;
}

// ✅ Suspense variant — same factory, different hook, data always defined
function TodoListSuspense({ filters }: { filters: TodoFilters }) {
  const { data: todos } = useSuspenseQuery(todoQueries.list(filters));
  return <ul>{todos.map((todo) => <TodoItem key={todo.id} todo={todo} />)}</ul>;
}

// ✅ select — component re-renders only when the selected slice changes
function TodoCount({ filters }: { filters: TodoFilters }) {
  const { data: count } = useQuery({
    ...todoQueries.list(filters),
    select: (todos) => todos.length,
  });
  return <span>Total: {count ?? 0}</span>;
}

// ✅ Custom hook — justified only when adding derived/memoized data
export function useTodoStats(filters: TodoFilters) {
  const query = useQuery(todoQueries.list(filters));
  const stats = useMemo(() => {
    if (!query.data) return null;
    return {
      total: query.data.length,
      completed: query.data.filter((t) => t.completed).length,
    };
  }, [query.data]);
  return { ...query, stats };
}
```

> **Don't destructure query results** when you need TypeScript narrowing. `const { data, isPending }` leaves `data` as `T | undefined` even after the `isPending` check. Keep `const query = useQuery(...)` and use `query.isSuccess` / `query.data` to get correct narrowing.

---

## Layer 4: Mutations

One hook per action. Use the query factory for invalidation — never string literals.

```typescript
// src/features/todos/mutations.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createTodo, updateTodo, deleteTodo } from "./api";
import { todoQueries } from "./queries";

export function useCreateTodo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createTodo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: todoQueries.lists() });
    },
  });
}

export function useUpdateTodo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateTodo,
    onSuccess: (updatedTodo) => {
      // Write directly to cache — avoids an extra network round-trip
      queryClient.setQueryData(todoQueries.detail(updatedTodo.id).queryKey, updatedTodo);
      queryClient.invalidateQueries({ queryKey: todoQueries.lists() });
    },
  });
}

export function useDeleteTodo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteTodo,
    onSuccess: (_data, deletedId) => {
      queryClient.removeQueries({ queryKey: todoQueries.detail(deletedId).queryKey });
      queryClient.invalidateQueries({ queryKey: todoQueries.lists() });
    },
  });
}
```

**Using mutations in components** — prefer `mutate` + callbacks over `mutateAsync` + try/catch:

```typescript
function CreateTodoForm() {
  const createTodo = useCreateTodo();
  const [title, setTitle] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createTodo.mutate(
      { title },
      {
        onSuccess: () => { setTitle(""); toast.success("Created!"); },
        onError: (err) => toast.error(err.message),
      }
    );
  };

  return (
    <form onSubmit={handleSubmit}>
      <input value={title} onChange={(e) => setTitle(e.target.value)} />
      <button type="submit" disabled={createTodo.isPending}>
        {createTodo.isPending ? "Creating..." : "Create"}
      </button>
    </form>
  );
}
```

> For optimistic updates, see `references/advanced.md`.

---

## v5-Specific Patterns

### `skipToken` — type-safe conditional queries

In v5, use `skipToken` instead of `enabled: false` when a parameter might be undefined. It is type-safe (no `id!` inside `queryFn`) and keeps the condition inside the factory:

```typescript
import { queryOptions, skipToken, useQuery } from "@tanstack/react-query";

export const todoQueries = {
  // ...
  byUser: (userId: number | undefined) =>
    queryOptions({
      queryKey: [...todoQueries.all(), "byUser", userId] as const,
      queryFn: userId !== undefined ? () => fetchTodosByUser(userId) : skipToken,
    }),
};

// In the component: no `enabled` needed
const query = useQuery(todoQueries.byUser(userId));
```

> `skipToken` disables the query, so `refetch()` will not run it. If the user must be able to trigger the query manually, use `enabled` instead.

### `placeholderData` — smooth pagination UX

In v5, `keepPreviousData` was replaced by `placeholderData: keepPreviousData`. Keep the previous page's data visible while the next page loads:

```typescript
import { useQuery, keepPreviousData } from "@tanstack/react-query";

function TodoPaginated({ page }: { page: number }) {
  const query = useQuery({
    ...todoQueries.list({ page }),
    placeholderData: keepPreviousData, // ← v5 API
  });

  return (
    <div>
      {/* data is always defined — shows previous page while next loads */}
      <TodoList todos={query.data ?? []} />
      {query.isFetching && <span>Loading page {page}...</span>}
    </div>
  );
}
```

### `useInfiniteQuery` — infinite scroll

```typescript
import { infiniteQueryOptions, useInfiniteQuery } from "@tanstack/react-query";

const infiniteTodoOptions = (filters: Omit<TodoFilters, "page">) =>
  infiniteQueryOptions({
    queryKey: [...todoQueries.lists(), "infinite", filters] as const,
    queryFn: ({ pageParam }) => fetchTodos({ ...filters, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, _allPages, lastPageParam) =>
      lastPage.length === 0 ? undefined : lastPageParam + 1,
  });

function InfiniteTodoList({ filters }: { filters: Omit<TodoFilters, "page"> }) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery(infiniteTodoOptions(filters));

  return (
    <div>
      {data?.pages.flatMap((page) => page.map((todo) => (
        <TodoItem key={todo.id} todo={todo} />
      )))}
      <button
        onClick={() => fetchNextPage()}
        disabled={!hasNextPage || isFetchingNextPage}
      >
        {isFetchingNextPage ? "Loading..." : hasNextPage ? "Load more" : "No more todos"}
      </button>
    </div>
  );
}
```

---

## Dependent Queries

```typescript
function TodoWithUser({ todoId }: { todoId: number }) {
  const todoQuery = useQuery(todoQueries.detail(todoId));

  // The factory takes `number | undefined` and uses skipToken, so it runs once userId exists
  const userQuery = useQuery(userQueries.detail(todoQuery.data?.userId));

  if (todoQuery.isPending) return <Loading />;
  if (todoQuery.isError) return <Error error={todoQuery.error} />;

  return (
    <div>
      <h1>{todoQuery.data.title}</h1>
      <p>By: {userQuery.data?.name ?? "Loading..."}</p>
    </div>
  );
}
```

> Dependent queries create a waterfall. If the server can return both in one request, or the
> page can prefetch both in parallel, do that instead.

---

## Prefetching

The `queryOptions()` pattern means the same options work in hooks AND imperative prefetch calls:

```typescript
// Route loader (React Router / TanStack Router)
export const todoDetailLoader = (queryClient: QueryClient) =>
  async ({ params }: { params: { id: string } }) => {
    await queryClient.ensureQueryData(todoQueries.detail(Number(params.id)));
    return null;
  };

// Hover prefetch
function TodoItem({ todo }: { todo: Todo }) {
  const queryClient = useQueryClient();
  return (
    <Link
      to={`/todos/${todo.id}`}
      onMouseEnter={() => queryClient.prefetchQuery(todoQueries.detail(todo.id))}
    >
      {todo.title}
    </Link>
  );
}
```

---

## SSR / Server Components: Prefetch + Hydrate

The same `queryOptions` factory is used on the server to prefetch and on the client to read.
The shape is the same in every framework:

```tsx
// Server (route loader, getServerSideProps, or an async React Server Component)
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { makeQueryClient } from "@/lib/query-client";

export default async function TodosPage() {
  const queryClient = makeQueryClient(); // a NEW client per request on the server
  await queryClient.prefetchQuery(todoQueries.list({ status: "all" }));

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <TodoList filters={{ status: "all" }} /> {/* client component calling useQuery */}
    </HydrationBoundary>
  );
}
```

Rules:
- **Server:** a fresh `QueryClient` per request, never a module-level singleton (it would leak data between users).
- **Browser:** exactly one client for the app's lifetime (see `advanced.md`).
- Set a non-zero default `staleTime` (e.g. 60s) so the client doesn't refetch the moment it hydrates.
- Every key input the client uses (filters, page, search params) must match what the server prefetched, or the client misses the cache and fetches again.
- On the server, `queryFn` may call the data source directly instead of going over HTTP to its own API. Override `queryFn` on the server side and keep the same `queryKey`: `prefetchQuery({ ...todoQueries.list(f), queryFn: () => db.todos.list(f) })`.
- To stream pending queries (RSC + Suspense), configure `dehydrate.shouldDehydrateQuery` to include pending queries and skip the `await`. Check the current docs for the framework integration before relying on it.

---

## Error Handling: Check Data First

React Query retries 3× by default. If you check `isError` first, the user waits ~6 seconds then sees an error. If you check `data` first, they see stale data while retrying.

```typescript
function TodoList({ filters }: { filters: TodoFilters }) {
  const query = useQuery(todoQueries.list(filters));

  if (query.data) {
    return (
      <>
        <List todos={query.data} />
        {query.isError && <Banner>Couldn't refresh — showing cached data.</Banner>}
      </>
    );
  }

  if (query.isPending) return <Skeleton />;
  return <ErrorFallback error={query.error} onRetry={() => query.refetch()} />;
}
```

> For Error Boundaries with `QueryErrorResetBoundary` and `useSuspenseQuery`, see `references/advanced.md`.

---

## TypeScript Rules

```typescript
// ❌ Manual generics — can desync from queryFn
const { data } = useQuery<Todo[], Error>({ queryKey: ["todos"], queryFn: fetchTodos });

// ✅ Let queryOptions() infer everything via DataTag
const { data } = useQuery(todoQueries.list(filters));
//       ^? Todo[] — always in sync with fetchTodos return type

// ❌ Destructured — TypeScript can't narrow data
const { data, isPending } = useQuery(todoQueries.list(filters));
if (!isPending) { data; } // still Todo[] | undefined

// ✅ Keep query object intact for narrowing
const query = useQuery(todoQueries.list(filters));
if (query.isSuccess) { query.data; } // Todo[] ← correctly narrowed
```

---

## Quick Reference: Decision Tree

| Situation | Pattern |
|---|---|
| Fetch data in a component | `useQuery(featureQueries.xxx())` directly |
| Share config between prefetch + query | `queryOptions()` in factory |
| Derived/computed data | Custom hook with `useMemo`, or `select` |
| Create / update / delete | `useMutation` hook per action |
| Invalidate after mutation | `invalidateQueries({ queryKey: factory.lists() })` |
| Type-safe `getQueryData` | Pass `factory.xxx().queryKey` — DataTag infers type |
| Suspense loading UI | `useSuspenseQuery` + same factory |
| Prefetch on hover / route | `queryClient.prefetchQuery(factory.xxx())` |
| Parallel queries (dynamic count) | `useQueries` with factory entries |
| Query depends on another | `skipToken` in the factory (or `enabled`) |
| SSR / RSC initial data | `prefetchQuery` + `dehydrate` + `HydrationBoundary` |
| Conditional query (undefined param) | `skipToken` in queryFn |
| Pagination with smooth UX | `placeholderData: keepPreviousData` |
| Infinite scroll | `useInfiniteQuery` + `infiniteQueryOptions` |
| Optimistic update | See `references/advanced.md` |

---

## Anti-Patterns Cheat Sheet

| ❌ Don't | ✅ Do |
|---|---|
| Global `queryKeys.ts` | Co-locate keys + fn in feature `queries.ts` |
| Copy server data into `useState` | Use query result as source of truth |
| Wrapper hooks that only call `useQuery` | Use `useQuery(factory.xxx())` directly |
| Pass generic types to `useQuery<T>` | Let `queryOptions()` infer via DataTag |
| `mutateAsync` + try/catch for simple cases | `mutate` + `onSuccess`/`onError` callbacks |
| Generic `useApiQuery(url)` abstraction | Specific query factories per feature |
| `refetch()` after mutations | `invalidateQueries()` — it's smarter |
| `staleTime: 0` everywhere (default) | Configure appropriate `staleTime` per query |
| Check `isError` before `data` | Check `data` first — show stale during retries |
| `useEffect` to sync query data to state | Use `select` for transformations |
| `enabled: false` for undefined params | Use `skipToken` (v5) — type-safe |
| `keepPreviousData: true` (v4 API) | `placeholderData: keepPreviousData` (v5) |

---

## Advanced Patterns

See `references/advanced.md` for:
- Optimistic updates with rollback
- QueryClient configuration + global error handling
- QueryProvider setup
- Error Boundaries with `QueryErrorResetBoundary`
- Testing utilities (`createTestQueryClient`, `createWrapper`)
