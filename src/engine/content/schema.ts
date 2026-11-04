import { z } from "zod";
import { LevelSchema } from "./level";
import {
  AuthorSchema,
  GeneratedBySchema,
  OriginSchema,
  refineAuthor,
  refineGeneratedBy,
} from "./origin";

/** Same id shape as questions: `<pack>.<skill>.<name>`, unique pack-wide across item types. */
const ItemId = z
  .string()
  .regex(
    /^[a-z0-9-]+\.[A-Za-z0-9.]+\.[a-z0-9-]+$/,
    "pattern <pack>.<skill>.<name>",
  );

/** Official doc links are rendered as hrefs: https only. */
const Sources = z.array(z.url({ protocol: /^https$/ })).min(1);

/** MF-0016: the four kinds of text a cuckoo hides in (GOAL Objective). */
export const CUCKOO_SNIPPET_KINDS = [
  "prompt",
  "tool-result",
  "config",
  "hook",
] as const;

/** MF-0016: the planted flaw; `exposed-secret` covers D7.S4 (Identity, Secrets and Key Management). */
export const CUCKOO_FLAW_KINDS = [
  "injected-instruction",
  "false-claim",
  "unsafe-setting",
  "exposed-secret",
] as const;

/** ADR 0003: a diagram is a graph laid out left-to-right or top-to-bottom. */
export const DIAGRAM_DIRECTIONS = ["LR", "TB"] as const;

/** ADR 0003: a step (box) or a decision (diamond in the drawing, a question in words). */
export const DIAGRAM_NODE_SHAPES = ["step", "decision"] as const;

const NatureCardSchema = z
  .strictObject({
    id: ItemId,
    concept: z.string().trim().min(1),
    origin: OriginSchema,
    author: AuthorSchema.optional(),
    generatedBy: GeneratedBySchema.optional(),
    level: LevelSchema.optional(),
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
  .superRefine(refineAuthor)
  .superRefine(refineGeneratedBy);

const NodeId = z
  .string()
  .regex(
    /^[A-Za-z][A-Za-z0-9_-]*$/,
    "pattern: a letter, then letters, digits, _ or -",
  );

const DiagramSchema = z
  .strictObject({
    id: ItemId,
    title: z.string().trim().min(1),
    origin: OriginSchema,
    author: AuthorSchema.optional(),
    generatedBy: GeneratedBySchema.optional(),
    level: LevelSchema.optional(),
    direction: z.enum(DIAGRAM_DIRECTIONS),
    nodes: z
      .array(
        z.strictObject({
          id: NodeId,
          label: z.string().trim().min(1),
          shape: z.enum(DIAGRAM_NODE_SHAPES).optional(),
        }),
      )
      .min(2, "a diagram needs at least two nodes"),
    edges: z
      .array(
        z.strictObject({
          from: NodeId,
          to: NodeId,
          label: z.string().trim().min(1).optional(),
        }),
      )
      .min(1, "a diagram needs at least one edge"),
    sources: Sources,
  })
  .superRefine(refineAuthor)
  .superRefine(refineGeneratedBy)
  .superRefine((diagram, ctx) => {
    // ADR 0003: the graph must be drawable — unique node ids, no edge to a missing node.
    const seen = new Set<string>();
    diagram.nodes.forEach((node, i) => {
      if (seen.has(node.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["nodes", i, "id"],
          message: `duplicate node id "${node.id}"`,
        });
      }
      seen.add(node.id);
    });
    diagram.edges.forEach((edge, i) => {
      for (const end of ["from", "to"] as const) {
        if (!seen.has(edge[end])) {
          ctx.addIssue({
            code: "custom",
            path: ["edges", i, end],
            message: `unknown node "${edge[end]}"`,
          });
        }
      }
    });
  });

export const CardFileSchema = z.strictObject({
  skill: z.string().min(1),
  cards: z.array(NatureCardSchema).min(1),
});

export const DiagramFileSchema = z.strictObject({
  skill: z.string().min(1),
  diagrams: z.array(DiagramSchema).min(1),
});

/** MF-0016: a short snippet; long enough to hide a line in, short enough to read on a phone. */
export const CUCKOO_MIN_LINES = 3;
export const CUCKOO_MAX_LINES = 20;

const CuckooSchema = z
  .strictObject({
    id: ItemId,
    title: z.string().trim().min(1),
    origin: OriginSchema,
    author: AuthorSchema.optional(),
    generatedBy: GeneratedBySchema.optional(),
    snippetKind: z.enum(CUCKOO_SNIPPET_KINDS),
    // Blank lines are allowed (code has them); the flawed line may not be one.
    lines: z.array(z.string()).min(CUCKOO_MIN_LINES).max(CUCKOO_MAX_LINES),
    flawLine: z.number().int().min(1, "lines are numbered from 1"),
    flawKind: z.enum(CUCKOO_FLAW_KINDS),
    explanation: z.string().trim().min(1),
    sources: Sources,
  })
  .superRefine(refineAuthor)
  .superRefine(refineGeneratedBy)
  .superRefine((cuckoo, ctx) => {
    const line = cuckoo.lines[cuckoo.flawLine - 1];
    if (line === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["flawLine"],
        message: `flawLine ${cuckoo.flawLine} is past the last line (${cuckoo.lines.length})`,
      });
    } else if (line.trim() === "") {
      ctx.addIssue({
        code: "custom",
        path: ["flawLine"],
        message: `flawLine ${cuckoo.flawLine} is a blank line`,
      });
    }
  });

export const CuckooFileSchema = z.strictObject({
  skill: z.string().min(1),
  cuckoos: z.array(CuckooSchema).min(1),
});
