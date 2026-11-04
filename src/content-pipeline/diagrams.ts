import { z } from "zod";
import { foreignSources, renderItemFile } from "./item-render";
import type {
  BatchRequest,
  CorpusEntry,
  DiagramDraft,
  Dropped,
  GeneratedBy,
  Prompt,
} from "./types";
import { buildItemWriterBatch } from "./writer";

/** ADR 0003 node id, as in the pack schema. */
const NodeId = z.string().regex(/^[A-Za-z][A-Za-z0-9_-]*$/);
const Label = z.string().trim().max(200);

/**
 * MF-0014 SC-8: the only diagram shape accepted from the writer model, strict at every level.
 * Graph rules (enough nodes, known edge ends) are checked by `graphProblem`, so a bad graph is
 * dropped with a reason in the run report rather than vanishing as unparseable.
 */
const DiagramDraftSchema = z.strictObject({
  title: z.string().trim().min(1).max(200),
  direction: z.enum(["LR", "TB"]),
  nodes: z
    .array(
      z.strictObject({
        id: NodeId,
        label: Label.min(1),
        shape: z.enum(["step", "decision"]),
      }),
    )
    .max(20),
  edges: z
    .array(z.strictObject({ from: NodeId, to: NodeId, label: Label }))
    .max(40),
  sources: z
    .array(z.url({ protocol: /^https$/ }))
    .min(1)
    .max(5),
});

/** The JSON Schema sent as `output_config.format`; `DiagramDraftSchema` re-checks every reply. */
export const DIAGRAM_DRAFT_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["title", "direction", "nodes", "edges", "sources"],
  properties: {
    title: { type: "string" },
    direction: { type: "string", enum: ["LR", "TB"] },
    nodes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "label", "shape"],
        properties: {
          id: { type: "string" },
          label: { type: "string" },
          shape: { type: "string", enum: ["step", "decision"] },
        },
      },
    },
    edges: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["from", "to", "label"],
        properties: {
          from: { type: "string" },
          to: { type: "string" },
          label: { type: "string" },
        },
      },
    },
    sources: { type: "array", items: { type: "string" } },
  },
};

/** SC-8: a model reply parsed against the strict diagram schema, or null (never throws). */
export function parseDiagramDraft(json: string): DiagramDraft | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  const parsed = DiagramDraftSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** SC-7: one Sonnet request per diagram draft on the cached corpus prefix. */
export function buildDiagramWriterBatch(input: {
  skill: { code: string; name: string };
  corpus: CorpusEntry[];
  request: number;
  prompt: Prompt;
}): BatchRequest[] {
  return buildItemWriterBatch({
    ...input,
    noun: "diagram",
    schema: DIAGRAM_DRAFT_JSON_SCHEMA,
  });
}

/**
 * SC-4: why a graph cannot be drawn (the pack schema's rules, ADR 0003), or null. Checked in the
 * order a reader would fix them.
 */
export function graphProblem(graph: {
  nodes: readonly { id: string }[];
  edges: readonly { from: string; to: string }[];
}): string | null {
  if (graph.nodes.length < 2) return "a diagram needs at least two nodes";
  if (graph.edges.length < 1) return "a diagram needs at least one edge";
  const ids = new Set<string>();
  for (const node of graph.nodes) {
    if (ids.has(node.id)) return `duplicate node id "${node.id}"`;
    ids.add(node.id);
  }
  for (const edge of graph.edges)
    for (const end of [edge.from, edge.to])
      if (!ids.has(end)) return `edge to unknown node "${end}"`;
  return null;
}

function diagramRejectReason(
  draft: DiagramDraft,
  sourceUrls: readonly string[],
): string | null {
  const problem = graphProblem(draft);
  if (problem) return problem;
  if (foreignSources(draft.sources, sourceUrls).length > 0)
    return "a source is not one of the skill's sources";
  return null;
}

/** SC-4: one diagram file for a skill. A step node and an empty edge label are written as absent. */
export function renderDiagramFile({
  sourceUrls,
  ...input
}: {
  packSlug: string;
  skill: string;
  runTag: string;
  drafts: DiagramDraft[];
  author: string;
  generatedBy: GeneratedBy;
  sourceUrls: string[];
}): { text: string; written: number; dropped: Dropped[] } {
  return renderItemFile({
    ...input,
    kind: "diagram",
    rejectReason: (draft) => diagramRejectReason(draft, sourceUrls),
    body: (draft) => ({
      title: draft.title.trim(),
      direction: draft.direction,
      nodes: draft.nodes.map((n) => ({
        id: n.id,
        label: n.label.trim(),
        ...(n.shape === "decision" ? { shape: "decision" } : {}),
      })),
      edges: draft.edges.map((e) => ({
        from: e.from,
        to: e.to,
        ...(e.label.trim() ? { label: e.label.trim() } : {}),
      })),
      sources: [...draft.sources],
    }),
  });
}
