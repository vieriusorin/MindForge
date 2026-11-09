import type { LessonPlan, PlannedStep } from "./types";

/**
 * MF-0066 SC-5: the steps the player shows: the plan's steps with its order step after the recalls and
 * before the confusable step (last when there is none). A plan without an order is returned unchanged.
 */
export function lessonSteps(plan: LessonPlan): PlannedStep[] {
  if (!plan.order) return plan.steps;
  const step: PlannedStep = { kind: "order", order: plan.order };
  const last = plan.steps.at(-1);
  if (last?.kind === "confusable")
    return [...plan.steps.slice(0, -1), step, last];
  return [...plan.steps, step];
}
