/** MF-0009 SC-2: "N trees need water", worded for zero and one. */
export function needWaterLabel(count: number): string {
  if (count === 0) return "No tree needs water";
  if (count === 1) return "1 tree needs water";
  return `${count} trees need water`;
}

/** The walk's length as the learner reads it. */
export function walkLengthLabel(stepCount: number): string {
  return stepCount === 1 ? "1 question" : `${stepCount} questions`;
}
