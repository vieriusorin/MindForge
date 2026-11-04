import type { DiagramEdge, DiagramNode } from "@/engine/content";

/** SC-3: each arrow in words, "From → To (label)", using the node labels a reader just heard. */
export function connectionSentences(
  nodes: readonly DiagramNode[],
  edges: readonly DiagramEdge[],
): string[] {
  const labelOf = new Map(nodes.map((n) => [n.id, n.label]));
  return edges.map((edge) => {
    const line = `${labelOf.get(edge.from) ?? edge.from} → ${labelOf.get(edge.to) ?? edge.to}`;
    return edge.label ? `${line} (${edge.label})` : line;
  });
}
