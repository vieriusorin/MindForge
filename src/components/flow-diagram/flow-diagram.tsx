"use client";

import "@xyflow/react/dist/base.css";
import { ReactFlow } from "@xyflow/react";
import { DiagramNodeView } from "./components/diagram-node";
import type { FlowDiagramProps } from "./types";
import { layoutDiagram } from "./utils";

const NODE_TYPES = { diagram: DiagramNodeView };

/**
 * ADR 0003: a read-only drawing. Every interaction is off: it is a picture whose words live in
 * the figure's lists (SC-3). Colours come from the shadcn tokens, so light/dark need no override.
 * Never import directly; go through `flow-diagram-lazy` (SC-2).
 */
export function FlowDiagram({ direction, nodes, edges }: FlowDiagramProps) {
  const layout = layoutDiagram({ direction, nodes, edges });
  return (
    <div
      className="w-full [--xy-attribution-background-color:transparent] [--xy-edge-stroke-width:1.5] [--xy-edge-stroke:var(--muted-foreground)] [&_.react-flow__attribution_a]:text-muted-foreground [&_.react-flow__edge-text]:fill-muted-foreground [&_.react-flow__edge-text]:text-xs [&_.react-flow__edge-textbg]:fill-background"
      style={{ aspectRatio: `${layout.width + 32} / ${layout.height + 32}` }}
    >
      <ReactFlow
        nodes={layout.nodes}
        edges={layout.edges}
        nodeTypes={NODE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.04 }}
        minZoom={0.2}
        nodesDraggable={false}
        nodesConnectable={false}
        nodesFocusable={false}
        edgesFocusable={false}
        elementsSelectable={false}
        panOnDrag={false}
        panOnScroll={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        preventScrolling={false}
        disableKeyboardA11y
      />
    </div>
  );
}
