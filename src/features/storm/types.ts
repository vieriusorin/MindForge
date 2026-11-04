import type { ActionResult } from "@/lib/action-result";

export type { StormSessionQuestion } from "@/server/storm/types";

/** What a refused storm write tells the screen. `isStormOver` locks the session (MF013). */
export interface StormActionError {
  message: string;
  isStormOver: boolean;
}

export type StartStormResult = ActionResult<{ stormId: string }>;
/** No grade, no key: an answer is only stored until the storm is finished (SC-4). */
export type AnswerStormResult = ActionResult<
  Record<never, never>,
  StormActionError
>;
export type FinishStormResult = ActionResult<
  Record<never, never>,
  StormActionError
>;
