import type { Pack } from "../pack/types";
import { isProven, tallyBySkill } from "./tally-by-skill";
import type {
  SerializedStormDomainScore,
  StormDomainReport,
  StormReport,
  StormResult,
  StormSkillReport,
} from "./types";

/** CONTEXT.md "Survived domain": mirrors the 720/1000 pass mark. */
export const SURVIVE_PERCENT = 72;

/** Floored, so "percent ≥ 72" holds exactly when at least 72 % were right. */
function percentOf(correct: number, scored: number): number {
  return Math.floor((100 * correct) / scored);
}

/**
 * MF-0013 SC-5: the storm report. Domains and skills follow pack order and appear only with at
 * least one scored question; voided questions are excluded and listed; unanswered ones are wrong.
 */
export function scoreStorm(pack: Pack, storm: StormResult): StormReport {
  const bySkill = tallyBySkill(storm.questions);
  const domains: StormDomainReport[] = [];
  const skills: StormSkillReport[] = [];
  for (const domain of pack.domains) {
    let scored = 0;
    let correct = 0;
    for (const skill of domain.skills) {
      const tally = bySkill.get(skill.code);
      if (!tally) continue;
      scored += tally.scored;
      correct += tally.correct;
      skills.push({ skillCode: skill.code, ...tally, proven: isProven(tally) });
    }
    if (scored === 0) continue;
    const percent = percentOf(correct, scored);
    domains.push({
      domainCode: domain.code,
      scored,
      correct,
      percent,
      survived: percent >= SURVIVE_PERCENT,
    });
  }
  return {
    kind: storm.kind,
    finishedAt: storm.finishedAt,
    domains,
    skills,
    voided: storm.questions.filter((q) => q.voided).map((q) => q.id),
  };
}

/** MF-0013 SC-5: MF-0015's readiness input, one entry per reported domain. */
export function stormDomainScores(
  report: StormReport,
): readonly SerializedStormDomainScore[] {
  const finishedAt = report.finishedAt.toISOString();
  return report.domains.map((d) => ({
    domainCode: d.domainCode,
    percent: d.percent,
    finishedAt,
  }));
}
