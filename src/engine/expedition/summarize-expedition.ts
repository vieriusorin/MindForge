/**
 * MF-0017: an expedition counts correct recalls toward a target the admin sets. MF-0059 (own pace): it
 * runs until it is ended (`endsAt` null while open); older rows may still carry a fixed end.
 */
export const EXPEDITION_TARGET = { min: 10, max: 1000, default: 100 } as const;

/** MF-0017 C-2: total − own reveals the others' sum, so expeditions need ≥ 3 members besides any viewer. */
export const EXPEDITION_MIN_MEMBERS = 4;

export const EXPEDITION_STATUSES = [
  "on-the-way",
  "reached",
  "not-reached",
] as const;
export type ExpeditionStatus = (typeof EXPEDITION_STATUSES)[number];

export type ExpeditionTimeLeft =
  | { readonly kind: "days"; readonly count: number }
  | { readonly kind: "hours"; readonly count: number }
  | { readonly kind: "under-an-hour" }
  | { readonly kind: "ended" }
  | { readonly kind: "open" };

export interface ExpeditionSummary {
  /** Whole percent of the target, floored, capped at 100. */
  readonly percent: number;
  readonly status: ExpeditionStatus;
  readonly timeLeft: ExpeditionTimeLeft;
  /** `startsAt <= now`, and `now < endsAt` when it has an end (the window is half-open). */
  readonly isActive: boolean;
}

export interface SummarizeExpeditionInput {
  readonly progress: number;
  readonly target: number;
  readonly startsAt: Date;
  /** MF-0059: null while the expedition is open (no end date). */
  readonly endsAt: Date | null;
  readonly now: Date;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function timeLeftUntil(endsAt: Date, now: Date): ExpeditionTimeLeft {
  const ms = endsAt.getTime() - now.getTime();
  if (ms <= 0) return { kind: "ended" };
  if (ms >= DAY_MS) return { kind: "days", count: Math.floor(ms / DAY_MS) };
  if (ms >= HOUR_MS) return { kind: "hours", count: Math.floor(ms / HOUR_MS) };
  return { kind: "under-an-hour" };
}

/**
 * MF-0017 SC-4: the figures and words the expedition card shows (GOAL edge-input table). The percent
 * is floored so it never reads 100 before the target is met; reaching the target wins over ending.
 */
export function summarizeExpedition(
  input: SummarizeExpeditionInput,
): ExpeditionSummary {
  const isReached = input.progress >= input.target;
  const isActive = isExpeditionActive(input);
  const percent = Math.floor(Math.min(input.progress / input.target, 1) * 100);
  let status: ExpeditionStatus = "on-the-way";
  if (isReached) status = "reached";
  // MF-0059: an open expedition has not ended, so it is never "not reached".
  else if (!isActive && input.endsAt !== null) status = "not-reached";
  return {
    percent,
    status,
    timeLeft:
      input.endsAt === null
        ? { kind: "open" }
        : timeLeftUntil(input.endsAt, input.now),
    isActive,
  };
}

/** MF-0059: started, and not yet ended (an open expedition has no end). The window is half-open. */
export function isExpeditionActive(input: {
  readonly startsAt: Date;
  readonly endsAt: Date | null;
  readonly now: Date;
}): boolean {
  if (input.startsAt.getTime() > input.now.getTime()) return false;
  return input.endsAt === null || input.now.getTime() < input.endsAt.getTime();
}

/** MF-0017 C-2: whether a group of `memberCount` members may run an expedition. */
export function isExpeditionAllowed(memberCount: number): boolean {
  return memberCount >= EXPEDITION_MIN_MEMBERS;
}
