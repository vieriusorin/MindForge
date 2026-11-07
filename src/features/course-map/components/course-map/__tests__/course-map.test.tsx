/** MF-0062 review: the banner's actions are touch targets of at least 40 px (ui-design.md §5). */
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CourseMap as CourseMapData } from "@/engine/path";
import { renderWithProviders } from "@/test/render";
import { CourseMap } from "..";

const BASE: CourseMapData = {
  packSlug: "p",
  packName: "P",
  doneCount: 0,
  totalSkills: 1,
  wiltingSkills: 0,
  next: { kind: "next", skillCode: "a" },
  domains: [
    {
      domainCode: "A",
      name: "Domain A",
      weight: 100,
      doneCount: 0,
      skillCount: 1,
      checkpoint: null,
      nodes: [
        {
          skillCode: "a",
          name: "Skill A",
          weight: 100,
          stage: "seed",
          wilting: false,
          isDone: false,
          mode: "plant",
        },
      ],
    },
  ],
};

describe("CourseMap banner", () => {
  it("gives the Start link a 40 px minimum height", () => {
    renderWithProviders(<CourseMap packSlug="p" map={BASE} />);
    expect(screen.getByRole("link", { name: /^Start/ }).className).toMatch(
      /\bmin-h-10\b/,
    );
  });

  it("in the done state, links the pack's Duel with a 40 px target", () => {
    renderWithProviders(
      <CourseMap packSlug="p" map={{ ...BASE, next: { kind: "done" } }} />,
    );
    const duel = screen.getByRole("link", { name: /Play a Scenario Duel/ });
    expect(duel.getAttribute("href")).toBe("/play/p/duel");
    expect(duel.className).toMatch(/\bmin-h-10\b/);
  });
});
