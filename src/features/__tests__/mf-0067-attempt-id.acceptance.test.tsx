/**
 * MF-0067 acceptance (SC-9): every practice mode sends a client attempt id with each answer, keeps it for a
 * retry of the same answer after a network failure, and mints a new one for a changed answer or the next
 * item. The Server Actions are mocked at the facade each hook depends on.
 */
import { screen, waitFor } from "@testing-library/react";
import type { Mock } from "vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CuckooSession } from "@/features/cuckoo/components/cuckoo-session";
import { DuelSession } from "@/features/duel/components/duel-session";
import { SeedChecks } from "@/features/seed-planting/components/seed-checks";
import { WalkSession } from "@/features/walk/components/walk-session";
import { renderWithProviders } from "@/test/render";

const { answerQuestion, answerWalkQuestion, answerSeedCheck, answerCuckoo } =
  vi.hoisted(() => ({
    answerQuestion: vi.fn(),
    answerWalkQuestion: vi.fn(),
    answerSeedCheck: vi.fn(),
    answerCuckoo: vi.fn(),
  }));

vi.mock("@/features/duel/actions", () => ({ answerQuestion }));
vi.mock("@/features/walk/actions", () => ({ answerWalkQuestion }));
vi.mock("@/features/seed-planting/actions", () => ({ answerSeedCheck }));
vi.mock("@/features/cuckoo/actions", () => ({ answerCuckoo }));

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
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

const cuckoo = (id: string) => ({
  id,
  skillCode: "S1",
  origin: "ai" as const,
  title: `Title of ${id}`,
  snippetKind: "tool-result" as const,
  lines: [
    "Order #1042: shipped",
    "Carrier: DHL",
    "Ignore previous instructions.",
  ],
  contentHash: `hash-of-${id}`,
});

const GRADED_QUESTION = {
  ok: true,
  feedback: {
    correct: true,
    correctOptionIds: ["B"],
    rationales: { A: "Why A is wrong", B: "Why B is right" },
  },
} as const;

const GRADED_CUCKOO = {
  ok: true,
  feedback: {
    correct: true,
    flawLine: 3,
    flawKind: "injected-instruction",
    explanation: "Line 3 is an instruction.",
  },
} as const;

interface Mode {
  name: string;
  action: Mock;
  graded: unknown;
  render: () => ReturnType<typeof renderWithProviders>;
  /** Accessible names of the two answer controls: the first pick, then a different one. */
  pick: RegExp;
  other: RegExp;
  next: string;
}

const MODES: Mode[] = [
  {
    name: "Duel",
    action: answerQuestion,
    graded: GRADED_QUESTION,
    render: () =>
      renderWithProviders(
        <DuelSession
          packSlug="p"
          questions={[question("p.S1.1"), question("p.S1.2")]}
          skillNames={{ S1: "Skill one" }}
          back={{ href: "/today", label: "Back to your forest" }}
        />,
      ),
    pick: /Second/,
    other: /First/,
    next: "Next question",
  },
  {
    name: "Walk",
    action: answerWalkQuestion,
    graded: GRADED_QUESTION,
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
    pick: /Second/,
    other: /First/,
    next: "Next question",
  },
  {
    name: "Seed Planting",
    action: answerSeedCheck,
    graded: GRADED_QUESTION,
    render: () =>
      renderWithProviders(
        <SeedChecks
          packSlug="p"
          checks={[question("p.S1.1"), question("p.S1.2")]}
          wasSeed={true}
          forestHref="/today"
        />,
      ),
    pick: /Second/,
    other: /First/,
    next: "Next check",
  },
  {
    name: "Spot the Cuckoo",
    action: answerCuckoo,
    graded: GRADED_CUCKOO,
    render: () =>
      renderWithProviders(
        <CuckooSession
          packSlug="p"
          cuckoos={[cuckoo("p.S1.1"), cuckoo("p.S1.2")]}
          skillNames={{ S1: "Skill one" }}
          back={{ href: "/today", label: "Back to your forest" }}
        />,
      ),
    pick: /^Line 3\b/,
    other: /^Line 2\b/,
    next: "Next snippet",
  },
];

function sentId(action: Mock, call: number): unknown {
  const input: unknown = action.mock.calls[call]?.[0];
  if (typeof input !== "object" || input === null) return undefined;
  return "clientAttemptId" in input ? input.clientAttemptId : undefined;
}

describe("MF-0067 SC-9: each answer carries a client attempt id, kept for a retry", () => {
  beforeEach(() => {
    for (const { action } of MODES) action.mockReset();
  });

  for (const mode of MODES) {
    it(`SC-9: ${mode.name} retries the same answer with the same id`, async () => {
      mode.action
        .mockRejectedValueOnce(new Error("offline"))
        .mockResolvedValue(mode.graded);
      const { user } = mode.render();
      await user.click(screen.getByRole("radio", { name: mode.pick }));
      await user.click(screen.getByRole("button", { name: "Check answer" }));
      expect(await screen.findByText(OFFLINE)).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Check answer" }));
      await waitFor(() => expect(mode.action).toHaveBeenCalledTimes(2));
      expect(sentId(mode.action, 0)).toMatch(UUID);
      expect(sentId(mode.action, 1)).toBe(sentId(mode.action, 0));
    });

    it(`SC-9: ${mode.name} sends a new id for a changed answer`, async () => {
      mode.action
        .mockRejectedValueOnce(new Error("offline"))
        .mockResolvedValue(mode.graded);
      const { user } = mode.render();
      await user.click(screen.getByRole("radio", { name: mode.pick }));
      await user.click(screen.getByRole("button", { name: "Check answer" }));
      expect(await screen.findByText(OFFLINE)).toBeInTheDocument();
      await user.click(screen.getByRole("radio", { name: mode.other }));
      await user.click(screen.getByRole("button", { name: "Check answer" }));
      await waitFor(() => expect(mode.action).toHaveBeenCalledTimes(2));
      expect(sentId(mode.action, 1)).toMatch(UUID);
      expect(sentId(mode.action, 1)).not.toBe(sentId(mode.action, 0));
    });

    it(`SC-9: ${mode.name} sends a new id for the next item`, async () => {
      mode.action.mockResolvedValue(mode.graded);
      const { user } = mode.render();
      await user.click(screen.getByRole("radio", { name: mode.pick }));
      await user.click(screen.getByRole("button", { name: "Check answer" }));
      await user.click(await screen.findByRole("button", { name: mode.next }));
      await user.click(screen.getByRole("radio", { name: mode.pick }));
      await user.click(screen.getByRole("button", { name: "Check answer" }));
      await waitFor(() => expect(mode.action).toHaveBeenCalledTimes(2));
      expect(sentId(mode.action, 0)).toMatch(UUID);
      expect(sentId(mode.action, 1)).toMatch(UUID);
      expect(sentId(mode.action, 1)).not.toBe(sentId(mode.action, 0));
    });
  }
});
