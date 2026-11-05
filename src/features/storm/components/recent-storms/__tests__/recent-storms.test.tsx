import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test/render";
import { RecentStorms } from "../recent-storms";

// MF-0052 SC-11 (review finding): the list's markup — none rendered without rows, one link per row
// to its report, the verdict in words (never colour alone).
describe("RecentStorms", () => {
  it("renders nothing when there is no finished storm", () => {
    const { container } = renderWithProviders(<RecentStorms rows={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("links each row to its report and names its verdict", () => {
    renderWithProviders(
      <RecentStorms
        rows={[
          {
            id: "a",
            href: "/storms/a",
            finishedAt: "2026-11-01T15:13:00.000Z",
            kindLabel: "Full Storm",
            survived: false,
          },
          {
            id: "b",
            href: "/storms/b",
            finishedAt: "2026-10-31T15:08:00.000Z",
            kindLabel: "Boss Storm: Applications and Integration",
            survived: true,
          },
        ]}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Your recent storms" }),
    ).toBeInTheDocument();
    const links = screen.getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual([
      "/storms/a",
      "/storms/b",
    ]);
    expect(links[0]).toHaveTextContent("Full Storm");
    expect(links[0]).toHaveTextContent("Not survived");
    expect(links[1]).toHaveTextContent(
      "Boss Storm: Applications and Integration",
    );
    expect(links[1]).toHaveTextContent(/^.*Survived$/);
  });
});
