import type { ReactNode } from "react";
import type { ExpeditionSummary } from "@/engine/expedition";

/** MF-0017: what the group page knows about the group's expedition, decided at the page. */
export type ExpeditionCardProps =
  | { status: "too-small"; minMembers: number }
  | { status: "none"; startForm?: ReactNode }
  | {
      status: "shown";
      domainName: string;
      target: number;
      progress: number;
      summary: ExpeditionSummary;
      /** Only when the viewer is the admin and nothing is running. */
      startForm?: ReactNode;
    };
