import type { ForestView } from "../forest/build-forest";
import { summarizeForest } from "../forest/summarize-forest";
import type { TreeStage } from "../forest/tree-stage";
import { GROWN_STAGES } from "./is-course-complete";
import { type NextStep, nextStep } from "./next-step";
import { type NodeMode, nodeMode } from "./node-mode";

const DONE: ReadonlySet<TreeStage> = new Set(GROWN_STAGES);

/** One skill on the course map. */
export interface CourseMapNode {
  skillCode: string;
  name: string;
  weight: number;
  stage: TreeStage;
  wilting: boolean;
  /** Sapling or above, wilting included: the Course complete rule (`GROWN_STAGES`). */
  isDone: boolean;
  mode: NodeMode;
}

/** The Boss Storm checkpoint at the end of a domain. */
export interface CourseMapCheckpoint {
  /** Every node of the domain is done. The checkpoint links either way: nothing is locked. */
  isReady: boolean;
}

export interface CourseMapDomain {
  domainCode: string;
  name: string;
  weight: number;
  nodes: readonly CourseMapNode[];
  doneCount: number;
  skillCount: number;
  /** null when the pack has no `exam:` block: a Storm is a mock exam (MF-0052). */
  checkpoint: CourseMapCheckpoint | null;
}

export interface CourseMap {
  packSlug: string;
  packName: string;
  domains: readonly CourseMapDomain[];
  doneCount: number;
  totalSkills: number;
  wiltingSkills: number;
  next: NextStep;
}

export interface CourseMapInput {
  forest: ForestView;
  /** Skill codes with something to plant (`plantableSkills`). */
  plantable: ReadonlySet<string>;
  hasExam: boolean;
}

/** MF-0062: a pack's skills as map nodes by domain, with one next step. Figures from `summarizeForest`. */
export function courseMap({
  forest,
  plantable,
  hasExam,
}: CourseMapInput): CourseMap {
  const summary = summarizeForest(forest);
  const domains = forest.regions.map((region): CourseMapDomain => {
    const nodes = region.trees.map(
      (tree): CourseMapNode => ({
        skillCode: tree.skillCode,
        name: tree.name,
        weight: tree.weight,
        stage: tree.stage,
        wilting: tree.wilting,
        isDone: DONE.has(tree.stage),
        mode: nodeMode({
          stage: tree.stage,
          wilting: tree.wilting,
          isPlantable: plantable.has(tree.skillCode),
        }),
      }),
    );
    const doneCount = nodes.filter((node) => node.isDone).length;
    return {
      domainCode: region.domainCode,
      name: region.name,
      weight: region.weight,
      nodes,
      doneCount,
      skillCount: nodes.length,
      checkpoint: hasExam ? { isReady: doneCount === nodes.length } : null,
    };
  });
  return {
    packSlug: forest.packSlug,
    packName: forest.packName,
    domains,
    doneCount: domains.reduce((n, domain) => n + domain.doneCount, 0),
    totalSkills: summary.totalSkills,
    wiltingSkills: summary.wiltingSkills,
    next: nextStep(forest),
  };
}
