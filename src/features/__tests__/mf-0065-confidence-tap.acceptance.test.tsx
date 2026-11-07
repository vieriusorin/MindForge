/**
 * MF-0065 acceptance (SC-11, SC-12) — frozen. Before the reveal the learner may tap "Sure" or "Not sure"
 * (GOAL DQ-6): the tap is sent with the answer, tapping again clears it, it locks with the verdict and resets
 * on the next item, and a changed tap is a new submission (a new client attempt id, DQ-2). The lesson close
 * screen names the mix-up picked most in the lesson (DQ-12). Server Actions and the router are mocked.
 */
import { screen, waitFor, within } from "@testing-library/react";
import type { Mock } from "vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LessonOutcome } from "@/engine/lesson";
import { DuelSession } from "@/features/duel/components/duel-session";
import { LessonClose } from "@/features/lesson/components/lesson-close";
import { LessonPlayer } from "@/features/lesson/components/lesson-player";
import { SeedChecks } from "@/features/seed-planting/components/seed-checks";
import { WalkSession } from "@/features/walk/components/walk-session";
import { renderWithProviders } from "@/test/render";

const {
  answerQuestion,
  answerWalkQuestion,
  answerSeedCheck,
  answerLessonItem,
} = vi.hoisted(() => ({
  answerQuestion: vi.fn(),
  answerWalkQuestion: vi.fn(),
  answerSeedCheck: vi.fn(),
  answerLessonItem: vi.fn(),
}));

vi.mock("@/features/duel/actions", () => ({ answerQuestion }));
vi.mock("@/features/walk/actions", () => ({ answerWalkQuestion }));
vi.mock("@/features/seed-planting/actions", () => ({ answerSeedCheck }));
vi.mock("@/features/lesson/actions", () => ({ answerLessonItem }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const OFFLINE = "Could not reach the server. Try again.";

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
    correct: false,
    correctOptionIds: ["A"],
    rationales: { A: "Why A is right", B: "Why B is wrong" },
  },
} as const;

interface Mode {
  name: string;
  action: Mock;
  render: () => ReturnType<typeof renderWithProviders>;
  next: string;
}

const MODES: Mode[] = [
  {
    name: "Duel",
    action: answerQuestion,
    render: () =>
      renderWithProviders(
        <DuelSession
          packSlug="p"
          questions={[question("p.S1.1"), question("p.S1.2")]}
          skillNames={{ S1: "Skill one" }}
          back={{ href: "/today", label: "Back to your forest" }}
        />,
      ),
    next: "Next question",
  },
  {
    name: "Walk",
    action: answerWalkQuestion,
    render: () =>
      renderWithProviders(
        <WalkSession
          packSlug="p"
          steps={[
            { question: question("p.S1.1"), reason: "water" },
            { question: question("p.S1.2"), reason: "water" },
          ]}
          skillNames={{ S1: "Skill one" }}
          todayHref="/today"
          duelHref="/play/p/duel"
        />,
      ),
    next: "Next question",
  },
  {
    name: "Seed Planting",
    action: answerSeedCheck,
    render: () =>
      renderWithProviders(
        <SeedChecks
          packSlug="p"
          checks={[question("p.S1.1"), question("p.S1.2")]}
          wasSeed={true}
          forestHref="/today"
        />,
      ),
    next: "Next check",
  },
  {
    name: "Lesson",
    action: answerLessonItem,
    render: () =>
      renderWithProviders(
        <LessonPlayer
          packSlug="p"
          skillCode="S1"
          steps={[
            { kind: "recall", question: question("p.S1.1") },
            { kind: "recall", question: question("p.S1.2") },
          ]}
          startedAt="2026-11-07T10:00:00.000Z"
          card={<p>CARD</p>}
          diagram={<p>DIAGRAM</p>}
          mapHref="/play/p"
        />,
      ),
    next: "Next",
  },
];

function sent(action: Mock, call: number): Record<string, unknown> {
  const input: unknown = action.mock.calls[call]?.[0];
  if (typeof input !== "object" || input === null) return {};
  return Object.fromEntries(Object.entries(input));
}

const tap = (name: "Sure" | "Not sure") =>
  within(screen.getByRole("group", { name: "How sure are you?" })).getByRole(
    "button",
    { name },
  );

describe("MF-0065 SC-11: the confidence tap", () => {
  beforeEach(() => {
    for (const { action } of MODES) action.mockReset();
  });

  for (const mode of MODES) {
    it(`SC-11: ${mode.name} offers Sure / Not sure, unpressed, and sends the tap`, async () => {
      mode.action.mockResolvedValue(GRADED);
      const { user } = mode.render();
      expect(tap("Sure")).toHaveAttribute("aria-pressed", "false");
      expect(tap("Not sure")).toHaveAttribute("aria-pressed", "false");
      await user.click(tap("Not sure"));
      expect(tap("Not sure")).toHaveAttribute("aria-pressed", "true");
      expect(tap("Sure")).toHaveAttribute("aria-pressed", "false");
      await user.click(screen.getByRole("radio", { name: /Second/ }));
      await user.click(screen.getByRole("button", { name: "Check answer" }));
      await waitFor(() => expect(mode.action).toHaveBeenCalledTimes(1));
      expect(sent(mode.action, 0).confidence).toBe("unsure");
    });

    it(`SC-11: ${mode.name} sends no confidence when the tap is cleared`, async () => {
      mode.action.mockResolvedValue(GRADED);
      const { user } = mode.render();
      await user.click(tap("Sure"));
      await user.click(tap("Sure"));
      expect(tap("Sure")).toHaveAttribute("aria-pressed", "false");
      await user.click(screen.getByRole("radio", { name: /Second/ }));
      await user.click(screen.getByRole("button", { name: "Check answer" }));
      await waitFor(() => expect(mode.action).toHaveBeenCalledTimes(1));
      expect("confidence" in sent(mode.action, 0)).toBe(false);
    });

    it(`SC-11: ${mode.name} locks the tap with the verdict and resets it on Next`, async () => {
      mode.action.mockResolvedValue(GRADED);
      const { user } = mode.render();
      await user.click(tap("Sure"));
      await user.click(screen.getByRole("radio", { name: /Second/ }));
      await user.click(screen.getByRole("button", { name: "Check answer" }));
      const next = await screen.findByRole("button", { name: mode.next });
      expect(tap("Sure")).toBeDisabled();
      expect(tap("Not sure")).toBeDisabled();
      await user.click(next);
      expect(tap("Sure")).toHaveAttribute("aria-pressed", "false");
      expect(tap("Sure")).toBeEnabled();
    });

    it(`SC-11: ${mode.name} sends a new attempt id when the tap changes after a failure`, async () => {
      mode.action
        .mockRejectedValueOnce(new Error("offline"))
        .mockResolvedValue(GRADED);
      const { user } = mode.render();
      await user.click(tap("Sure"));
      await user.click(screen.getByRole("radio", { name: /Second/ }));
      await user.click(screen.getByRole("button", { name: "Check answer" }));
      expect(await screen.findByText(OFFLINE)).toBeInTheDocument();
      await user.click(tap("Not sure"));
      await user.click(screen.getByRole("button", { name: "Check answer" }));
      await waitFor(() => expect(mode.action).toHaveBeenCalledTimes(2));
      expect(sent(mode.action, 0).confidence).toBe("sure");
      expect(sent(mode.action, 1).confidence).toBe("unsure");
      expect(sent(mode.action, 1).clientAttemptId).not.toBe(
        sent(mode.action, 0).clientAttemptId,
      );
    });
  }
});

const OUTCOME: LessonOutcome = {
  packSlug: "p",
  skillCode: "S1",
  skills: [
    {
      skillCode: "S1",
      name: "Skill one",
      before: { stage: "seed", wilting: false },
      after: { stage: "seed", wilting: false },
      change: "same",
      answeredCount: 3,
      correctCount: 1,
      nextReviewAt: null,
    },
  ],
};

describe("MF-0065 SC-12: the lesson close screen names the mix-up", () => {
  it("SC-12: a tagged pick during the lesson is named with its count", () => {
    renderWithProviders(
      <LessonClose
        outcome={OUTCOME}
        mapHref="/play/p"
        mixUp={{ label: "A subagent shares the main context", count: 2 }}
      />,
    );
    expect(
      screen.getByText(/Mix-up to watch: A subagent shares the main context/),
    ).toBeInTheDocument();
    expect(screen.getByText(/picked 2 times/)).toBeInTheDocument();
  });

  it("SC-12: one pick reads 'picked 1 time'", () => {
    renderWithProviders(
      <LessonClose
        outcome={OUTCOME}
        mapHref="/play/p"
        mixUp={{ label: "Mix", count: 1 }}
      />,
    );
    expect(screen.getByText(/picked 1 time\b/)).toBeInTheDocument();
  });

  it("SC-12: no mix-up, no line", () => {
    renderWithProviders(
      <LessonClose outcome={OUTCOME} mapHref="/play/p" mixUp={null} />,
    );
    expect(screen.queryByText(/Mix-up to watch/)).not.toBeInTheDocument();
  });
});
