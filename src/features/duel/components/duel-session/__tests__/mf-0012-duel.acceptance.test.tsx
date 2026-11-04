// MF-0012 acceptance (frozen): SC-1 double submit, SC-2 live region + focus, SC-3 labelled groups.
import { act, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlayableQuestion } from "@/engine/questions";
import { renderHookWithProviders, renderWithProviders } from "@/test/render";
import { DuelSession } from "..";
import { useDuelSession } from "../hooks/use-duel-session";

const { answerQuestion } = vi.hoisted(() => ({ answerQuestion: vi.fn() }));

// Mock at the facade the hook depends on: the Server Action.
vi.mock("@/features/duel/actions", () => ({ answerQuestion }));

const question = (id: string): PlayableQuestion => ({
  id,
  skillCode: "S1",
  origin: "ai",
  stem: `Stem of ${id}`,
  select: 1,
  options: [
    { id: "A", text: "First" },
    { id: "B", text: "Second" },
  ],
  source: { title: "Docs", url: "https://example.com" },
});

const QUESTIONS = [question("p.S1.1"), question("p.S1.2")];

const GRADED = {
  ok: true,
  feedback: {
    correct: true,
    correctOptionIds: ["A"],
    rationales: { A: "Why A is right", B: "Why B is wrong" },
  },
} as const;

function renderDuel() {
  return renderWithProviders(
    <DuelSession
      packSlug="p"
      questions={QUESTIONS}
      skillNames={{ S1: "Skill one" }}
      back={{ href: "/today", label: "Back to your forest" }}
    />,
  );
}

describe("MF-0012 Duel", () => {
  beforeEach(() => {
    answerQuestion.mockReset();
  });

  it("SC-1: two submits before a re-render record one attempt", async () => {
    answerQuestion.mockResolvedValue(GRADED);
    const { result } = renderHookWithProviders(() =>
      useDuelSession("p", QUESTIONS),
    );

    act(() => result.current.toggle("A"));
    act(() => {
      result.current.submit();
      result.current.submit();
    });

    await waitFor(() => expect(result.current.feedback).not.toBeNull());
    expect(answerQuestion).toHaveBeenCalledTimes(1);
  });

  it("SC-2: the live region is mounted empty, then holds the verdict; focus goes to it, then to the next stem", async () => {
    answerQuestion.mockResolvedValue(GRADED);
    const { user } = renderDuel();

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("");

    await user.click(screen.getByRole("radio", { name: /First/ }));
    await user.click(screen.getByRole("button", { name: "Check answer" }));

    await waitFor(() =>
      expect(status).toHaveTextContent("Correct! Recalled and recorded."),
    );
    expect(status).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Next question" }));

    const nextStem = await screen.findByRole("heading", {
      name: "Stem of p.S1.2",
    });
    expect(nextStem).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("SC-3: the card is a group named by its stem, holding a group named Options", () => {
    renderDuel();

    const card = screen.getByRole("group", { name: "Stem of p.S1.1" });
    const options = within(card).getByRole("group", { name: "Options" });
    expect(within(options).getAllByRole("radio")).toHaveLength(2);
  });
});
