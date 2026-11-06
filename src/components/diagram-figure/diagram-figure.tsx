import { FlowDiagramLazy } from "@/components/flow-diagram-lazy";
import type { DiagramFigureProps } from "./types";
import { connectionSentences } from "./utils";

/**
 * MF-0010 SC-3: the title names the figure; the steps and every connection are read as lists.
 * The drawing itself is hidden from assistive tech: it repeats the lists, laid out in space.
 * `inert` also keeps keyboard focus out of it: React Flow's attribution is a real link, and a
 * focusable element under `aria-hidden` is announced as nothing.
 */
export function DiagramFigure({
  id,
  title,
  direction,
  nodes,
  edges,
}: DiagramFigureProps) {
  const titleId = `${id}-title`;
  return (
    <figure aria-labelledby={titleId} className="flex flex-col gap-3">
      <figcaption id={titleId} className="font-medium">
        {title}
      </figcaption>
      <div aria-hidden inert className="rounded-lg border bg-background p-2">
        <FlowDiagramLazy direction={direction} nodes={nodes} edges={edges} />
      </div>
      <div className="sr-only">
        <ul aria-label="Steps">
          {nodes.map((node) => (
            <li key={node.id}>{node.label}</li>
          ))}
        </ul>
        <ul aria-label="Connections">
          {connectionSentences(nodes, edges).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
    </figure>
  );
}
