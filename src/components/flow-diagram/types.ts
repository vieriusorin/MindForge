import type { Edge, Node } from "@xyflow/react";
import type {
  DiagramDirection,
  DiagramEdge,
  DiagramNode,
  DiagramNodeShape,
} from "@/engine/content";

export interface FlowDiagramProps {
  direction: DiagramDirection;
  nodes: readonly DiagramNode[];
  edges: readonly DiagramEdge[];
}

/** What a drawn node needs; `direction` decides which sides the arrows attach to. */
export type DiagramNodeData = {
  label: string;
  shape: DiagramNodeShape;
  direction: DiagramDirection;
};

export type FlowNode = Node<DiagramNodeData, "diagram">;

export interface FlowLayout {
  nodes: FlowNode[];
  edges: Edge[];
  /** Extent of the laid-out graph in px, so the canvas can keep its aspect. */
  width: number;
  height: number;
}
