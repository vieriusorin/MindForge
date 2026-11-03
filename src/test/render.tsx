import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  type RenderHookOptions,
  type RenderHookResult,
  type RenderOptions,
  type RenderResult,
  render,
  renderHook,
} from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import type { ReactElement, ReactNode } from "react";
import { makeQueryClient } from "@/lib/query-client";

/** The app's own client defaults, minus retries, so a failing call fails the test at once. */
export function makeTestQueryClient(): QueryClient {
  const client = makeQueryClient();
  const defaults = client.getDefaultOptions();
  client.setDefaultOptions({
    ...defaults,
    queries: { ...defaults.queries, retry: false },
    mutations: { ...defaults.mutations, retry: false },
  });
  return client;
}

function providers(client: QueryClient) {
  return function Providers({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

export interface RenderWithProvidersResult extends RenderResult {
  user: UserEvent;
  queryClient: QueryClient;
}

/** Render a component inside the app's providers, with a `user-event` instance. */
export function renderWithProviders(
  ui: ReactElement,
  options: Omit<RenderOptions, "wrapper"> = {},
): RenderWithProvidersResult {
  const queryClient = makeTestQueryClient();
  const user = userEvent.setup();
  const result = render(ui, { wrapper: providers(queryClient), ...options });
  return { ...result, user, queryClient };
}

/** Render a hook inside the app's providers. */
export function renderHookWithProviders<TResult, TProps>(
  hook: (props: TProps) => TResult,
  options: Omit<RenderHookOptions<TProps>, "wrapper"> = {},
): RenderHookResult<TResult, TProps> & { queryClient: QueryClient } {
  const queryClient = makeTestQueryClient();
  const result = renderHook(hook, {
    wrapper: providers(queryClient),
    ...options,
  });
  return { ...result, queryClient };
}
