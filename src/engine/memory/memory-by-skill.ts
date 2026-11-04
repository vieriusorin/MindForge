import type { MemorySnapshot } from "../forest/tree-stage";
import type { SkillStormProof } from "../storm/types";
import { replayMemory } from "./replay";
import type { Attempt } from "./types";

/**
 * Group a learner's attempts by skill and replay each. Skills never attempted are absent.
 * MF-0013: `proof` (from `stormProof`) sets each snapshot's storm flags; a skill not in it is unproven.
 */
export function memoryBySkill(
  attempts: readonly Attempt[],
  now: Date,
  proof: ReadonlyMap<string, SkillStormProof> = new Map(),
): Map<string, MemorySnapshot> {
  const bySkill = new Map<string, Attempt[]>();
  for (const a of attempts) {
    const list = bySkill.get(a.skillCode);
    if (list) list.push(a);
    else bySkill.set(a.skillCode, [a]);
  }
  const out = new Map<string, MemorySnapshot>();
  for (const [skill, list] of bySkill) {
    const memory = replayMemory(list, now);
    if (!memory) continue;
    const skillProof = proof.get(skill);
    out.set(skill, {
      ...memory,
      stormProven: skillProof?.stormProven ?? false,
      fullStormProven: skillProof?.fullStormProven ?? false,
    });
  }
  return out;
}
