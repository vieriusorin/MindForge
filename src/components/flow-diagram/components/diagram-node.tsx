import { Handle, type NodeProps, Position } from "@xyflow/react";
import { BaseNode, BaseNodeContent } from "@/components/ui/base-node";
import { cn } from "@/lib/utils";
import type { FlowNode } from "../types";

const SIDES = {
  LR: { target: Position.Left, source: Position.Right },
  TB: { target: Position.Top, source: Position.Bottom },
} as const;

/** One step of a diagram. Decisions read as questions: violet tint and border, no diamond. */
export function DiagramNodeView({ data }: NodeProps<FlowNode>) {
  const sides = SIDES[data.direction];
  return (
    <BaseNode
      // The drawing is hidden from assistive tech (SC-3); nothing inside it may take focus.
      tabIndex={-1}
      className={cn(
        "flex h-full items-center rounded-lg shadow-sm hover:ring-0",
        data.shape === "decision" &&
          "border-primary bg-secondary text-secondary-foreground",
      )}
    >
      <Handle type="target" position={sides.target} className="invisible" />
      <BaseNodeContent className="w-full px-3 py-2 text-center text-sm leading-5">
        {data.label}
      </BaseNodeContent>
      <Handle type="source" position={sides.source} className="invisible" />
    </BaseNode>
  );
}
