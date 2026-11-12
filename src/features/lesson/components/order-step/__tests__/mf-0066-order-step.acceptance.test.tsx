/**
 * MF-0066 acceptance (frozen): SC-7 the order step as a learner meets it, SC-8 the lesson player shows it.
 * The Server Action and the router are mocked at the facade. Strings are literals from GOAL.md SC-7.
 */
import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  orderSeed,
  type PlayableOrder,
  toPlayableOrder,
} from "@/engine/content";
import { LessonPlayer } from "@/features/lesson/components/lesson-player";
import type { PlayerStep } from "@/features/lesson/types";
import { toPlayerSteps } from "@/features/lesson/utils/to-player-steps";
import { renderWithProviders } from "@/test/render";
import { OrderStep } from "..";

const { answerLessonOrder, answerLessonItem, push } = vi.hoisted(() => ({
  answerLessonOrder: vi.fn(),
  answerLessonItem: vi.fn(),
  push: vi.fn(),
}));

vi.mock("@/features/lesson/actions", () => ({
  answerLessonOrder,
  answerLessonItem,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}));

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const ORDER: PlayableOrder = {
  id: "p.D2.S2.order-turn",
  skillCode: "D2.S2",
  origin: "ai",
  title: "Put one client tool-use turn in order",
  // Shown order (never the key): Run, Request, Result.
  steps: [
    { id: "RUN", label: "Run the tool" },
    { id: "REQ", label: "Send the request" },
    { id: "RES", label: "Send the result" },
  ],
  contentHash: "h-order",
};

const KEY = [
  { node: "REQ", label: "Send the request" },
  { node: "RUN", label: "Run the tool" },
  { node: "RES", label: "Send the result" },
];

const graded = (correct: boolean) => ({
  ok: true,
  feedback: {
    correct,
    steps: KEY,
    explanation: "The request comes first; the result goes back last.",
  },
});

function renderStep(isLast = false) {
  const onNext = vi.fn();
  const view = renderWithProviders(
    <OrderStep
      step={{ kind: "order", order: ORDER }}
      meta="Put in order"
      packSlug="p"
      isLast={isLast}
      onNext={onNext}
    />,
  );
  return { ...view, onNext };
}

type User = ReturnType<typeof renderStep>["user"];

async function place(user: User, labels: string[]): Promise<void> {
  for (const label of labels) {
    await user.click(screen.getByRole("button", { name: `Add: ${label}` }));
  }
}

describe("MF-0066 SC-7: the order step", () => {
  beforeEach(() => {
    answerLessonOrder.mockReset();
    answerLessonItem.mockReset();
    push.mockReset();
  });

  it("SC-7: shows the title and every step as an Add button; Check order waits for all steps", async () => {
    const { user } = renderStep();
    expect(
      screen.getByText("Put one client tool-use turn in order"),
    ).toBeVisible();
    expect(screen.getByText("Put in order")).toBeVisible();
    for (const label of [
      "Run the tool",
      "Send the request",
      "Send the result",
    ]) {
      expect(
        screen.getByRole("button", { name: `Add: ${label}` }),
      ).toBeEnabled();
    }
    const check = screen.getByRole("button", { name: "Check order" });
    expect(check).toBeDisabled();
    await place(user, ["Send the request", "Run the tool"]);
    expect(check).toBeDisabled();
    await place(user, ["Send the result"]);
    expect(check).toBeEnabled();
  });

  it("SC-7: placed steps form a numbered list; Remove puts a step back", async () => {
    const { user } = renderStep();
    await place(user, ["Send the request", "Run the tool"]);
    const answer = screen.getByRole("list", { name: "Your order" });
    expect(
      within(answer)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual([
      expect.stringContaining("Send the request"),
      expect.stringContaining("Run the tool"),
    ]);
    expect(
      screen.queryByRole("button", { name: "Add: Send the request" }),
    ).toBeNull();
    await user.click(
      screen.getByRole("button", { name: "Remove: Send the request" }),
    );
    expect(
      within(answer)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual([expect.stringContaining("Run the tool")]);
    expect(
      screen.getByRole("button", { name: "Add: Send the request" }),
    ).toBeEnabled();
  });

  it("SC-7: Check sends packSlug, orderId, the placed order, the hash and a uuid; a right answer is announced", async () => {
    answerLessonOrder.mockResolvedValueOnce(graded(true));
    const { user } = renderStep();
    await place(user, ["Send the request", "Run the tool", "Send the result"]);
    await user.click(screen.getByRole("button", { name: "Check order" }));

    expect(answerLessonOrder).toHaveBeenCalledTimes(1);
    const sent = answerLessonOrder.mock.calls[0]?.[0];
    expect(sent).toMatchObject({
      packSlug: "p",
      orderId: "p.D2.S2.order-turn",
      order: ["REQ", "RUN", "RES"],
      contentHash: "h-order",
    });
    expect(sent.clientAttemptId).toMatch(UUID);
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Correct! That is the order.",
    );
  });

  it("SC-7: a wrong answer says so, then shows the key order as a numbered list with the explanation", async () => {
    answerLessonOrder.mockResolvedValueOnce(graded(false));
    const { user, onNext } = renderStep();
    await place(user, ["Run the tool", "Send the request", "Send the result"]);
    await user.click(screen.getByRole("button", { name: "Check order" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Not quite. Here is the order.",
    );
    const key = screen.getByRole("list", { name: "The order" });
    expect(
      within(key)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual([
      expect.stringContaining("Send the request"),
      expect.stringContaining("Run the tool"),
      expect.stringContaining("Send the result"),
    ]);
    expect(
      screen.getByText("The request comes first; the result goes back last."),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("SC-7: on the last step the way on is Finish", async () => {
    answerLessonOrder.mockResolvedValueOnce(graded(true));
    const { user, onNext } = renderStep(true);
    await place(user, ["Send the request", "Run the tool", "Send the result"]);
    await user.click(screen.getByRole("button", { name: "Check order" }));
    await user.click(await screen.findByRole("button", { name: "Finish" }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("SC-7: a server error is shown and the answer can be checked again", async () => {
    answerLessonOrder
      .mockResolvedValueOnce({
        ok: false,
        error:
          "This order changed since you opened it. Reload the page for a fresh lesson.",
      })
      .mockResolvedValueOnce(graded(true));
    const { user } = renderStep();
    await place(user, ["Send the request", "Run the tool", "Send the result"]);
    await user.click(screen.getByRole("button", { name: "Check order" }));
    expect(
      await screen.findByText(
        "This order changed since you opened it. Reload the page for a fresh lesson.",
      ),
    ).toBeVisible();
    const check = screen.getByRole("button", { name: "Check order" });
    expect(check).toBeEnabled();
    await user.click(check);
    expect(answerLessonOrder).toHaveBeenCalledTimes(2);
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Correct! That is the order.",
    );
  });

  it("SC-7: Check is disabled while the answer is pending", async () => {
    let resolve: (value: unknown) => void = () => {};
    answerLessonOrder.mockReturnValueOnce(
      new Promise((r) => {
        resolve = r;
      }),
    );
    const { user } = renderStep();
    await place(user, ["Send the request", "Run the tool", "Send the result"]);
    await user.click(screen.getByRole("button", { name: "Check order" }));
    expect(screen.getByRole("button", { name: "Check order" })).toBeDisabled();
    resolve(graded(true));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Correct! That is the order.",
    );
  });
});

describe("MF-0066 SC-8: the lesson player shows the order step", () => {
  beforeEach(() => {
    answerLessonOrder.mockReset();
    push.mockReset();
  });

  it("SC-8: an order step renders with its meta line and Continue advances to the next step", async () => {
    answerLessonOrder.mockResolvedValueOnce(graded(true));
    const steps: PlayerStep[] = [
      { kind: "order", order: ORDER },
      { kind: "card" },
    ];
    const { user } = renderWithProviders(
      <LessonPlayer
        packSlug="p"
        skillCode="D2.S2"
        steps={steps}
        startedAt="2026-11-07T10:00:00.000Z"
        card={<p>CARD SLOT</p>}
        diagram={<p>DIAGRAM SLOT</p>}
        mapHref="/play/p"
      />,
    );
    expect(screen.getAllByText("Put in order").length).toBeGreaterThan(0);
    await place(user, ["Send the request", "Run the tool", "Send the result"]);
    await user.click(screen.getByRole("button", { name: "Check order" }));
    await user.click(await screen.findByRole("button", { name: "Continue" }));
    expect(screen.getByText("CARD SLOT")).toBeVisible();
  });

  it("SC-8: toPlayerSteps maps an order with its deployed hash and drops one without", () => {
    const item = {
      id: "p.D2.S2.order-turn",
      skill: "D2.S2",
      title: "Put one client tool-use turn in order",
      origin: "ai" as const,
      diagram: "p.D2.S2.diagram-loop",
      steps: KEY,
      orderedBy: ["Quote."],
      explanation: "Why.",
      source: { title: "Doc", url: "https://example.com/doc" },
    };
    const mapped = toPlayerSteps({
      steps: [{ kind: "order", order: item }],
      hashes: { "p.D2.S2.order-turn": "h-order" },
      skillNames: new Map(),
      userId: "u1",
    });
    expect(mapped).toHaveLength(1);
    const [first] = mapped;
    expect(first?.kind).toBe("order");
    if (first?.kind !== "order") return;
    expect(first.order).toMatchObject({
      id: "p.D2.S2.order-turn",
      skillCode: "D2.S2",
      origin: "ai",
      title: "Put one client tool-use turn in order",
      contentHash: "h-order",
    });
    // The shown order is the learner's seeded permutation, never the key.
    expect(first.order).toEqual(
      toPlayableOrder(item, "h-order", orderSeed("u1", item.id)),
    );
    expect(first.order.steps.map((s) => s.id)).not.toEqual([
      "REQ",
      "RUN",
      "RES",
    ]);
    expect(
      toPlayerSteps({
        steps: [{ kind: "order", order: item }],
        hashes: {},
        skillNames: new Map(),
        userId: "u1",
      }),
    ).toEqual([]);
  });
});
