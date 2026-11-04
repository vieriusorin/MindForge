import { z } from "zod";
import { foreignSources, renderItemFile } from "./item-render";
import type {
  BatchRequest,
  CardDraft,
  CorpusEntry,
  Dropped,
  GeneratedBy,
  Prompt,
} from "./types";
import { buildItemWriterBatch } from "./writer";

const Https = z.url({ protocol: /^https$/ });

/**
 * MF-0014 SC-8: the only card shape accepted from the writer model, strict at every level. Counts and
 * lengths are enforced here because structured outputs do not enforce them. An empty or blank
 * "where it breaks" still parses, so the render step can drop it with a reason in the run report.
 */
const CardDraftSchema = z.strictObject({
  concept: z.string().trim().min(1).max(200),
  simply: z.string().trim().min(1).max(2000),
  inNature: z.string().trim().min(1).max(2000),
  whereItBreaks: z.array(z.string().max(1000)).max(8),
  contrast: z.string().trim().max(2000),
  whyTheName: z.string().trim().max(2000),
  sources: z.array(Https).min(1).max(5),
});

/** The JSON Schema sent as `output_config.format`; `CardDraftSchema` re-checks every reply. */
export const CARD_DRAFT_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: [
    "concept",
    "simply",
    "inNature",
    "whereItBreaks",
    "contrast",
    "whyTheName",
    "sources",
  ],
  properties: {
    concept: { type: "string" },
    simply: { type: "string" },
    inNature: { type: "string" },
    whereItBreaks: { type: "array", items: { type: "string" } },
    contrast: { type: "string" },
    whyTheName: { type: "string" },
    sources: { type: "array", items: { type: "string" } },
  },
};

/** SC-8: a model reply parsed against the strict card schema, or null (never throws). */
export function parseCardDraft(json: string): CardDraft | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  const parsed = CardDraftSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** SC-7: one Sonnet request per card draft on the cached corpus prefix. */
export function buildCardWriterBatch(input: {
  skill: { code: string; name: string };
  corpus: CorpusEntry[];
  request: number;
  prompt: Prompt;
}): BatchRequest[] {
  return buildItemWriterBatch({
    ...input,
    noun: "nature card",
    schema: CARD_DRAFT_JSON_SCHEMA,
  });
}

/** True when "where it breaks" says nothing: no entry, or a blank one (CONTEXT.md Nature card). */
export function isEmptyBreak(whereItBreaks: readonly string[]): boolean {
  return (
    whereItBreaks.length === 0 ||
    whereItBreaks.some((entry) => entry.trim().length === 0)
  );
}

function cardRejectReason(
  draft: CardDraft,
  sourceUrls: readonly string[],
): string | null {
  if (isEmptyBreak(draft.whereItBreaks))
    return "where it breaks is empty or has a blank entry";
  if (foreignSources(draft.sources, sourceUrls).length > 0)
    return "a source is not one of the skill's sources";
  return null;
}

/** Omit an optional text field the model left blank. */
const optional = (key: string, value: string): Record<string, string> =>
  value.trim() ? { [key]: value.trim() } : {};

/**
 * SC-3: one card file for a skill. `diagram` links the skill's only diagram when the caller found
 * one in the files; it is never read from the model.
 */
export function renderCardFile({
  sourceUrls,
  diagramId,
  ...input
}: {
  packSlug: string;
  skill: string;
  runTag: string;
  drafts: CardDraft[];
  author: string;
  generatedBy: GeneratedBy;
  sourceUrls: string[];
  diagramId: string | null;
}): { text: string; written: number; dropped: Dropped[] } {
  return renderItemFile({
    ...input,
    kind: "card",
    rejectReason: (draft) => cardRejectReason(draft, sourceUrls),
    body: (draft) => ({
      concept: draft.concept.trim(),
      simply: draft.simply.trim(),
      inNature: draft.inNature.trim(),
      whereItBreaks: draft.whereItBreaks.map((entry) => entry.trim()),
      ...optional("contrast", draft.contrast),
      ...optional("whyTheName", draft.whyTheName),
      ...(diagramId ? { diagram: diagramId } : {}),
      sources: [...draft.sources],
    }),
  });
}
