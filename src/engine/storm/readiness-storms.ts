import type { Pack } from "../pack/types";
import type { StormDomainScore } from "../readiness/types";
import { scoreStorm } from "./score-storm";
import type { StormResult } from "./types";

/**
 * MF-0013 × MF-0015 (ROADMAP §4.3, wired by the second to merge): every finished storm's per-domain
 * score in readiness's own input type. The percent is `scoreStorm`'s, so the report and the weather
 * read the same figure.
 */
export function readinessStorms(
  pack: Pack,
  results: readonly StormResult[],
): StormDomainScore[] {
  return results.flatMap((result) =>
    scoreStorm(pack, result).domains.map((domain) => ({
      domainCode: domain.domainCode,
      percent: domain.percent,
      finishedAt: result.finishedAt,
    })),
  );
}
