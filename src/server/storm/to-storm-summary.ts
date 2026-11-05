import type { StormSummary, StormSummaryRow } from "./types";

export function toStormSummary(row: StormSummaryRow): StormSummary {
  return {
    id: row.id,
    packSlug: row.pack_slug,
    kind: row.kind,
    domainCode: row.domain_code,
    startedAt: row.started_at,
    endsAt: row.ends_at,
    finishedAt: row.finished_at,
  };
}
