import { z } from "zod";
import type { Draft, Dropped } from "./types";

/**
 * SC-7: the only shape accepted from the writer model. Strict at every level, so a draft that
 * carries `origin`, `author`, `generatedBy`, `skill` or any other extra field is dropped, never merged.
 */
const DraftSchema = z.strictObject({
  stem: z.string().trim().min(1).max(2000),
  options: z
    .array(
      z.strictObject({
        id: z.string().regex(/^[A-F]$/),
        text: z.string().trim().min(1).max(1000),
        correct: z.boolean(),
        rationale: z.string().max(2000),
      }),
    )
    .min(2)
    .max(6),
  citation: z.strictObject({
    url: z.url({ protocol: /^https$/ }),
    title: z.string().trim().min(1).max(300),
  }),
});

/** The JSON Schema sent as `output_config.format` (structured output); `DraftSchema` re-checks it. */
export const DRAFT_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["stem", "options", "citation"],
  properties: {
    stem: { type: "string" },
    options: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "text", "correct", "rationale"],
        properties: {
          id: { type: "string", enum: ["A", "B", "C", "D", "E", "F"] },
          text: { type: "string" },
          correct: { type: "boolean" },
          rationale: { type: "string" },
        },
      },
    },
    citation: {
      type: "object",
      additionalProperties: false,
      required: ["url", "title"],
      properties: { url: { type: "string" }, title: { type: "string" } },
    },
  },
};

/** SC-7: a model output parsed against the strict draft schema, or null (never throws). */
export function parseDraft(json: string): Draft | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  const parsed = DraftSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** SC-10: a stem reduced for duplicate checks: lower-case, letters and digits only. */
export function normalizeStem(stem: string): string {
  return stem.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

/** SC-10: drafts whose normalized stem repeats an existing question or an earlier draft are dropped. */
export function dropDuplicates(
  drafts: Draft[],
  existingStems: string[],
): { kept: Draft[]; dropped: Dropped[] } {
  const seen = new Set(existingStems.map(normalizeStem));
  const kept: Draft[] = [];
  const dropped: Dropped[] = [];
  drafts.forEach((draft, index) => {
    const key = normalizeStem(draft.stem);
    if (seen.has(key)) {
      dropped.push({ index, reason: "duplicate stem" });
      return;
    }
    seen.add(key);
    kept.push(draft);
  });
  return { kept, dropped };
}

/** Share of correct answers on one letter at which a batch is flagged (SC-7). */
export const LETTER_BIAS = 0.8;

/** SC-7: the letter that holds at least 80% of the correct answers in a batch, or null. */
export function answerLetterBias(drafts: Draft[]): string | null {
  const counts = new Map<string, number>();
  let total = 0;
  for (const draft of drafts)
    for (const option of draft.options)
      if (option.correct) {
        counts.set(option.id, (counts.get(option.id) ?? 0) + 1);
        total += 1;
      }
  if (total === 0) return null;
  for (const [letter, count] of counts)
    if (count / total >= LETTER_BIAS) return letter;
  return null;
}
