import type { FormActionResult } from "@/lib/action-result";
import type { StartExpeditionValues } from "./schemas";

export type StartExpeditionResult = FormActionResult<
  { expeditionId: string },
  StartExpeditionValues
>;
