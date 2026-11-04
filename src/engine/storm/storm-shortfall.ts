import type { Pack } from "../pack/types";
import { BOSS_STORM_SIZE, fullStormDomainSeats } from "./compose-storm";
import type { StormKind } from "./types";

export interface StormShortfallInput {
  readonly kind: StormKind;
  readonly domainCode: string | null;
  readonly questions: readonly { readonly skillCode: string }[];
}

export interface DomainShortfall {
  readonly domainCode: string;
  readonly planned: number;
  readonly actual: number;
}

function plannedSeats(
  pack: Pack,
  storm: StormShortfallInput,
): Map<string, number> {
  if (storm.kind === "full") return fullStormDomainSeats(pack);
  return new Map(
    storm.domainCode === null ? [] : [[storm.domainCode, BOSS_STORM_SIZE]],
  );
}

/**
 * MF-0013: the domains a storm holds fewer questions of than its plan (the report's "this storm
 * was shorter because…" line), in pack order. Throws for a Full Storm of a pack without exam timing.
 */
export function stormShortfall(
  pack: Pack,
  storm: StormShortfallInput,
): readonly DomainShortfall[] {
  const planned = plannedSeats(pack, storm);
  const domainOf = new Map(
    pack.domains.flatMap((d) => d.skills.map((s) => [s.code, d.code] as const)),
  );
  const actual = new Map<string, number>();
  for (const q of storm.questions) {
    const domainCode = domainOf.get(q.skillCode);
    if (domainCode !== undefined) {
      actual.set(domainCode, (actual.get(domainCode) ?? 0) + 1);
    }
  }
  return pack.domains.flatMap((d) => {
    const seats = planned.get(d.code) ?? 0;
    const held = actual.get(d.code) ?? 0;
    return held < seats
      ? [{ domainCode: d.code, planned: seats, actual: held }]
      : [];
  });
}
