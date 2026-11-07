/**
 * MF-0032 acceptance (SC-4): every question mode sends the content hash its page was rendered from.
 * Fixtures are built untyped so they carry `contentHash` before the DTO gains it; the Server Actions
 * are mocked at the facade each hook depends on.
 */
import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DuelSession } from "@/features/duel/components/duel-session";
import { SeedChecks } from "@/features/seed-planting/components/seed-checks";
import { WalkSession } from "@/features/walk/components/walk-session";
import { renderWithProviders } from "@/test/render";

const { answerQuestion, answerWalkQuestion, answerSeedCheck } = vi.hoisted(
  () => ({
    answerQuestion: vi.fn(),
    answerWalkQuestion: vi.fn(),
    answerSeedCheck: vi.fn(),
  }),
);

vi.mock("@/features/duel/actions", () => ({ answerQuestion }));
vi.mock("@/features/walk/actions", () => ({ answerWalkQuestion }));
vi.mock("@/features/seed-planting/actions", () => ({ answerSeedCheck }));

const question = (id: string) => ({
  id,
  skillCode: "S1",
  origin: "ai" as const,
  stem: `Stem of ${id}`,
  select: 1,
  options: [
    { id: "A", text: "First" },
    { id: "B", text: "Second" },
  ],
  source: { title: "Docs", url: "https://example.com" },
  contentHash: `h-${id}`,
});

const GRADED = {
  ok: true,
  feedback: {
    correct: true,
    correctOptionIds: ["B"],
    rationales: { A: "Why A is wrong", B: "Why B is right" },
  },
} as const;

const EXPECTED = {
  packSlug: "p",
  questionId: "p.S1.1",
  chosen: ["B"],
  contentHash: "h-p.S1.1",
  // MF-0067: every answer also carries a client attempt id
  clientAttemptId: expect.any(String),
};

describe("MF-0032 SC-4: the answer carries the hash the page showed", () => {
  beforeEach(() => {
    for (const fn of [answerQuestion, answerWalkQuestion, answerSeedCheck]) {
      fn.mockReset();
      fn.mockResolvedValue(GRADED);
    }
  });

  it("SC-4: Duel", async () => {
    const { user } = renderWithProviders(
      <DuelSession
        packSlug="p"
        questions={[question("p.S1.1")]}
        skillNames={{ S1: "Skill one" }}
        back={{ href: "/today", label: "Back to your forest" }}
      />,
    );
    await user.click(screen.getByRole("radio", { name: /Second/ }));
    await user.click(screen.getByRole("button", { name: "Check answer" }));
    await waitFor(() => expect(answerQuestion).toHaveBeenCalledTimes(1));
    expect(answerQuestion.mock.calls[0]?.[0]).toEqual(EXPECTED);
  });

  it("SC-4: Walk", async () => {
    const { user } = renderWithProviders(
      <WalkSession
        packSlug="p"
        steps={[{ question: question("p.S1.1"), reason: "water" }]}
        skillNames={{ S1: "Skill one" }}
        todayHref="/today"
        duelHref="/play/p/duel"
      />,
    );
    await user.click(screen.getByRole("radio", { name: /Second/ }));
    await user.click(screen.getByRole("button", { name: "Check answer" }));
    await waitFor(() => expect(answerWalkQuestion).toHaveBeenCalledTimes(1));
    expect(answerWalkQuestion.mock.calls[0]?.[0]).toEqual(EXPECTED);
  });

  it("SC-4: Seed Planting", async () => {
    const { user } = renderWithProviders(
      <SeedChecks
        packSlug="p"
        checks={[question("p.S1.1")]}
        wasSeed={true}
        forestHref="/today"
      />,
    );
    await user.click(screen.getByRole("radio", { name: /Second/ }));
    await user.click(screen.getByRole("button", { name: "Check answer" }));
    await waitFor(() => expect(answerSeedCheck).toHaveBeenCalledTimes(1));
    expect(answerSeedCheck.mock.calls[0]?.[0]).toEqual(EXPECTED);
  });
});
