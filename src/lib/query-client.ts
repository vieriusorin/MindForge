import {
  defaultShouldDehydrateQuery,
  environmentManager,
  QueryClient,
} from "@tanstack/react-query";

/**
 * One QueryClient factory for the whole app. Server prefetch and the browser provider both
 * go through here, so they share defaults (see `.claude/skills/tanstack-query`).
 *
 * - `staleTime` > 0 keeps a server-prefetched query from refetching the moment it hydrates.
 * - Pending queries are dehydrated too, so an RSC can start a prefetch without awaiting it
 *   and stream the result into `<HydrationBoundary>`.
 */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60_000 },
      dehydrate: {
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

/**
 * New client per server render (requests must never share a cache: the data is per learner),
 * one long-lived client in the browser (so a re-suspending render doesn't drop the cache).
 */
export function getQueryClient(): QueryClient {
  if (environmentManager.isServer()) return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}
