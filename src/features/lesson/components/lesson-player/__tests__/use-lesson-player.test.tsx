import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlayableQuestion } from "@/engine/questions";
import { renderHookWithProviders } from "@/test/render";
import type { PlayerStep } from "../../../types";
import { useLessonPlayer } from "../hooks/use-lesson-player";

const { answerLessonItem, push } = vi.hoisted(() => ({
  answerLessonItem: vi.fn(),
  push: vi.fn(),
}));
vi.mock("@/features/lesson/actions", () => ({ answerLessonItem }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

function item(id: string): PlayableQuestion {
  return {
    id,
    skillCode: "S1",
    origin: "ai",
    stem: id,
    select: 1,
    options: [
      { id: "A", text: "a" },
      { id: "B", text: "b" },
    ],
    source: { title: "t", url: "https://example.com" },
    contentHash: `h-${id}`,
  };
}

function setup(steps: PlayerStep[]) {
  return renderHookWithProviders(() =>
    useLessonPlayer({
      packSlug: "p",
      skillCode: "S1",
      steps,
      startedAt: "2026-11-07T10:00:00.000Z",
    }),
  );
}

describe("useLessonPlayer", () => {
  beforeEach(() => {
    answerLessonItem.mockReset();
    push.mockReset();
  });

  it("skipping the guess keeps nothing and moves on without a call", () => {
    const { result } = setup([
      { kind: "guess", question: item("q1") },
      { kind: "recall", question: item("q1") },
    ]);
    act(() => result.current.skipGuess());
    expect(result.current.index).toBe(1);
    expect(result.current.guessNote).toBeNull();
    expect(answerLessonItem).not.toHaveBeenCalled();
  });

  it("a refused answer shows the action's message and adds no re-ask", async () => {
    answerLessonItem.mockResolvedValueOnce({
      ok: false,
      error: "This question changed.",
    });
    const { result } = setup([{ kind: "recall", question: item("q1") }]);
    act(() => result.current.toggle("A"));
    act(() => result.current.submit());
    await waitFor(() =>
      expect(result.current.error).toBe("This question changed."),
    );
    expect(result.current.progress.total).toBe(1);
  });

  it("a network failure says the server could not be reached", async () => {
    answerLessonItem.mockRejectedValueOnce(new Error("offline"));
    const { result } = setup([{ kind: "recall", question: item("q1") }]);
    act(() => result.current.toggle("A"));
    act(() => result.current.submit());
    await waitFor(() =>
      expect(result.current.error).toBe(
        "Could not reach the server. Try again.",
      ),
    );
  });

  it("a double submit sends one answer", async () => {
    answerLessonItem.mockResolvedValue({
      ok: true,
      feedback: { correct: true, correctOptionIds: ["A"], rationales: {} },
    });
    const { result } = setup([{ kind: "recall", question: item("q1") }]);
    act(() => result.current.toggle("A"));
    act(() => {
      result.current.submit();
      result.current.submit();
    });
    await waitFor(() => expect(result.current.feedback).not.toBeNull());
    expect(answerLessonItem).toHaveBeenCalledTimes(1);
  });

  it("a wrong re-ask is not asked again; the end opens the close screen", async () => {
    answerLessonItem.mockResolvedValue({
      ok: true,
      feedback: { correct: false, correctOptionIds: ["A"], rationales: {} },
    });
    const { result } = setup([{ kind: "recall", question: item("q1") }]);
    act(() => result.current.toggle("B"));
    act(() => result.current.submit());
    await waitFor(() => expect(result.current.progress.total).toBe(2));
    act(() => result.current.next());
    expect(result.current.step?.kind).toBe("reask");
    act(() => result.current.toggle("B"));
    act(() => result.current.submit());
    await waitFor(() => expect(result.current.feedback).not.toBeNull());
    expect(result.current.progress.total).toBe(2);
    act(() => result.current.next());
    expect(push).toHaveBeenCalledWith(
      "/play/p/lesson/S1/done?since=2026-11-07T10:00:00.000Z",
    );
  });

  it("MF-0064 review: the guess note shows on the graded recall only, not on its re-ask", async () => {
    answerLessonItem.mockResolvedValue({
      ok: true,
      feedback: { correct: false, correctOptionIds: ["A"], rationales: {} },
    });
    const { result } = setup([
      { kind: "guess", question: item("q1") },
      { kind: "recall", question: item("q1") },
    ]);
    act(() => result.current.toggle("B"));
    act(() => result.current.lockGuess());
    act(() => result.current.toggle("B"));
    act(() => result.current.submit());
    await waitFor(() =>
      expect(result.current.guessNote).toBe(
        "Your guess before the lesson was not the answer.",
      ),
    );
    act(() => result.current.next());
    expect(result.current.step?.kind).toBe("reask");
    act(() => result.current.toggle("B"));
    act(() => result.current.submit());
    await waitFor(() => expect(result.current.feedback).not.toBeNull());
    expect(result.current.guessNote).toBeNull();
  });

  describe("MF-0067 client attempt id", () => {
    const UUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    const sentId = (call: number): string =>
      String(answerLessonItem.mock.calls[call]?.[0]?.clientAttemptId);

    it("sends a uuid with every graded answer", async () => {
      answerLessonItem.mockResolvedValue({
        ok: true,
        feedback: { correct: true, correctOptionIds: ["A"], rationales: {} },
      });
      const { result } = setup([{ kind: "recall", question: item("q1") }]);
      act(() => result.current.toggle("A"));
      act(() => result.current.submit());
      await waitFor(() => expect(result.current.feedback).not.toBeNull());
      expect(sentId(0)).toMatch(UUID);
    });

    it("keeps the same id when the same answer is retried after a network error", async () => {
      answerLessonItem
        .mockRejectedValueOnce(new Error("offline"))
        .mockResolvedValueOnce({
          ok: true,
          feedback: { correct: true, correctOptionIds: ["A"], rationales: {} },
        });
      const { result } = setup([{ kind: "recall", question: item("q1") }]);
      act(() => result.current.toggle("A"));
      act(() => result.current.submit());
      await waitFor(() => expect(result.current.error).not.toBeNull());
      act(() => result.current.submit());
      await waitFor(() => expect(result.current.feedback).not.toBeNull());
      expect(answerLessonItem).toHaveBeenCalledTimes(2);
      expect(sentId(1)).toBe(sentId(0));
    });

    it("mints a new id after moving on, and for the re-ask of the same item and answer", async () => {
      answerLessonItem.mockResolvedValue({
        ok: true,
        feedback: { correct: false, correctOptionIds: ["A"], rationales: {} },
      });
      const { result } = setup([
        { kind: "recall", question: item("q1") },
        { kind: "recall", question: item("q2") },
      ]);
      for (const _ of [1, 2, 3]) {
        act(() => result.current.toggle("B"));
        act(() => result.current.submit());
        await waitFor(() => expect(result.current.feedback).not.toBeNull());
        act(() => result.current.next());
      }
      // q1, q2, then the re-ask of q1 with the same answer B.
      expect(result.current.step?.kind).toBe("reask");
      expect(answerLessonItem.mock.calls[2]?.[0]).toMatchObject({
        questionId: "q1",
        chosen: ["B"],
      });
      const ids = [sentId(0), sentId(1), sentId(2)];
      expect(new Set(ids).size).toBe(3);
    });
  });
});
