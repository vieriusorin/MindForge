import { planSeedPlanting } from "../content/plan-seed-planting";
import { isPlayable, reviewStateOf } from "../content/review";
import type { PackContent, ReviewContext } from "../content/types";
import type { ForestView } from "../forest/build-forest";
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
}

interface LastAnswer {
  at: number;
  correct: boolean;
}

function lastAnswers(attempts: readonly Attempt[]): Map<string, LastAnswer> {
  const last = new Map<string, LastAnswer>();
  for (const a of attempts) {
    const at = a.answeredAt.getTime();
    const seen = last.get(a.questionId);
    if (!seen || at >= seen.at)
      last.set(a.questionId, { at, correct: a.correct });
  }
  return last;
}

/** 0 = last answered wrong, 1 = never answered, 2 = last answered right. */
function bucketOf(last: LastAnswer | undefined): number {
  if (!last) return 1;
  return last.correct ? 2 : 0;
}

/**
 * D-L6: a skill's servable items (playable, at most 4 options), wrong-last first, then never
 * answered (file order), then least recently answered.
 */
function orderedItems(
  skillCode: string,
  { content, review }: Pick<PlanLessonInput, "content" | "review">,
  last: ReadonlyMap<string, LastAnswer>,
): Question[] {
  return content.questions
    .map((question, order) => ({ question, order }))
    .filter(
      ({ question }) =>
        question.skillCode === skillCode &&
        question.options.length <= LESSON_MAX_OPTIONS &&
        isPlayable(reviewStateOf(review, question), "practice"),
    )
    .sort((a, b) => {
      const la = last.get(a.question.id);
      const lb = last.get(b.question.id);
      return (
        bucketOf(la) - bucketOf(lb) ||
        (la?.at ?? 0) - (lb?.at ?? 0) ||
        a.order - b.order
      );
    })
    .map((x) => x.question);
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
  const last = lastAnswers(input.attempts);

  const { card, diagram } = planSeedPlanting({
    content,
    review,
    skill: skillCode,
  });
  const recalls = orderedItems(skillCode, input, last).slice(
    0,
    LESSON_RECALL_TARGET,
  );

  if (!card && !diagram && recalls.length === 0) {
    return {
      skillCode,
      isNewSkill,
      confusableSkill: null,
      steps: [],
      maxReasks: 0,
    };
  }

  let confusable: { skillCode: string; question: Question } | null = null;
  for (let i = index - 1; i >= 0 && !confusable; i--) {
    const tree = trees[i];
    if (!tree || tree.stage === "seed") continue;
    const [question] = orderedItems(tree.skillCode, input, last);
    if (question) confusable = { skillCode: tree.skillCode, question };
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
    maxReasks: Math.max(0, LESSON_MAX_INTERACTIONS - steps.length),
  };
}
