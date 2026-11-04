import { BATCH_CUSTOM_ID, OVERGENERATION, TARGET_PER_SKILL } from "./models";

/** SC-2: how many questions a skill still needs (`count` overrides), and how many drafts to request. */
export function questionsNeeded({
  existing,
  count,
}: {
  existing: number;
  count?: number;
}): { need: number; request: number } {
  const need = count ?? Math.max(0, TARGET_PER_SKILL - existing);
  if (!Number.isInteger(need) || need < 0)
    throw new Error(`questionsNeeded: invalid count ${need}`);
  return { need, request: need === 0 ? 0 : Math.ceil(need * OVERGENERATION) };
}

/** SC-2: Batch-safe id for draft `index` of `skill` (`D2.S1`, 3 → `D2_S1-3`). Throws when the result breaks the pattern. */
export function customIdFor(skill: string, index: number): string {
  const id = `${skill.replaceAll(".", "_")}-${index}`;
  if (!BATCH_CUSTOM_ID.test(id) || !Number.isInteger(index) || index < 0)
    throw new Error(`customIdFor: "${id}" is not a valid batch custom_id`);
  return id;
}

/** SC-2: the skill a writer `custom_id` belongs to (`D2_S1-3` → `D2.S1`). Skill codes contain no `_`. */
export function skillFromCustomId(customId: string): string {
  const match = /^([A-Za-z0-9_]+)-\d+$/.exec(customId);
  if (!match?.[1]) throw new Error(`skillFromCustomId: "${customId}"`);
  return match[1].replaceAll("_", ".");
}
