/** MF-0065: a wrong belief a distractor stands for. `skill` = the other skill whose concept is mixed in. */
export interface Misconception {
  id: string;
  label: string;
  skill?: string;
}

/** MF-0065: a pack's `misconceptions.yaml`. `tags[questionId][optionId]` = a misconception id. */
export interface PackMisconceptions {
  misconceptions: Misconception[];
  tags: Record<string, Record<string, string>>;
}

/** MF-0065: how often the learner picked a distractor tagged with one misconception. */
export interface MisconceptionCount {
  misconceptionId: string;
  label: string;
  count: number;
  lastPickedAt: Date;
}

/** MF-0065: the mix-up a lesson's close screen names. */
export interface MixUp {
  label: string;
  count: number;
}
