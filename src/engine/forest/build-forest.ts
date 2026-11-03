import type { Pack } from "../pack/types";
import { type MemorySnapshot, type TreeState, treeStage } from "./tree-stage";

export interface ForestTree extends TreeState {
  skillCode: string;
  name: string;
  weight: number;
}

export interface ForestRegion {
  domainCode: string;
  name: string;
  weight: number;
  trees: ForestTree[];
}

export interface ForestView {
  packSlug: string;
  packName: string;
  regions: ForestRegion[];
}

/** Turn a pack plus a learner's measured memory into the forest they see. Unknown skills are seeds. */
export function buildForest(
  pack: Pack,
  memoryBySkill: ReadonlyMap<string, MemorySnapshot> = new Map(),
): ForestView {
  return {
    packSlug: pack.slug,
    packName: pack.name,
    regions: pack.domains.map((domain) => ({
      domainCode: domain.code,
      name: domain.name,
      weight: domain.weight,
      trees: domain.skills.map((skill) => ({
        skillCode: skill.code,
        name: skill.name,
        weight: skill.weight,
        ...treeStage(memoryBySkill.get(skill.code) ?? null),
      })),
    })),
  };
}
