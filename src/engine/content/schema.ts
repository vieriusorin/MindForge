import { z } from "zod";
import { AuthorSchema, OriginSchema, refineAuthor } from "./origin";

/** Same id shape as questions: `<pack>.<skill>.<name>`, unique pack-wide across item types. */
const ItemId = z
  .string()
  .regex(
    /^[a-z0-9-]+\.[A-Za-z0-9.]+\.[a-z0-9-]+$/,
    "pattern <pack>.<skill>.<name>",
  );

/** Official doc links are rendered as hrefs: https only. */
const Sources = z.array(z.url({ protocol: /^https$/ })).min(1);

/** MINDFORGE §2.5 lists four diagram kinds: process flow, sequence, state, concept map. */
export const DIAGRAM_TYPES = [
  "flowchart",
  "graph",
  "sequenceDiagram",
  "stateDiagram",
  "stateDiagram-v2",
  "mindmap",
] as const;

const NatureCardSchema = z
  .strictObject({
    id: ItemId,
    concept: z.string().trim().min(1),
    origin: OriginSchema,
    author: AuthorSchema.optional(),
    simply: z.string().trim().min(1),
    inNature: z.string().trim().min(1),
    whereItBreaks: z
      .array(z.string().trim().min(1, "an empty entry says nothing"))
      .min(1, "a nature card must say where the analogy breaks"),
    contrast: z.string().trim().min(1).optional(),
    whyTheName: z.string().trim().min(1).optional(),
    diagram: ItemId.optional(),
    sources: Sources,
  })
  .superRefine(refineAuthor);

const DiagramSchema = z
  .strictObject({
    id: ItemId,
    title: z.string().trim().min(1),
    origin: OriginSchema,
    author: AuthorSchema.optional(),
    mermaid: z
      .string()
      .trim()
      .min(1)
      .refine(
        (text) =>
          (DIAGRAM_TYPES as readonly string[]).includes(
            text.split(/\s+/)[0] ?? "",
          ),
        { message: `must start with one of: ${DIAGRAM_TYPES.join(", ")}` },
      ),
    nodes: z
      .array(
        z.strictObject({
          id: z.string().min(1),
          label: z.string().trim().min(1),
        }),
      )
      .optional(),
    sources: Sources,
  })
  .superRefine(refineAuthor);

export const CardFileSchema = z.strictObject({
  skill: z.string().min(1),
  cards: z.array(NatureCardSchema).min(1),
});

export const DiagramFileSchema = z.strictObject({
  skill: z.string().min(1),
  diagrams: z.array(DiagramSchema).min(1),
});
