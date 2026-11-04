import type { PackContent } from "@/engine/content";
import type { Pack } from "@/engine/pack";
import { ITEMS_PER_SKILL } from "./item-render";
import { questionsNeeded } from "./plan";
import type { ItemKind, ItemRunPlan } from "./types";

export interface PlanItemRunInput {
  pack: Pack;
  content: PackContent;
  /** `--skill`: only this skill; null = every skill of the pack. */
  skill: string | null;
  hasCorpus: (skill: string) => boolean;
}

/**
 * MF-0014 SC-1: skills with no item of `kind` in the pack files (any origin: user decision
 * 2026-11-04), in pack order. A skill without fetched corpus is listed as skipped. Throws on an
 * unknown `--skill`.
 */
function planItemRun(
  kind: ItemKind,
  { pack, content, skill, hasCorpus }: PlanItemRunInput,
): ItemRunPlan {
  const codes = pack.domains.flatMap((d) => d.skills.map((s) => s.code));
  if (skill !== null && !codes.includes(skill))
    throw new Error(`plan ${kind} run: no skill "${skill}" in the pack`);
  const items = kind === "card" ? content.cards : content.diagrams;
  const covered = new Set(items.map((item) => item.skill));
  // The MF-0008 over-generation rule, so the factor has one owner: need 1 → request 2.
  const { request } = questionsNeeded({ existing: 0, count: ITEMS_PER_SKILL });
  const plan: ItemRunPlan = { skills: [], skipped: [] };
  for (const code of codes) {
    if ((skill !== null && code !== skill) || covered.has(code)) continue;
    if (hasCorpus(code)) plan.skills.push({ code, request });
    else
      plan.skipped.push({
        code,
        reason: "no fetched corpus (run pnpm generate:corpus)",
      });
  }
  return plan;
}

export function planCardRun(input: PlanItemRunInput): ItemRunPlan {
  return planItemRun("card", input);
}

export function planDiagramRun(input: PlanItemRunInput): ItemRunPlan {
  return planItemRun("diagram", input);
}
