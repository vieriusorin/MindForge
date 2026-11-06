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
      /** Only when the viewer is the admin and `canStartExpedition` allows a start. */
      startForm?: ReactNode;
      /** MF-0059: the admin's End expedition button, only while it runs. */
      endButton?: ReactNode;
      /** MF-0059 C-1: ended because the group moved to its next course (`isEndedByCourseMove`). */
      movedOn: boolean;
    };
