import { describe, expect, it } from "vitest";
import { layoutDiagram, NODE_WIDTH, nodeHeight } from "../utils";

const NODES = [
  { id: "A", label: "Start" },
  { id: "B", label: "Decide", shape: "decision" as const },
  { id: "C", label: "End" },
];
const EDGES = [
  { from: "A", to: "B" },
  { from: "B", to: "C", label: "yes" },
];

describe("nodeHeight", () => {
  it("grows one line per 24 characters of label", () => {
    expect(nodeHeight("short")).toBe(44);
    expect(nodeHeight("x".repeat(24))).toBe(44);
    expect(nodeHeight("x".repeat(25))).toBe(64);
  });
});

describe("layoutDiagram", () => {
  it("LR puts each step to the right of the one before it", () => {
    const layout = layoutDiagram({
      direction: "LR",
      nodes: NODES,
      edges: EDGES,
    });
    const x = (id: string) =>
      layout.nodes.find((n) => n.id === id)?.position.x ?? Number.NaN;
    expect(x("A")).toBeLessThan(x("B"));
    expect(x("B")).toBeLessThan(x("C"));
  });

  it("TB puts each step below the one before it", () => {
    const layout = layoutDiagram({
      direction: "TB",
      nodes: NODES,
      edges: EDGES,
    });
    const y = (id: string) =>
      layout.nodes.find((n) => n.id === id)?.position.y ?? Number.NaN;
    expect(y("A")).toBeLessThan(y("B"));
    expect(y("B")).toBeLessThan(y("C"));
  });

  it("keeps the author's labels, shapes (default step) and edge labels, with an arrow on every edge", () => {
    const layout = layoutDiagram({
      direction: "LR",
      nodes: NODES,
      edges: EDGES,
    });
    expect(layout.nodes.map((n) => [n.id, n.data.label, n.data.shape])).toEqual(
      [
        ["A", "Start", "step"],
        ["B", "Decide", "decision"],
        ["C", "End", "step"],
      ],
    );
    expect(layout.nodes.every((n) => n.width === NODE_WIDTH)).toBe(true);
    expect(layout.edges.map((e) => [e.source, e.target, e.label])).toEqual([
      ["A", "B", undefined],
      ["B", "C", "yes"],
    ]);
    expect(layout.edges.every((e) => e.markerEnd !== undefined)).toBe(true);
  });

  it("reports the drawing's extent so the canvas keeps its aspect", () => {
    const layout = layoutDiagram({
      direction: "LR",
      nodes: NODES,
      edges: EDGES,
    });
    expect(layout.width).toBeGreaterThanOrEqual(3 * NODE_WIDTH);
    expect(layout.height).toBeGreaterThanOrEqual(nodeHeight("Start"));
  });
});
