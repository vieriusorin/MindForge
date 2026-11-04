import dagre from "@dagrejs/dagre";
import { MarkerType } from "@xyflow/react";
import type { FlowDiagramProps, FlowLayout } from "./types";

/** Every node is this wide; its height grows with the label (see `nodeHeight`). */
export const NODE_WIDTH = 184;
const CHARS_PER_LINE = 24;
const LINE_HEIGHT = 20;
const NODE_PADDING_Y = 24;

/** Dagre must know a node's size before React measures it; estimate from the wrapped label. */
export function nodeHeight(label: string): number {
  const lines = Math.max(1, Math.ceil(label.length / CHARS_PER_LINE));
  return lines * LINE_HEIGHT + NODE_PADDING_Y;
}

/**
 * ADR 0003: positions come from dagre (a layered layout), so authors write only the graph.
 * React Flow positions are a node's top-left corner; dagre returns centres.
 */
export function layoutDiagram({
  direction,
  nodes,
  edges,
}: FlowDiagramProps): FlowLayout {
  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ rankdir: direction, nodesep: 28, ranksep: 72 });
  graph.setDefaultEdgeLabel(() => ({}));
  for (const node of nodes) {
    graph.setNode(node.id, {
      width: NODE_WIDTH,
      height: nodeHeight(node.label),
    });
  }
  for (const edge of edges) graph.setEdge(edge.from, edge.to);
  dagre.layout(graph);

  const laidOut = nodes.map((node) => {
    const { x, y, width, height } = graph.node(node.id);
    return {
      id: node.id,
      type: "diagram" as const,
      position: { x: x - width / 2, y: y - height / 2 },
      width,
      height,
      data: {
        label: node.label,
        shape: node.shape ?? "step",
        direction,
      },
    };
  });

  return {
    nodes: laidOut,
    edges: edges.map((edge, i) => ({
      id: `${edge.from}-${edge.to}-${i}`,
      source: edge.from,
      target: edge.to,
      label: edge.label,
      type: "smoothstep",
      markerEnd: { type: MarkerType.ArrowClosed },
    })),
    width: Math.max(...laidOut.map((n) => n.position.x + n.width)),
    height: Math.max(...laidOut.map((n) => n.position.y + n.height)),
  };
}
