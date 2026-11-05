import type { PlayableQuestion, Question } from "./types";

/**
 * Allow-list copy: only what the learner may see before answering, bound to the version they read
 * (MF-0032: `contentHash` is the deployed file's hash, sent back with the answer).
 */
export function toPlayableQuestion(
  question: Question,
  contentHash: string,
): PlayableQuestion {
  return {
    id: question.id,
    skillCode: question.skillCode,
    origin: question.origin,
    stem: question.stem,
    select: question.select,
    options: question.options.map((o) => ({ id: o.id, text: o.text })),
    source: { title: question.source.title, url: question.source.url },
    contentHash,
  };
}

/**
 * MF-0032: the playable view of each question, bound to its deployed hash. A question with no hash in
 * `hashes` is dropped rather than served unbound (it could never be graded).
 */
export function toPlayableQuestions(
  questions: readonly Question[],
  hashes: Readonly<Record<string, string>>,
): PlayableQuestion[] {
  return questions.flatMap((q) => {
    const hash = hashes[q.id];
    return hash ? [toPlayableQuestion(q, hash)] : [];
  });
}
