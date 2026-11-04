import { memoryBySkill } from "../memory/memory-by-skill";
import type { PackDomain } from "../pack/types";
import type {
  DomainReadiness,
  Readiness,
  ReadinessInput,
  StormDomainScore,
  Weather,
} from "./types";

/**
 * CONTEXT.md Readiness weather. Changing a value changes every learner's weather.
 * The pass mark mirrors 720/1000; it is a reference line, never a score estimate.
 */
export const READINESS_THRESHOLDS = {
  sunnyFromPercent: 85,
  cloudyFromPercent: 72,
  passMarkPercent: 72,
} as const;

/** Weather for a whole percent shown on screen; null (no data) is fog. */
export function weatherFor(percent: number | null): Weather {
  if (percent === null) return "fog";
  if (percent >= READINESS_THRESHOLDS.sunnyFromPercent) return "sunny";
  if (percent >= READINESS_THRESHOLDS.cloudyFromPercent) return "cloudy";
  return "rain";
}

/** The exam day at 00:00 UTC, or `now` once that has passed. */
function horizonOf(examDate: string, now: Date): Date {
  const exam = new Date(`${examDate}T00:00:00Z`);
  return exam.getTime() > now.getTime() ? exam : now;
}

function lastStormPercent(
  domainCode: string,
  storms: readonly StormDomainScore[],
): number | null {
  let last: StormDomainScore | null = null;
  for (const storm of storms) {
    if (storm.domainCode !== domainCode) continue;
    if (!last || storm.finishedAt.getTime() > last.finishedAt.getTime()) {
      last = storm;
    }
  }
  return last ? last.percent : null;
}

/** Skill-weighted retrievability (0–100); never-attempted skills count 0. Null when none was attempted. */
function forecastOf(
  domain: PackDomain,
  retrievability: ReadonlyMap<string, number>,
): number | null {
  let weighted = 0;
  let total = 0;
  let attempted = false;
  for (const skill of domain.skills) {
    const r = retrievability.get(skill.code);
    if (r !== undefined) attempted = true;
    weighted += skill.weight * (r ?? 0);
    total += skill.weight;
  }
  return attempted && total > 0 ? (weighted / total) * 100 : null;
}

function lowerOf(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return Math.min(a, b);
}

const roundOrNull = (n: number | null): number | null =>
  n === null ? null : Math.round(n);

/**
 * MF-0015: per domain, the memory forecast on exam day (FSRS replay of the learner's countable
 * attempts with the clock at the exam, so no future reviews are assumed) and the last storm score,
 * combined into readiness weather from the lower of the two. Null for packs without an exam date.
 */
export function readiness({
  pack,
  attempts,
  storms,
  now,
}: ReadinessInput): Readiness | null {
  const examDate = pack.kind === "exam" ? pack.exam?.date : undefined;
  if (!examDate) return null;

  const memory = memoryBySkill(attempts, horizonOf(examDate, now));
  const retrievability = new Map(
    [...memory].map(([skill, m]) => [skill, m.retrievability]),
  );

  let weightedValue = 0;
  let totalWeight = 0;
  let hasData = false;
  const domains: DomainReadiness[] = pack.domains.map((domain) => {
    const forecast = forecastOf(domain, retrievability);
    const storm = lastStormPercent(domain.code, storms);
    const value = lowerOf(forecast, storm);
    if (value !== null) hasData = true;
    // C-3: a fog domain counts as 0 in the overall.
    weightedValue += domain.weight * (value ?? 0);
    totalWeight += domain.weight;
    return {
      domainCode: domain.code,
      name: domain.name,
      weight: domain.weight,
      forecastPercent: roundOrNull(forecast),
      stormPercent: roundOrNull(storm),
      weather: weatherFor(roundOrNull(value)),
    };
  });

  const overallPercent =
    hasData && totalWeight > 0 ? Math.round(weightedValue / totalWeight) : null;
  return {
    examDate,
    domains,
    overallPercent,
    overallWeather: weatherFor(overallPercent),
    passMarkPercent: READINESS_THRESHOLDS.passMarkPercent,
  };
}
