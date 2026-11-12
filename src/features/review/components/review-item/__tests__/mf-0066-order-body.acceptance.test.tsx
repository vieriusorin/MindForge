/**
 * MF-0066 acceptance (frozen): SC-9, a reviewer sees everything an order item asserts: its key order with
 * node ids, the page sentences that order it, the explanation, the diagram it is drawn from and its source.
 */
import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { OrderItem } from "@/engine/content";
import { renderWithProviders } from "@/test/render";
import { ReviewItem } from "..";

const order: OrderItem = {
  id: "p.D2.S2.order-turn",
  skill: "D2.S2",
  title: "Put one client tool-use turn in order",
  origin: "ai",
  author: "a@example.com",
  diagram: "p.D2.S2.diagram-loop",
  steps: [
    { node: "REQ", label: "Send the request" },
    { node: "RUN", label: "Run the tool" },
    { node: "RES", label: "Send the result" },
  ],
  orderedBy: [
    "1. Extract the name, id, and input from the tool_use block.",
    "2. Run the actual tool in your code base.",
  ],
  explanation: "The request comes first; the result goes back last.",
  source: {
    title: "Handle tool calls",
    url: "https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls",
  },
};

describe("MF-0066 SC-9: ReviewItem with an order", () => {
  it("SC-9: labels the kind, lists the key order with node ids, the ordering sentences, the explanation, diagram and source", () => {
    renderWithProviders(
      <ReviewItem
        packItem={{ kind: "order", item: order }}
        skillName="The tool-use loop"
      />,
    );
    expect(screen.getByText("Order the steps")).toBeInTheDocument();
    expect(
      screen.getByText("Put one client tool-use turn in order"),
    ).toBeInTheDocument();

    const steps = within(
      screen.getByRole("list", { name: "Steps in order" }),
    ).getAllByRole("listitem");
    expect(steps.map((li) => li.textContent)).toEqual([
      expect.stringMatching(/REQ.*Send the request/),
      expect.stringMatching(/RUN.*Run the tool/),
      expect.stringMatching(/RES.*Send the result/),
    ]);

    const quotes = within(
      screen.getByRole("list", { name: "Ordered by" }),
    ).getAllByRole("listitem");
    expect(quotes.map((li) => li.textContent)).toEqual([
      expect.stringContaining(
        "1. Extract the name, id, and input from the tool_use block.",
      ),
      expect.stringContaining("2. Run the actual tool in your code base."),
    ]);

    expect(
      screen.getByText("The request comes first; the result goes back last."),
    ).toBeInTheDocument();
    expect(screen.getByText(/p\.D2\.S2\.diagram-loop/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Handle tool calls/ });
    expect(link).toHaveAttribute(
      "href",
      "https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls",
    );
  });
});
