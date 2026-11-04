import { isProven, tallyBySkill } from "./tally-by-skill";
import type { SkillStormProof, StormResult } from "./types";

/**
 * MF-0013 SC-6: which skills are storm-proven, from the learner's finished storms. Voided and
 * since-rejected questions drop out first (CONTEXT.md "Attempt"). Skills never proven are absent.
 */
export function stormProof(
  results: readonly StormResult[],
  rejected: ReadonlySet<string>,
): ReadonlyMap<string, SkillStormProof> {
  const out = new Map<string, SkillStormProof>();
  for (const storm of results) {
    const kept = storm.questions.filter((q) => !rejected.has(q.id));
    for (const [skillCode, tally] of tallyBySkill(kept)) {
      if (!isProven(tally)) continue;
      const prev = out.get(skillCode);
      out.set(skillCode, {
        stormProven: true,
        fullStormProven:
          (prev?.fullStormProven ?? false) || storm.kind === "full",
      });
    }
  }
  return out;
}
