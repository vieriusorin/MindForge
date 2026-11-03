import type { ForestView } from "./build-forest";
import type { TreeStage } from "./tree-stage";

/** Stages in growth order. The dashboard legend and donut follow this order. */
export const STAGE_ORDER = [
  "seed",
  "sprout",
  "sapling",
  "tree",
  "ancient",
] as const satisfies readonly TreeStage[];

export interface DomainProgress {
  domainCode: string;
  name: string;
  /** Exam blueprint weight, percent. */
  weight: number;
  /** Part of `weight` carried by skills that are no longer seeds. */
  grownWeight: number;
  skillCount: number;
  grownSkillCount: number;
}

export interface FocusSkill {
  skillCode: string;
  name: string;
  domainName: string;
  weight: number;
  stage: TreeStage;
  wilting: boolean;
}

export interface ForestSummary {
  totalSkills: number;
  grownSkills: number;
  wiltingSkills: number;
  /** Sum of all skill weights, percent (≈100 for an exam pack). */
  totalWeight: number;
  /** Sum of weights of skills past the seed stage, percent. */
  grownWeight: number;
  /** grownWeight as a whole-number share of totalWeight (0–100). */
  grownPercent: number;
  stageCounts: Record<TreeStage, number>;
  domains: DomainProgress[];
  /** What to study next: wilting trees and seeds, heaviest exam weight first. */
  focus: FocusSkill[];
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

/**
 * The single owner of every progress figure the dashboard shows.
 * Pure: derived only from the forest, which is derived only from measured memory.
 */
export function summarizeForest(
  forest: ForestView,
  focusLimit = 5,
): ForestSummary {
  const stageCounts: Record<TreeStage, number> = {
    seed: 0,
    sprout: 0,
    sapling: 0,
    tree: 0,
    ancient: 0,
  };
  const candidates: FocusSkill[] = [];
  let totalWeight = 0;
  let grownWeight = 0;
  let wiltingSkills = 0;

  const domains = forest.regions.map((region) => {
    let regionGrown = 0;
    let regionGrownCount = 0;
    for (const tree of region.trees) {
      stageCounts[tree.stage] += 1;
      totalWeight += tree.weight;
      if (tree.wilting) wiltingSkills += 1;
      if (tree.stage !== "seed") {
        regionGrown += tree.weight;
        regionGrownCount += 1;
      }
      if (tree.stage === "seed" || tree.wilting) {
        candidates.push({
          skillCode: tree.skillCode,
          name: tree.name,
          domainName: region.name,
          weight: tree.weight,
          stage: tree.stage,
          wilting: tree.wilting,
        });
      }
    }
    grownWeight += regionGrown;
    return {
      domainCode: region.domainCode,
      name: region.name,
      weight: region.weight,
      grownWeight: round1(regionGrown),
      skillCount: region.trees.length,
      grownSkillCount: regionGrownCount,
    };
  });

  // Wilting first (memory slipping beats never-learned), then heaviest, then code for stability.
  candidates.sort(
    (a, b) =>
      Number(b.wilting) - Number(a.wilting) ||
      b.weight - a.weight ||
      a.skillCode.localeCompare(b.skillCode),
  );

  const totalSkills = STAGE_ORDER.reduce((n, s) => n + stageCounts[s], 0);
  return {
    totalSkills,
    grownSkills: totalSkills - stageCounts.seed,
    wiltingSkills,
    totalWeight: round1(totalWeight),
    grownWeight: round1(grownWeight),
    grownPercent:
      totalWeight > 0 ? Math.round((grownWeight / totalWeight) * 100) : 0,
    stageCounts,
    domains,
    focus: candidates.slice(0, focusLimit),
  };
}
