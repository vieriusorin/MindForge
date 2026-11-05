import type { Pack } from "@/engine/pack";
import type { RecentStorm } from "@/server/storm/types";

/** MF-0052 SC-11: one of your finished storms of a pack. One owner: the server read's DTO. */
export type FinishedStormInput = RecentStorm;

export interface RecentStormsInput {
  pack: Pack;
  storms: readonly FinishedStormInput[];
}

/** MF-0052 SC-11: one row of the recent-storms list on the Storm start page. */
export interface RecentStormRow {
  id: string;
  /** `/storms/<id>`. */
  href: string;
  /** ISO 8601; the view formats the date. */
  finishedAt: string;
  /** "Full Storm" or "Boss Storm: <domain name>". */
  kindLabel: string;
  /** The engine's verdict (`scoreStorm` + `stormSurvived`), never component arithmetic. */
  survived: boolean;
}

export interface RecentStormsProps {
  rows: readonly RecentStormRow[];
}
