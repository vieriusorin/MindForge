import type { DiagramBodyProps } from "../types";
import { Sources } from "./sources";

export function DiagramBody({ diagram }: DiagramBodyProps) {
  return (
    <div className="grid gap-4">
      <pre className="overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs">
        {diagram.mermaid}
      </pre>
      {diagram.nodes && (
        <ul className="grid gap-1">
          {diagram.nodes.map((node) => (
            <li key={node.id}>
              <span className="font-mono font-semibold">{node.id}</span>{" "}
              <span className="text-muted-foreground">{node.label}</span>
            </li>
          ))}
        </ul>
      )}
      <Sources urls={diagram.sources} />
    </div>
  );
}
