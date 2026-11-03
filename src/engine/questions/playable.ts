import type { PlayableQuestion, Question } from "./types";

/** Allow-list copy: only what the learner may see before answering. */
export function toPlayableQuestion(question: Question): PlayableQuestion {
  return {
    id: question.id,
    skillCode: question.skillCode,
    origin: question.origin,
    stem: question.stem,
    select: question.select,
    options: question.options.map((o) => ({ id: o.id, text: o.text })),
    source: { title: question.source.title, url: question.source.url },
  };
}
