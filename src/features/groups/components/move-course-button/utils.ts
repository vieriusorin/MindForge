import type { MoveDialogCopy } from "./types";

/** MF-0059 (C-1): the confirm dialog; a running expedition ends at the move, so it says so. */
export function moveDialogCopy(input: {
  nextCourseName: string | null;
  hasRunningExpedition: boolean;
}): MoveDialogCopy {
  const base =
    "The group's heatmap and review follow the new course. The group can't move back.";
  return {
    title: `Move to ${input.nextCourseName ?? "the next course"}?`,
    description: input.hasRunningExpedition
      ? `${base} This ends the running expedition.`
      : base,
  };
}
