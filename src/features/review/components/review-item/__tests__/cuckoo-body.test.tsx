// MF-0016 SC-9: a reviewer sees every line of a cuckoo, which one is the flaw, its kind and why.
import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Cuckoo } from "@/engine/content";
import { renderWithProviders } from "@/test/render";
import { ReviewItem } from "..";

const cuckoo: Cuckoo = {
  id: "p.S1.cuckoo-1",
  skill: "S1",
  title: "A hook config",
  origin: "ai",
  author: "a@example.com",
  snippetKind: "config",
  lines: ["hooks:", '  "PostToolUse": [', "  ]"],
  flawLine: 2,
  flawKind: "unsafe-setting",
  explanation: "PostToolUse runs after the tool.",
  sources: ["https://code.claude.com/docs/en/hooks"],
};

describe("ReviewItem with a cuckoo", () => {
  it("lists every line, marks the flawed one, and names its kind and reason", () => {
    renderWithProviders(
      <ReviewItem
        packItem={{ kind: "cuckoo", item: cuckoo }}
        skillName="Hooks"
      />,
    );
    const lines = within(
      screen.getByRole("list", { name: "Snippet lines" }),
    ).getAllByRole("listitem");
    expect(lines.map((li) => li.textContent)).toEqual([
      "1hooks:",
      '2  "PostToolUse": [Cuckoo',
      "3  ]",
    ]);
    expect(screen.getByText("Spot the Cuckoo")).toBeInTheDocument();
    expect(screen.getByText("Unsafe setting")).toBeInTheDocument();
    expect(
      screen.getByText("PostToolUse runs after the tool."),
    ).toBeInTheDocument();
  });
});
