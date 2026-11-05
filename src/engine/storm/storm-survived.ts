import type { StormReport } from "./types";

/**
 * MF-0052 SC-11: the whole-storm verdict. Survived only when every scored domain survived
 * (>= SURVIVE_PERCENT); a storm with no scored domain (all voided) is NOT survived (GOAL.md).
 */
export function stormSurvived(report: StormReport): boolean {
  return report.domains.length > 0 && report.domains.every((d) => d.survived);
}
