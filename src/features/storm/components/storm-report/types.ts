import type { DomainShortfall, StormReport } from "@/engine/storm";

export interface StormReportProps {
  /** From `scoreStorm`: every figure on this card. */
  report: StormReport;
  /** From `stormShortfall`: the domains this storm held fewer questions of than planned. */
  shortfall: readonly DomainShortfall[];
  /** Questions filled from the unreviewed pool. */
  unreviewedIds: readonly string[];
  domainNames: Record<string, string>;
  skillNames: Record<string, string>;
  /** "Question 3" per question id, for the voided and unreviewed lists. */
  questionLabels: Record<string, string>;
}
