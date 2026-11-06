import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DiagramFigure } from "..";

// React Flow draws its "React Flow" attribution as a real link inside the drawing; the stand-in
// keeps that link so the test sees what the browser does (testing.md: mock at the facade).
vi.mock("@/components/flow-diagram-lazy", () => ({
  FlowDiagramLazy: () => <a href="https://reactflow.dev">React Flow</a>,
}));

describe("DiagramFigure", () => {
  // jsdom and user-event ignore `inert`, so Tab can't prove this here; browsers skip an inert
  // subtree for focus and assistive tech (proven in Chrome, MF-0010 LOOP-VERIFY).
  it("MF-0010 SC-3: links inside the hidden drawing sit in an inert subtree", () => {
    render(
      <DiagramFigure
        id="d1"
        title="Temperature as wind"
        direction="LR"
        nodes={[{ id: "A", label: "Model logits" }]}
        edges={[]}
      />,
    );

    const link = screen.getByText("React Flow");
    expect(link.closest("[inert]")).not.toBeNull();
    expect(link.closest("[aria-hidden='true']")).not.toBeNull();
  });
});
