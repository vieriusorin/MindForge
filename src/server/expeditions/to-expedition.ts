import type { Expedition, LatestExpeditionRow } from "./types";

/** MF-0059: maps a `latest_expedition` row to the DTO; timestamps become ISO, an open end stays null. */
export function toExpedition(row: LatestExpeditionRow): Expedition {
  return {
    id: row.id,
    domainCode: row.domain_code,
    target: row.target,
    startsAt: new Date(row.starts_at).toISOString(),
    endsAt: row.ends_at === null ? null : new Date(row.ends_at).toISOString(),
  };
}
