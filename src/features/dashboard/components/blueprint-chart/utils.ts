import type { DomainProgress } from "@/engine/forest";

export interface BlueprintDatum {
  code: string;
  name: string;
  /** Exam weight of skills already growing, percent. */
  growing: number;
  /** Remaining exam weight, percent. growing + notYet = the domain's weight. */
  notYet: number;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

/** One stacked bar per domain: the bar's full height is the domain's exam weight. */
export function blueprintData(
  domains: readonly DomainProgress[],
): BlueprintDatum[] {
  return domains.map((d) => {
    const growing = Math.min(d.grownWeight, d.weight);
    return {
      code: d.domainCode,
      name: d.name,
      growing: round1(growing),
      notYet: round1(d.weight - growing),
    };
  });
}

export const BLUEPRINT_CHART_CONFIG = {
  growing: { label: "Growing", color: "var(--chart-4)" },
  notYet: { label: "Not yet", color: "var(--chart-1)" },
} as const;
