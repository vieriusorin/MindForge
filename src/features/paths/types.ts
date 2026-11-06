import type { ActionResult } from "@/lib/action-result";

/** MF-0058: Start path. A repeat Start is ok (one enrollment row). */
export type StartPathResult = ActionResult;

/** MF-0058: Leave path. Completions stay; leaving a path you're not in is ok. */
export type LeavePathResult = ActionResult;
