"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/** MF-0010 SC-2 / ADR 0003: React Flow loads after hydration, never in a page's initial JS. */
export const FlowDiagramLazy = dynamic(
  () => import("./flow-diagram").then((m) => m.FlowDiagram),
  { ssr: false, loading: () => <Skeleton className="aspect-video w-full" /> },
);
