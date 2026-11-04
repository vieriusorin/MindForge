import { planSeedPlanting } from "./plan-seed-planting";
import type { PackContent, ReviewContext } from "./types";

/** MF-0010: skills with something to plant (a playable card, diagram or check), among `skills`. */
export function plantableSkills({
  content,
  review,
  skills,
}: {
  content: PackContent;
  review: ReviewContext;
  skills: readonly string[];
}): Set<string> {
  return new Set(
    skills.filter((skill) => {
      const plan = planSeedPlanting({ content, review, skill });
      return (
        plan.card !== null || plan.diagram !== null || plan.checks.length > 0
      );
    }),
  );
}
