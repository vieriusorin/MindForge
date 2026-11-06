import type { ExpeditionStatus, ExpeditionTimeLeft } from "@/engine/expedition";

type BadgeVariant = "default" | "secondary" | "outline";

/** MF-0017 (ui-design §5): the status always carries a word, never colour alone. */
export const STATUS_LOOK = {
  "on-the-way": { label: "On the way", badge: "secondary" },
  reached: { label: "Goal reached", badge: "default" },
  "not-reached": { label: "Not reached", badge: "outline" },
} as const satisfies Record<
  ExpeditionStatus,
  { label: string; badge: BadgeVariant }
>;

export function statusLook(status: ExpeditionStatus): {
  label: string;
  badge: BadgeVariant;
} {
  return STATUS_LOOK[status];
}

const plural = (count: number, one: string, many: string): string =>
  `${count} ${count === 1 ? one : many}`;

export function timeLeftLabel(timeLeft: ExpeditionTimeLeft): string {
  switch (timeLeft.kind) {
    case "days":
      return `${plural(timeLeft.count, "day", "days")} left`;
    case "hours":
      return `${plural(timeLeft.count, "hour", "hours")} left`;
    case "under-an-hour":
      return "Less than an hour left";
    case "ended":
      return "Ended";
    case "open":
      return "No end date";
  }
}

/**
 * "140 of 200 correct recalls · 70%". The percent comes from the engine summary; the target is
 * always ≥ 10 (EXPEDITION_TARGET), so the noun is always plural.
 */
export function progressLine(input: {
  progress: number;
  target: number;
  percent: number;
}): string {
  return `${input.progress} of ${input.target} correct recalls · ${input.percent}%`;
}

export function goalLine(input: {
  target: number;
  domainName: string;
}): string {
  return `Together, make ${input.target} correct recalls in ${input.domainName}.`;
}

/** No expedition yet: the admin is invited to start one, a member is told who can. */
export function noneLine(canStart: boolean): string {
  return canStart
    ? "Set a goal: every member's correct recalls in one domain count until you end it."
    : "No expedition yet. Your group admin can start one.";
}

/** MF-0059 C-1: shown on an ended expedition whose pack is no longer the group's current course. */
export function movedOnLine(): string {
  return "Ended. The group has since moved to the next course.";
}

export function tooSmallLine(minMembers: number): string {
  return `Expeditions need at least ${minMembers} members.`;
}
