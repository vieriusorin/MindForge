import { isOrderServable } from "../content/order-servable";
import { planSeedPlanting } from "../content/plan-seed-planting";
import { isPlayable, reviewStateOf } from "../content/review";
import type { OrderItem, PackContent, ReviewContext } from "../content/types";
import type { ForestView } from "../forest/build-forest";
import { orderSkillItems } from "../memory/order-skill-items";
import type { Attempt } from "../memory/types";
import type { Question } from "../questions/types";
import type { LessonPlan, LessonStep } from "./types";

/** MF-0064 D-L6: at most this many recall items per lesson. */
export const LESSON_RECALL_TARGET = 6;
/** MF-0064 D-L7 (council): a lesson's interactions, re-asks included, never exceed this. */
export const LESSON_MAX_INTERACTIONS = 12;
/** MF-0064 D-L7 (council): items with more options than this are not served in a lesson. */
export const LESSON_MAX_OPTIONS = 4;

export interface PlanLessonInput {
  skillCode: string;
  /** The learner's forest for the pack (the map's `courseForest`): stage per skill, in pack order. */
  forest: ForestView;
  content: PackContent;
  review: ReviewContext;
  /** The learner's graded attempts for the pack, for item order. */
  attempts: readonly Attempt[];
  /** MF-0065 (DQ-10): skills the pack's misconceptions link to this one, preferred first. */
  confusable?: readonly string[];
}

/**
 * D-L6: a skill's servable items (playable, at most 4 options) in the shared next-item order
 * (`orderSkillItems`, MF-0065): wrong-last first, then never answered (file order), then least recently answered.
 */
function orderedItems(
  skillCode: string,
  {
    content,
    review,
    attempts,
  }: Pick<PlanLessonInput, "content" | "review" | "attempts">,
): Question[] {
  return orderSkillItems(
    content.questions.filter(
      (question) =>
        question.skillCode === skillCode &&
        question.options.length <= LESSON_MAX_OPTIONS &&
        isPlayable(reviewStateOf(review, question), "practice"),
    ),
    attempts,
  );
}

/**
 * MF-0066 SC-5: the skill's one order to ask: servable (playable, diagram approved), then by the same rule as
 * the lesson's items (wrong-last, never answered in file order, least recently answered). Null when none.
 */
function pickOrder(
  skillCode: string,
  {
    content,
    review,
    attempts,
  }: Pick<PlanLessonInput, "content" | "review" | "attempts">,
): OrderItem | null {
  const diagrams = new Map(content.diagrams.map((d) => [d.id, d]));
  const servable = (content.orders ?? []).filter((order) => {
    const diagram = diagrams.get(order.diagram);
    return (
      order.skill === skillCode &&
      diagram !== undefined &&
      isOrderServable({
        orderState: reviewStateOf(review, order),
        diagramState: reviewStateOf(review, diagram),
      })
    );
  });
  return orderSkillItems(servable, attempts)[0] ?? null;
}

/**
 * MF-0064 SC-1: the ordered steps of one skill's lesson (GOAL D-L3..D-L8). A Seed opens with an
 * ungraded guess on its first recall item; a met skill opens with that item graded. One question from
 * the nearest earlier skill already met closes the plan. No card, diagram or item: no steps.
 */
export function planLesson(input: PlanLessonInput): LessonPlan {
  const { skillCode, forest, content, review } = input;
  const trees = forest.regions.flatMap((r) => r.trees);
  const index = trees.findIndex((t) => t.skillCode === skillCode);
  const isNewSkill = (trees[index]?.stage ?? "seed") === "seed";

  const { card, diagram } = planSeedPlanting({
    content,
    review,
    skill: skillCode,
  });
  const recalls = orderedItems(skillCode, input).slice(0, LESSON_RECALL_TARGET);
  const order = pickOrder(skillCode, input);

  if (!card && !diagram && recalls.length === 0) {
    return {
      skillCode,
      isNewSkill,
      confusableSkill: null,
      steps: [],
      order,
      maxReasks: order ? LESSON_MAX_INTERACTIONS - 1 : 0,
    };
  }

  // MF-0065 (DQ-10): a skill the pack's misconceptions link to this one comes first, if already met;
  // otherwise MF-0064 D-L3's nearest earlier met skill.
  const isMet = (code: string): boolean => {
    const tree = trees.find((t) => t.skillCode === code);
    return tree !== undefined && tree.stage !== "seed";
  };
  const earlier = trees
    .slice(0, Math.max(index, 0))
    .reverse()
    .map((t) => t.skillCode);
  let confusable: { skillCode: string; question: Question } | null = null;
  for (const code of [...(input.confusable ?? []), ...earlier]) {
    if (code === skillCode || !isMet(code)) continue;
    const [question] = orderedItems(code, input);
    if (question) {
      confusable = { skillCode: code, question };
      break;
    }
  }

  const teach: LessonStep[] = [
    ...(card ? [{ kind: "card" as const, card }] : []),
    ...(diagram ? [{ kind: "diagram" as const, diagram }] : []),
  ];
  const asRecall = (question: Question): LessonStep => ({
    kind: "recall",
    question,
  });
  const [first, ...rest] = recalls;
  let body: LessonStep[];
  if (!first) body = teach;
  else if (isNewSkill)
    body = [
      { kind: "guess", question: first },
      ...teach,
      ...recalls.map(asRecall),
    ];
  else body = [asRecall(first), ...teach, ...rest.map(asRecall)];

  const steps: LessonStep[] = confusable
    ? [...body, { kind: "confusable", ...confusable }]
    : body;

  return {
    skillCode,
    isNewSkill,
    confusableSkill: confusable?.skillCode ?? null,
    steps,
    order,
    // MF-0066: the order step is an interaction too.
    maxReasks: Math.max(
      0,
      LESSON_MAX_INTERACTIONS - steps.length - (order ? 1 : 0),
    ),
  };
}
