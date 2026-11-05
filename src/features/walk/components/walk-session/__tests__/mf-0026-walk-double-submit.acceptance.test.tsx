// MF-0026 acceptance (frozen): SC-1 one attempt per double submit in The Walk; SC-3 the guard
// releases after a failed answer and after "Next" (a regression lock: a guard that never releases
// would pass SC-1 and strand the learner).
import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlayableQuestion } from "@/engine/questions";
import { renderHookWithProviders } from "@/test/render";
import type { WalkStep } from "../../../types";
import { useWalkSession } from "../hooks/use-walk-session";

const { answerWalkQuestion } = vi.hoisted(() => ({
  answerWalkQuestion: vi.fn(),
}));

// Mock at the facade the hook depends on: the Server Action.
vi.mock("@/features/walk/actions", () => ({ answerWalkQuestion }));

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
  contentHash: `h-${id}`,
});

const STEPS: WalkStep[] = [
  { question: question("p.S1.1"), reason: "water" },
  { question: question("p.S1.2"), reason: "new" },
];

const GRADED = {
  ok: true,
  feedback: {
    correct: true,
    correctOptionIds: ["A"],
    rationales: { A: "Why A is right", B: "Why B is wrong" },
  },
} as const;

function renderWalkHook() {
  return renderHookWithProviders(() => useWalkSession("p", STEPS));
}

describe("MF-0026 The Walk: one attempt per Check answer", () => {
  beforeEach(() => {
    answerWalkQuestion.mockReset();
  });

  it("SC-1: two submits before a re-render record one attempt", async () => {
    answerWalkQuestion.mockResolvedValue(GRADED);
    const { result } = renderWalkHook();

    act(() => result.current.toggle("A"));
    act(() => {
      result.current.submit();
      result.current.submit();
    });

    await waitFor(() => expect(result.current.feedback).not.toBeNull());
    expect(answerWalkQuestion).toHaveBeenCalledTimes(1);
  });

  it("SC-3: after an ok:false answer, the next submit calls the action again", async () => {
    answerWalkQuestion
      .mockResolvedValueOnce({ ok: false, error: "Try again." })
      .mockResolvedValueOnce(GRADED);
    const { result } = renderWalkHook();

    act(() => result.current.toggle("A"));
    act(() => result.current.submit());
    await waitFor(() => expect(result.current.error).toBe("Try again."));

    act(() => result.current.submit());
    await waitFor(() => expect(result.current.feedback).not.toBeNull());
    expect(answerWalkQuestion).toHaveBeenCalledTimes(2);
  });

  it("SC-3: after a network error, the next submit calls the action again", async () => {
    answerWalkQuestion
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(GRADED);
    const { result } = renderWalkHook();

    act(() => result.current.toggle("A"));
    act(() => result.current.submit());
    await waitFor(() =>
      expect(result.current.error).toBe(
        "Could not reach the server. Try again.",
      ),
    );

    act(() => result.current.submit());
    await waitFor(() => expect(result.current.feedback).not.toBeNull());
    expect(answerWalkQuestion).toHaveBeenCalledTimes(2);
  });

  it("SC-3: after Next, the next question's submit calls the action again", async () => {
    answerWalkQuestion.mockResolvedValue(GRADED);
    const { result } = renderWalkHook();

    act(() => result.current.toggle("A"));
    act(() => result.current.submit());
    await waitFor(() => expect(result.current.feedback).not.toBeNull());

    act(() => result.current.next());
    act(() => result.current.toggle("A"));
    act(() => result.current.submit());
    await waitFor(() => expect(answerWalkQuestion).toHaveBeenCalledTimes(2));
    // TanStack passes a context object as the second argument; assert the input only.
    expect(answerWalkQuestion.mock.lastCall?.[0]).toMatchObject({
      questionId: "p.S1.2",
    });
  });
});
