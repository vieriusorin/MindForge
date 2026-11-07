import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PlayableQuestion } from "@/engine/questions";
import { renderWithProviders } from "@/test/render";
import { QuestionCard } from "..";

const QUESTION: PlayableQuestion = {
  id: "q1",
  skillCode: "S1",
  origin: "ai",
  stem: "Which one?",
  select: 1,
  options: [
    { id: "A", text: "First" },
    { id: "B", text: "Second" },
  ],
  source: { title: "Docs", url: "https://example.com" },
  contentHash: "h",
};

const FEEDBACK = {
  correct: false,
  correctOptionIds: ["A"],
  rationales: { A: "Why A is right", B: "Why B is wrong" },
};

function renderCard(showRationales?: boolean) {
  return renderWithProviders(
    <QuestionCard
      question={QUESTION}
      meta={null}
      chosen={["B"]}
      feedback={FEEDBACK}
      isLocked
      onToggle={() => {}}
      footer={null}
      showRationales={showRationales}
    />,
  );
}

describe("QuestionCard", () => {
  it("shows every rationale inline by default (every practice mode)", () => {
    renderCard();
    expect(screen.getByText("Why A is right")).toBeVisible();
    expect(screen.getByText("Why B is wrong")).toBeVisible();
  });

  it("MF-0064: showRationales false keeps the verdicts and leaves the rationales out", () => {
    renderCard(false);
    expect(screen.queryByText("Why A is right")).toBeNull();
    expect(screen.getByText(/Correct\./)).toBeVisible();
    expect(screen.getByText(/Not this one\./)).toBeVisible();
  });
});
