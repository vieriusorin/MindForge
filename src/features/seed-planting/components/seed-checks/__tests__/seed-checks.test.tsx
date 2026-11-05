import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlayableQuestion } from "@/engine/questions";
import { renderWithProviders } from "@/test/render";
import { SeedChecks } from "..";

const { answerSeedCheck } = vi.hoisted(() => ({ answerSeedCheck: vi.fn() }));

// Mock at the facade the hook depends on: the Server Action.
vi.mock("@/features/seed-planting/actions", () => ({ answerSeedCheck }));

const check = (id: string): PlayableQuestion => ({
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
  contentHash: `h-${id}`,
});

const graded = (correct: boolean) => ({
  ok: true,
  feedback: {
    correct,
    correctOptionIds: ["B"],
    rationales: { A: "Why A is wrong", B: "Why B is right" },
  },
});

function renderChecks(
  checks = [check("p.S1.1"), check("p.S1.2")],
  wasSeed = true,
) {
  return renderWithProviders(
    <SeedChecks
      packSlug="p"
      checks={checks}
      wasSeed={wasSeed}
      forestHref="/today"
    />,
  );
}

async function answer(
  user: ReturnType<typeof renderChecks>["user"],
  next: string,
): Promise<void> {
  await user.click(screen.getByRole("radio", { name: /Second/ }));
  await user.click(screen.getByRole("button", { name: "Check answer" }));
  await user.click(await screen.findByRole("button", { name: next }));
}

describe("SeedChecks", () => {
  beforeEach(() => {
    answerSeedCheck.mockReset();
  });

  it("SC-4: one correct check out of two sprouts the seed, focus on the outcome", async () => {
    answerSeedCheck
      .mockResolvedValueOnce(graded(false))
      .mockResolvedValueOnce(graded(true));
    const { user } = renderChecks();

    expect(screen.getByText("Quick check 1 of 2")).toBeVisible();
    await answer(user, "Next check");
    await answer(user, "Finish planting");

    const done = await screen.findByRole("heading", {
      name: "Your seed sprouted",
    });
    expect(done).toHaveFocus();
    expect(answerSeedCheck).toHaveBeenCalledTimes(2);
    expect(answerSeedCheck.mock.calls[1]?.[0]).toEqual({
      packSlug: "p",
      questionId: "p.S1.2",
      chosen: ["B"],
      contentHash: "h-p.S1.2",
    });
    expect(screen.getByRole("link", { name: "Back to Today" })).toHaveAttribute(
      "href",
      "/today",
    );
  });

  it("SC-4: no correct check leaves it a seed", async () => {
    answerSeedCheck.mockResolvedValue(graded(false));
    const { user } = renderChecks([check("p.S1.1")]);

    await answer(user, "Finish planting");

    expect(
      await screen.findByRole("heading", { name: "Still a seed" }),
    ).toBeVisible();
  });

  it("a skill that was already growing only records the answers", async () => {
    answerSeedCheck.mockResolvedValue(graded(true));
    const { user } = renderChecks([check("p.S1.1")], false);

    await answer(user, "Finish planting");

    expect(
      await screen.findByRole("heading", { name: "Checks done" }),
    ).toBeVisible();
  });

  it("shows the server's message and keeps the check when grading fails", async () => {
    answerSeedCheck.mockResolvedValue({
      ok: false,
      error: "This question doesn't belong to this pack.",
    });
    const { user } = renderChecks();

    await user.click(screen.getByRole("radio", { name: /First/ }));
    await user.click(screen.getByRole("button", { name: "Check answer" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This question doesn't belong to this pack.",
    );
    expect(screen.getByRole("button", { name: "Check answer" })).toBeEnabled();
  });

  it("a skill without questions says so instead of offering checks", () => {
    renderChecks([]);
    expect(
      screen.getByRole("heading", { name: "No quick checks yet" }),
    ).toBeVisible();
  });
});
