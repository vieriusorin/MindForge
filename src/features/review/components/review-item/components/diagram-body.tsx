import { DiagramFigure } from "@/components/diagram-figure";
import type { DiagramBodyProps } from "../types";
import { Sources } from "./sources";

/** ADR 0003: reviewers see the drawing and, as text, every node and edge they are approving. */
export function DiagramBody({ diagram }: DiagramBodyProps) {
  return (
    <div className="grid gap-4">
      <DiagramFigure
        id={`review-${diagram.id}`}
        title={diagram.title}
        direction={diagram.direction}
        nodes={diagram.nodes}
        edges={diagram.edges}
      />
      <ul aria-label="Nodes" className="grid gap-1">
        {diagram.nodes.map((node) => (
          <li key={node.id}>
            <span className="font-mono font-semibold">{node.id}</span>{" "}
            <span className="text-muted-foreground">{node.label}</span>
            {node.shape === "decision" && (
              <span className="text-muted-foreground"> (decision)</span>
            )}
          </li>
        ))}
      </ul>
      <ul aria-label="Edges" className="grid gap-1 font-mono text-sm">
        {diagram.edges.map((edge, i) => (
          <li key={`${edge.from}-${edge.to}-${i}`}>
            {edge.from} → {edge.to}
            {edge.label && (
              <span className="text-muted-foreground"> ({edge.label})</span>
            )}
          </li>
        ))}
      </ul>
      <Sources urls={diagram.sources} />
    </div>
  );
}
