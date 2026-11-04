import type { FlowDiagramProps } from "@/components/flow-diagram";

export interface DiagramFigureProps extends FlowDiagramProps {
  /** Used for the caption and list ids; unique on the page. */
  id: string;
  title: string;
}
