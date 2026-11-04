import type {
  ActionResult,
  FormActionResult,
  NoData,
} from "@/lib/action-result";
import type { FlagItemValues, ResolveFlagsValues } from "./schemas";

/** MF-0007: approving, or approving a card's analogy; the error is the message shown. */
export type ReviewActionResult = ActionResult;

export type FlagItemResult = FormActionResult<NoData, FlagItemValues>;

export type ResolveFlagsResult = FormActionResult<NoData, ResolveFlagsValues>;
