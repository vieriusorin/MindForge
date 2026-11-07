/**
 * MF-0064 acceptance (SC-6): the lesson player as a learner meets it. The Server Action and the router
 * are mocked at the facade. Guess first is never graded (no action call, D-L4); feedback keeps the
 * rationale and citation behind "Why?" (D-L14); a missed item comes back once at the end as "Try again"
 * (D-L8); the last step opens the close screen with the page's start time (D-L10).
 */
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlayableQuestion } from "@/engine/questions";
import type { PlayerStep } from "@/features/lesson/types";
import { renderWithProviders } from "@/test/render";
import { LessonPlayer } from "..";

const { answerLessonItem, push } = vi.hoisted(() => ({
  answerLessonItem: vi.fn(),
  push: vi.fn(),
}));

vi.mock("@/features/lesson/actions", () => ({ answerLessonItem }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}));

const STARTED_AT = "2026-11-07T10:00:00.000Z";

function item(id: string, skillCode = "S1"): PlayableQuestion {
  return {
    id,
    skillCode,
    origin: "ai",
    stem: `Stem of ${id}`,
    select: 1,
    options: [
      { id: "A", text: "First" },
      { id: "B", text: "Second" },
      { id: "C", text: "Third" },
      { id: "D", text: "Fourth" },
    ],
    source: { title: "Docs page", url: "https://example.com/docs" },
    contentHash: `h-${id}`,
  };
}

function graded(correct: boolean) {
  return {
    ok: true,
    feedback: {
      correct,
      correctOptionIds: ["A"],
      rationales: {
        A: "Why A is right",
        B: "Why B is wrong",
        C: "Why C is wrong",
        D: "Why D is wrong",
      },
    },
  };
}

const STEPS: PlayerStep[] = [
  { kind: "guess", question: item("p.q1") },
  { kind: "card" },
  { kind: "diagram" },
  { kind: "recall", question: item("p.q1") },
  { kind: "recall", question: item("p.q2") },
  {
    kind: "confusable",
    question: item("p.q9", "S0"),
    skillName: "Agent loops",
  },
];

function renderPlayer(steps: PlayerStep[] = STEPS) {
  return renderWithProviders(
    <LessonPlayer
      packSlug="p"
      skillCode="S1"
      steps={steps}
      startedAt={STARTED_AT}
      card={<p>CARD SLOT</p>}
      diagram={<p>DIAGRAM SLOT</p>}
      mapHref="/play/p"
    />,
  );
}

type User = ReturnType<typeof renderPlayer>["user"];

async function answer(user: User, option: RegExp): Promise<void> {
  await user.click(screen.getByRole("radio", { name: option }));
  await user.click(screen.getByRole("button", { name: "Check answer" }));
}

describe("MF-0064 SC-6: the lesson player", () => {
  beforeEach(() => {
    answerLessonItem.mockReset();
    push.mockReset();
  });

  it("SC-6: guess, card, diagram, graded recalls with Why?, confusable, re-ask, then the close screen", async () => {
    answerLessonItem
      .mockResolvedValueOnce(graded(true))
      .mockResolvedValueOnce(graded(false))
      .mockResolvedValueOnce(graded(true))
      .mockResolvedValueOnce(graded(true));
    const { user } = renderPlayer();

    // Guess first: never graded, never recorded.
    expect(screen.getByText("Step 1 of 6")).toBeVisible();
    expect(screen.getByText(/isn't graded or recorded/)).toBeVisible();
    await user.click(screen.getByRole("radio", { name: /Second/ }));
    await user.click(screen.getByRole("button", { name: "Lock in guess" }));
    expect(answerLessonItem).not.toHaveBeenCalled();

    // Card and diagram advance with Continue.
    expect(screen.getByText("CARD SLOT")).toBeVisible();
    expect(screen.getByText("Step 2 of 6")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("DIAGRAM SLOT")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Continue" }));

    // First graded recall: the same item as the guess.
    expect(screen.getByText("Stem of p.q1")).toBeVisible();
    await answer(user, /First/);
    expect(
      await screen.findByText("Correct! Recalled and recorded."),
    ).toBeVisible();
    expect(answerLessonItem).toHaveBeenCalledTimes(1);
    // toMatchObject: MF-0067 adds `clientAttemptId` to every graded answer (coordinator, 2026-11-07).
    expect(answerLessonItem.mock.calls[0]?.[0]).toMatchObject({
      packSlug: "p",
      questionId: "p.q1",
      chosen: ["A"],
      contentHash: "h-p.q1",
    });
    expect(
      screen.getByText("Your guess before the lesson was not the answer."),
    ).toBeVisible();
    // The rationale and citation wait behind Why?.
    expect(screen.queryByText("Why A is right")).toBeNull();
    expect(screen.queryByRole("link", { name: /Docs page/ })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Why?" }));
    expect(screen.getByText("Why A is right")).toBeVisible();
    expect(screen.getByRole("link", { name: /Docs page/ })).toHaveProperty(
      "href",
      "https://example.com/docs",
    );
    await user.click(screen.getByRole("button", { name: "Next" }));

    // A wrong answer adds a re-ask at the end.
    await answer(user, /Second/);
    expect(
      await screen.findByText("Not quite. Read why, then carry on."),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Step 6 of 7")).toBeVisible();

    // The confusable step names its earlier skill.
    expect(
      screen.getByText("From an earlier skill: Agent loops"),
    ).toBeVisible();
    await answer(user, /First/);
    await screen.findByText("Correct! Recalled and recorded.");
    await user.click(screen.getByRole("button", { name: "Next" }));

    // The re-ask is graded again.
    expect(screen.getByText("Step 7 of 7")).toBeVisible();
    expect(screen.getByText("Try again")).toBeVisible();
    expect(screen.getByText("Stem of p.q2")).toBeVisible();
    await answer(user, /First/);
    await screen.findByText("Correct! Recalled and recorded.");
    expect(answerLessonItem).toHaveBeenCalledTimes(4);
    expect(answerLessonItem.mock.calls[3]?.[0]).toMatchObject({
      questionId: "p.q2",
    });

    await user.click(screen.getByRole("button", { name: "Finish lesson" }));
    expect(push).toHaveBeenCalledTimes(1);
    const url = new URL(String(push.mock.calls[0]?.[0]), "http://localhost");
    expect(url.pathname).toBe("/play/p/lesson/S1/done");
    expect(url.searchParams.get("since")).toBe(STARTED_AT);
  });

  it("SC-6: a right guess is named as right on the graded recall", async () => {
    answerLessonItem.mockResolvedValueOnce(graded(true));
    const { user } = renderPlayer([
      { kind: "guess", question: item("p.q1") },
      { kind: "recall", question: item("p.q1") },
    ]);
    await user.click(screen.getByRole("radio", { name: /First/ }));
    await user.click(screen.getByRole("button", { name: "Lock in guess" }));
    await answer(user, /First/);
    expect(
      await screen.findByText("Your guess before the lesson was right."),
    ).toBeVisible();
  });

  it("SC-6: an empty plan says there is nothing to learn and links back to the map", () => {
    renderPlayer([]);
    expect(
      screen.getByRole("heading", { name: "Nothing to learn here yet" }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Back to course map" }),
    ).toHaveProperty("pathname", "/play/p");
    expect(answerLessonItem).not.toHaveBeenCalled();
  });
});
