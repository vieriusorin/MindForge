import type { ActionResult, FormActionResult } from "@/lib/action-result";
import type { StartExpeditionValues } from "./schemas";

export type StartExpeditionResult = FormActionResult<
  { expeditionId: string },
  StartExpeditionValues
>;

/** MF-0059: the admin ending the running expedition. */
export type EndExpeditionResult = ActionResult;
