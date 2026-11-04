import type { Attempt } from "../memory/types";
import type { Pack } from "../pack/types";

/** CONTEXT.md Readiness weather. Words in the UI come from this set, never from a colour. */
export const WEATHER = ["sunny", "cloudy", "rain", "fog"] as const;
export type Weather = (typeof WEATHER)[number];

/** MF-0013 produces these from finished storms; until it merges the page passes `[]`. */
export interface StormDomainScore {
  domainCode: string;
  /** Share of the domain's storm questions answered correctly, 0–100. */
  percent: number;
  finishedAt: Date;
}

export interface ReadinessInput {
  pack: Pack;
  /** The learner's countable attempts (MF-0007), the same set the forest replays. */
  attempts: readonly Attempt[];
  storms: readonly StormDomainScore[];
  now: Date;
}

export interface DomainReadiness {
  domainCode: string;
  name: string;
  /** Exam blueprint weight, percent. */
  weight: number;
  /** Memory forecast on exam day, whole percent. Null when no skill of the domain was ever attempted. */
  forecastPercent: number | null;
  /** Latest storm score for the domain, whole percent. Null = "no storm yet". */
  stormPercent: number | null;
  weather: Weather;
}

export interface Readiness {
  /** ISO date the forecast is projected to. */
  examDate: string;
  domains: DomainReadiness[];
  /** Blueprint-weighted mean of the domains (fog counts as 0), whole percent. Null when every domain is fog. */
  overallPercent: number | null;
  overallWeather: Weather;
  /** The "pass mark (approx.)" reference line, percent. */
  passMarkPercent: number;
}
