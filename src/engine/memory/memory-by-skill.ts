import type { MemorySnapshot } from "../forest/tree-stage";
import { replayMemory } from "./replay";
import type { Attempt } from "./types";

/** Group a learner's attempts by skill and replay each. Skills never attempted are absent. */
export function memoryBySkill(
  attempts: readonly Attempt[],
  now: Date,
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
    if (memory) out.set(skill, memory);
  }
  return out;
}
