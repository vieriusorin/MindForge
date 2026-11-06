import type { ExpeditionSummary } from "./summarize-expedition";

/**
 * MF-0059 (own pace): whether the admin may start the next expedition while this one is the latest. An
 * ended one never blocks; a running one blocks until it reaches its target, after which the next start
 * closes it (mirrors `private.start_expedition`).
 */
export function canStartExpedition(summary: ExpeditionSummary): boolean {
  return !summary.isActive || summary.status === "reached";
}
