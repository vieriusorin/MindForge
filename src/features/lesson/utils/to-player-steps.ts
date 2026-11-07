import type { LessonStep } from "@/engine/lesson";
import { toPlayableQuestion } from "@/engine/questions";
import type { PlayerStep } from "../types";

/**
 * MF-0064: the plan as the browser may see it. Questions become playable copies bound to their
 * deployed hash (MF-0032); a question with no hash is dropped, as `toPlayableQuestions` does, because
 * it could never be graded. A guess whose item was dropped goes with it.
 */
export function toPlayerSteps({
  steps,
  hashes,
  skillNames,
}: {
  steps: readonly LessonStep[];
  hashes: Readonly<Record<string, string>>;
  skillNames: ReadonlyMap<string, string>;
}): PlayerStep[] {
  return steps.flatMap((step): PlayerStep[] => {
    switch (step.kind) {
      case "card":
      case "diagram":
        return [{ kind: step.kind }];
      case "guess":
      case "recall": {
        const hash = hashes[step.question.id];
        return hash
          ? [
              {
                kind: step.kind,
                question: toPlayableQuestion(step.question, hash),
              },
            ]
          : [];
      }
      case "confusable": {
        const hash = hashes[step.question.id];
        return hash
          ? [
              {
                kind: "confusable",
                question: toPlayableQuestion(step.question, hash),
                skillName: skillNames.get(step.skillCode) ?? step.skillCode,
              },
            ]
          : [];
      }
      default: {
        const unknownStep: never = step;
        return unknownStep;
      }
    }
  });
}
