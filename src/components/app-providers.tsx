"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { ReactNode } from "react";
import { getQueryClient } from "@/lib/query-client";

/**
 * Client-state providers, mounted once in the root layout: nuqs (URL state) and TanStack
 * Query (client-side server state). Theme and tooltip providers stay in the layout itself.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <NuqsAdapter>
      <QueryClientProvider client={getQueryClient()}>
        {children}
      </QueryClientProvider>
    </NuqsAdapter>
  );
}
