/**
 * MF-0064 acceptance (SC-7): the close screen. Given the engine's `LessonOutcome`, each skill shows its
 * tree before and after in words, its score in this lesson and its next review date (D-L11, D-L12);
 * one link goes back to the course map; no XP, streak or league (D-3).
 */
import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { LessonOutcome } from "@/engine/lesson";
import { renderWithProviders } from "@/test/render";
import { LessonClose } from "..";

const OUTCOME: LessonOutcome = {
  packSlug: "demo",
  skillCode: "A2",
  skills: [
    {
      skillCode: "A2",
      name: "Context windows",
      before: { stage: "seed", wilting: false },
      after: { stage: "sprout", wilting: false },
      change: "grew",
      answeredCount: 1,
      correctCount: 1,
      nextReviewAt: new Date("2026-11-06T10:01:00.000Z"),
    },
    {
      skillCode: "A1",
      name: "Tool design",
      before: { stage: "seed", wilting: false },
      after: { stage: "seed", wilting: false },
      change: "same",
      answeredCount: 2,
      correctCount: 0,
      nextReviewAt: null,
    },
    {
      skillCode: "B1",
      name: "System prompts",
      before: { stage: "sapling", wilting: true },
      after: { stage: "sapling", wilting: false },
      change: "watered",
      answeredCount: 1,
      correctCount: 1,
      nextReviewAt: new Date("2026-12-24T09:00:00.000Z"),
    },
    {
      skillCode: "B2",
      name: "Few-shot examples",
      before: { stage: "sapling", wilting: false },
      after: { stage: "sprout", wilting: false },
      change: "shrank",
      answeredCount: 1,
      correctCount: 0,
      nextReviewAt: new Date("2026-11-08T09:00:00.000Z"),
    },
  ],
};

function row(name: string): HTMLElement {
  const item = screen
    .getAllByRole("listitem")
    .find((li) => within(li).queryByText(name));
  if (!item) throw new Error(`no row for ${name}`);
  return item;
}

describe("MF-0064 SC-7: the close screen", () => {
  it("SC-7: each skill shows its real change, score and next review date", () => {
    renderWithProviders(<LessonClose outcome={OUTCOME} mapHref="/play/demo" />);
    expect(
      screen.getByRole("heading", { name: "Lesson complete" }),
    ).toBeVisible();

    const grew = row("Context windows");
    expect(within(grew).getByText("Seed → Sprout")).toBeVisible();
    expect(within(grew).getByText("1 of 1 correct")).toBeVisible();
    expect(within(grew).getByText("Next review: Nov 6, 2026")).toBeVisible();

    const same = row("Tool design");
    expect(within(same).getByText("Still a Seed")).toBeVisible();
    expect(within(same).getByText("0 of 2 correct")).toBeVisible();
    expect(
      within(same).getByText("No review date: a seed does not fade"),
    ).toBeVisible();

    const watered = row("System prompts");
    expect(within(watered).getByText("Watered: Sapling")).toBeVisible();
    expect(
      within(watered).getByText("Next review: Dec 24, 2026"),
    ).toBeVisible();

    const shrank = row("Few-shot examples");
    expect(within(shrank).getByText("Back to Sprout")).toBeVisible();
  });

  it("SC-7: one link back to the course map, and no XP, streak or league", () => {
    const { container } = renderWithProviders(
      <LessonClose outcome={OUTCOME} mapHref="/play/demo" />,
    );
    expect(
      screen.getByRole("link", { name: "Back to course map" }),
    ).toHaveProperty("pathname", "/play/demo");
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/\bXP\b/);
    expect(text).not.toMatch(/streak/i);
    expect(text).not.toMatch(/league/i);
  });
});
