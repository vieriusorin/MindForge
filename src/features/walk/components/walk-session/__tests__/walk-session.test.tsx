import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlayableQuestion } from "@/engine/questions";
import { renderWithProviders } from "@/test/render";
import type { WalkStep } from "../../../types";
import { WalkSession } from "..";

const { answerWalkQuestion } = vi.hoisted(() => ({
  answerWalkQuestion: vi.fn(),
}));

// Mock at the facade the hook depends on: the Server Action.
vi.mock("@/features/walk/actions", () => ({ answerWalkQuestion }));

const question = (id: string, skillCode: string): PlayableQuestion => ({
  id,
  skillCode,
  origin: "ai",
  stem: `Stem of ${id}`,
  select: 1,
  options: [
    { id: "A", text: "First" },
    { id: "B", text: "Second" },
  ],
  source: { title: "Docs", url: "https://example.com" },
});

const STEPS: WalkStep[] = [
  { question: question("p.S1.1", "S1"), reason: "water" },
  { question: question("p.S2.1", "S2"), reason: "new" },
];

const GRADED = {
  ok: true,
  feedback: {
    correct: true,
    correctOptionIds: ["B"],
    rationales: { A: "Why A is wrong", B: "Why B is right" },
  },
} as const;

function renderWalk(steps: WalkStep[] = STEPS) {
  return renderWithProviders(
    <WalkSession
      packSlug="p"
      steps={steps}
      skillNames={{ S1: "Skill one", S2: "Skill two" }}
      todayHref="/today"
      duelHref="/play/p/duel"
    />,
  );
}

describe("WalkSession", () => {
  beforeEach(() => {
    answerWalkQuestion.mockReset();
  });

  it("SC-4: an empty walk says the forest is healthy and offers the Duel", () => {
    renderWalk([]);
    expect(
      screen.getByRole("heading", { name: "Your forest is healthy today" }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Play a Duel" })).toHaveAttribute(
      "href",
      "/play/p/duel",
    );
  });

  it("shows why the skill is in the walk", () => {
    renderWalk();
    expect(screen.getByText("Needs water")).toBeVisible();
    expect(screen.getByText("Question 1 of 2")).toBeVisible();
  });

  it("SC-5: keyboard only — pick, check, hear the verdict, move on with focus on the next stem", async () => {
    answerWalkQuestion.mockResolvedValue(GRADED);
    const { user } = renderWalk();

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("");

    // Tab into the radio group and pick with Space. Arrow-key roving needs real focus events
    // (Radix), so arrows are covered by the browser check, not jsdom.
    await user.tab();
    expect(screen.getByRole("radio", { name: /First/ })).toHaveFocus();
    await user.keyboard(" ");
    expect(screen.getByRole("radio", { name: /First/ })).toBeChecked();

    await user.tab();
    expect(screen.getByRole("button", { name: "Check answer" })).toHaveFocus();
    await user.keyboard("{Enter}");

    await waitFor(() =>
      expect(status).toHaveTextContent("Correct! Recalled and recorded."),
    );
    expect(status).toHaveFocus();
    expect(answerWalkQuestion.mock.calls[0]?.[0]).toEqual({
      packSlug: "p",
      questionId: "p.S1.1",
      chosen: ["A"],
    });
    expect(screen.getByText("Why B is right")).toBeVisible();

    await user.tab();
    expect(screen.getByRole("button", { name: "Next question" })).toHaveFocus();
    await user.keyboard("{Enter}");

    const nextStem = await screen.findByRole("heading", {
      name: "Stem of p.S2.1",
    });
    expect(nextStem).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("SC-5: each new question starts with keyboard focus on its first option, not the last pick", async () => {
    answerWalkQuestion.mockResolvedValue(GRADED);
    const { user } = renderWalk();

    await user.click(screen.getByRole("radio", { name: /Second/ }));
    await user.click(screen.getByRole("button", { name: "Check answer" }));
    await user.click(
      await screen.findByRole("button", { name: "Next question" }),
    );
    await screen.findByRole("heading", { name: "Stem of p.S2.1" });

    await user.tab();
    expect(screen.getByRole("radio", { name: /First/ })).toHaveFocus();
  });

  it("sends one attempt even when Check is clicked twice", async () => {
    let resolve: (value: typeof GRADED) => void = () => {};
    answerWalkQuestion.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    const { user } = renderWalk();

    await user.click(screen.getByRole("radio", { name: /First/ }));
    const check = screen.getByRole("button", { name: "Check answer" });
    await user.click(check);
    await user.click(check);
    resolve(GRADED);

    await screen.findByText("Correct! Recalled and recorded.");
    expect(answerWalkQuestion).toHaveBeenCalledTimes(1);
  });

  it("shows the server's message and keeps the question when grading fails", async () => {
    answerWalkQuestion.mockResolvedValue({
      ok: false,
      error: "This question doesn't belong to this pack.",
    });
    const { user } = renderWalk();

    await user.click(screen.getByRole("radio", { name: /First/ }));
    await user.click(screen.getByRole("button", { name: "Check answer" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This question doesn't belong to this pack.",
    );
    expect(screen.getByRole("button", { name: "Check answer" })).toBeEnabled();
  });

  it("says the server is unreachable on a network failure", async () => {
    answerWalkQuestion.mockRejectedValue(new Error("offline"));
    const { user } = renderWalk();

    await user.click(screen.getByRole("radio", { name: /First/ }));
    await user.click(screen.getByRole("button", { name: "Check answer" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not reach the server. Try again.",
    );
  });

  it("SC-5: finishing the walk moves focus to the end card", async () => {
    answerWalkQuestion.mockResolvedValue(GRADED);
    const { user } = renderWalk([STEPS[0] as WalkStep]);

    await user.click(screen.getByRole("radio", { name: /Second/ }));
    await user.click(screen.getByRole("button", { name: "Check answer" }));
    await user.click(
      await screen.findByRole("button", { name: "Finish the walk" }),
    );

    const done = await screen.findByRole("heading", {
      name: "Today's walk is done",
    });
    expect(done).toHaveFocus();
    expect(
      screen.getByRole("link", { name: "Back to your forest" }),
    ).toHaveAttribute("href", "/today");
  });
});
