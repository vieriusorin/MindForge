# TanStack Query — Advanced Patterns

## Optimistic Updates

Use when UX demands instant feedback. The pattern: cancel → snapshot → update → rollback on error → always refetch on settle.

```typescript
export function useToggleTodo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, completed }: { id: number; completed: boolean }) =>
      updateTodo({ id, completed }),

    onMutate: async ({ id, completed }) => {
      // 1. Cancel outgoing refetches (prevent race condition)
      await queryClient.cancelQueries({ queryKey: todoQueries.detail(id).queryKey });

      // 2. Snapshot for rollback
      const previousTodo = queryClient.getQueryData(todoQueries.detail(id).queryKey);

      // 3. Optimistically update cache
      queryClient.setQueryData(todoQueries.detail(id).queryKey, (old) =>
        old ? { ...old, completed } : old
      );

      return { previousTodo };
    },

    onError: (_error, { id }, context) => {
      // Rollback to snapshot
      if (context?.previousTodo) {
        queryClient.setQueryData(todoQueries.detail(id).queryKey, context.previousTodo);
      }
    },

    onSettled: (_data, _error, { id }) => {
      // Always refetch to ensure cache matches server
      queryClient.invalidateQueries({ queryKey: todoQueries.detail(id).queryKey });
      queryClient.invalidateQueries({ queryKey: todoQueries.lists() });
    },
  });
}
```

---

## QueryClient Configuration

```typescript
// src/lib/query-client.ts
import { isServer, MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { notifyError } from "@/lib/notify"; // ← whatever toast/notification the project uses

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,            // >0 avoids an immediate refetch after SSR hydration
        gcTime: 5 * 60 * 1000,           // kept in cache 5 min after the last observer unmounts
        retry: 2,
        refetchOnWindowFocus: process.env.NODE_ENV === "production",
      },
      mutations: {
        retry: 0,                        // writes are not idempotent
      },
    },
    queryCache: new QueryCache({
      onError: (error, query) => {
        // Notify only for background refetch failures (the UI already shows data)
        if (query.state.data !== undefined) notifyError(`Background update failed: ${error.message}`);
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _vars, _ctx, mutation) => {
        // Global fallback. Skip it when the call site handles errors itself
        if (!mutation.options.onError) notifyError(error.message);
      },
    }),
  });
}

// One client in the browser, a fresh one per request on the server
let browserClient: QueryClient | undefined;
export function getQueryClient() {
  if (isServer) return makeQueryClient();
  browserClient ??= makeQueryClient();
  return browserClient;
}
```

---

## QueryProvider Setup

```tsx
// src/providers/query-provider.tsx
"use client"; // needed only in React Server Components frameworks (e.g. Next.js App Router)

import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import type { ReactNode } from "react";
import { getQueryClient } from "@/lib/query-client";

export function QueryProvider({ children }: { children: ReactNode }) {
  // Not useState: if a Suspense boundary above suspends on the first render, React throws away
  // the state, and a client held in useState would be created again. getQueryClient() keeps one
  // per browser session.
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

> In a pure client-side SPA (Vite, CRA) a module-level `const queryClient = makeQueryClient()` is
> also fine. In tests, create a new client per test (below).

---

## Error Boundaries with useSuspenseQuery

```typescript
import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";

function TodoPage() {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary onReset={reset} FallbackComponent={ErrorFallback}>
          <Suspense fallback={<Skeleton />}>
            <TodoList />  {/* Uses useSuspenseQuery — data always defined */}
          </Suspense>
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}
```

---

## Testing Utilities

```typescript
// test-utils.ts
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,      // Don't retry in tests — fail fast
        gcTime: Infinity,  // Don't garbage collect during test runs
      },
    },
  });
}

export function createWrapper() {
  const queryClient = createTestQueryClient();
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

// Usage in tests (requires @testing-library/react):
// const { result } = renderHook(() => useTodos(), { wrapper: createWrapper() });
```
