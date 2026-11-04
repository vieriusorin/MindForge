import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DiagramEdge, DiagramNode } from "@/engine/content";
import { DiagramFigure } from "..";

// Re-frozen 2026-11-04 (user decision, ADR 0003): diagrams are graphs drawn with React Flow.
// React Flow can't lay out in jsdom; the lazy wrapper is the facade (testing.md: mock at the
// facade). It stands in for the drawn graph, which assistive tech must NOT reach.
vi.mock("@/components/flow-diagram-lazy", () => ({
  FlowDiagramLazy: () => <div role="img" aria-label="drawn graph" />,
}));

const TITLE = "Temperature as wind: where the seeds land";
const NODES: DiagramNode[] = [
  { id: "L", label: "Model logits (the parent tree)" },
  { id: "T", label: "Temperature (wind strength)", shape: "decision" },
  { id: "C", label: "Seeds land under the tree" },
];
const EDGES: DiagramEdge[] = [
  { from: "L", to: "T" },
  { from: "T", to: "C", label: "low" },
];

function renderFigure() {
  return render(
    <DiagramFigure
      id="d1"
      title={TITLE}
      direction="LR"
      nodes={NODES}
      edges={EDGES}
    />,
  );
}

describe("MF-0010 DiagramFigure", () => {
  it("SC-3: the figure is named by the diagram title", () => {
    renderFigure();
    expect(screen.getByRole("figure", { name: TITLE })).toBeInTheDocument();
  });

  it("SC-3: every node label is read as a list item, in order", () => {
    renderFigure();
    const figure = screen.getByRole("figure", { name: TITLE });
    const steps = within(figure).getByRole("list", { name: "Steps" });
    expect(
      within(steps)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual([
      "Model logits (the parent tree)",
      "Temperature (wind strength)",
      "Seeds land under the tree",
    ]);
  });

  it("SC-3: every connection is read in words, with its label", () => {
    renderFigure();
    const figure = screen.getByRole("figure", { name: TITLE });
    const links = within(figure).getByRole("list", { name: "Connections" });
    expect(
      within(links)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual([
      "Model logits (the parent tree) → Temperature (wind strength)",
      "Temperature (wind strength) → Seeds land under the tree (low)",
    ]);
  });

  it("SC-3: the drawn graph is hidden from assistive tech", () => {
    renderFigure();
    expect(
      screen.queryByRole("img", { name: "drawn graph" }),
    ).not.toBeInTheDocument();
  });
});
