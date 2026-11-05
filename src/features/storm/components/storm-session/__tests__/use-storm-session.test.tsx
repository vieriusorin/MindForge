import { act, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHookWithProviders } from "@/test/render";
import { useStormSession } from "../hooks/use-storm-session";
import type { StormSessionQuestion } from "../types";

const { refresh, answerStormQuestion, finishStorm } = vi.hoisted(() => ({
  refresh: vi.fn(),
  answerStormQuestion: vi.fn(),
  finishStorm: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/features/storm/actions", () => ({
  answerStormQuestion,
  finishStorm,
}));

const STORM_ID = "6f1c1c1e-8a52-4a8e-9a39-1c1d2f3b4a5c";
const NOW = Date.parse("2026-11-04T10:00:00.000Z");

function sessionQuestion(
  id: string,
  chosen: string[] | null = null,
  select = 1,
) {
  return {
    question: {
      id,
      skillCode: "D2.S1",
      origin: "ai",
      stem: `Stem ${id}`,
      select,
      options: [
        { id: "A", text: "a" },
        { id: "B", text: "b" },
        { id: "C", text: "c" },
      ],
      source: { title: "Docs", url: "https://example.com" },
      contentHash: `hash-${id}`,
    },
    contentHash: `hash-${id}`,
    chosen,
    unreviewed: false,
  } satisfies StormSessionQuestion;
}

const QUESTIONS = [sessionQuestion("q1"), sessionQuestion("q2", ["A"])];

function renderSession(
  secondsLeft = 600,
  questions: StormSessionQuestion[] = QUESTIONS,
) {
  return renderHookWithProviders(() =>
    useStormSession({
      stormId: STORM_ID,
      endsAt: new Date(NOW + secondsLeft * 1000).toISOString(),
      questions,
    }),
  );
}

describe("useStormSession", () => {
  beforeEach(() => {
    // Only the clock and the interval are faked, and they keep pace with real time so that
    // RTL's waitFor (which polls on setInterval) still runs.
    vi.useFakeTimers({
      toFake: ["Date", "setInterval", "clearInterval"],
      shouldAdvanceTime: true,
    });
    vi.setSystemTime(NOW);
    refresh.mockReset();
    answerStormQuestion.mockReset().mockResolvedValue({ ok: true });
    finishStorm.mockReset().mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("the countdown is ends_at minus now, re-read every second", () => {
    const { result } = renderSession(408);
    expect(result.current.countdownLabel).toBe("06:48");

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.countdownLabel).toBe("06:45");
  });

  it("resumes stored answers on reload", () => {
    const { result } = renderSession();
    act(() => result.current.next());
    expect(result.current.chosen).toEqual(["A"]);
    expect(result.current.navigator.map((n) => n.status)).toEqual([
      "Not answered",
      "Answered",
    ]);
  });

  it("saving sends the question's content hash, and returns no grade", async () => {
    const { result } = renderSession();

    act(() => result.current.toggle("B"));

    await waitFor(() => expect(answerStormQuestion).toHaveBeenCalledTimes(1));
    expect(answerStormQuestion.mock.calls[0]?.[0]).toEqual({
      stormId: STORM_ID,
      questionId: "q1",
      chosen: ["B"],
      contentHash: "hash-q1",
    });
    expect(result.current.navigator[0]?.status).toBe("Answered");
  });

  it("skip and return, then change an answer: the change is saved again", async () => {
    const { result } = renderSession();

    act(() => result.current.toggle("A"));
    act(() => result.current.next());
    expect(result.current.current.question.id).toBe("q2");
    act(() => result.current.previous());
    act(() => result.current.toggle("B"));

    await waitFor(() => expect(answerStormQuestion).toHaveBeenCalledTimes(2));
    expect(answerStormQuestion.mock.calls[1]?.[0]).toMatchObject({
      questionId: "q1",
      chosen: ["B"],
    });
    expect(result.current.chosen).toEqual(["B"]);
  });

  it("reaching 0 s locks the options and refreshes, but never finishes on the client clock", () => {
    const { result, unmount } = renderSession(2);
    expect(result.current.isLocked).toBe(false);

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.isLocked).toBe(true);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(finishStorm).not.toHaveBeenCalled();

    act(() => result.current.toggle("A"));
    expect(answerStormQuestion).not.toHaveBeenCalled();

    // Still shown as running (the refresh came before the DB's ends_at): refresh again every 5 s.
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(refresh).toHaveBeenCalledTimes(2);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(refresh).toHaveBeenCalledTimes(3);
    expect(finishStorm).not.toHaveBeenCalled();

    unmount();
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(refresh).toHaveBeenCalledTimes(3);
  });

  it("the Finish button still finishes the storm", async () => {
    const { result } = renderSession();
    act(() => result.current.finish());
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(finishStorm).toHaveBeenCalledTimes(1);
    expect(finishStorm.mock.calls[0]?.[0]).toEqual({ stormId: STORM_ID });
  });

  it("unticking a saved multi-select answer clears it in the DB too", async () => {
    const { result } = renderSession(600, [
      sessionQuestion("m1", ["A", "B"], 2),
    ]);

    act(() => result.current.toggle("B"));

    await waitFor(() => expect(answerStormQuestion).toHaveBeenCalledTimes(1));
    expect(answerStormQuestion.mock.calls[0]?.[0]).toEqual({
      stormId: STORM_ID,
      questionId: "m1",
      chosen: [],
      contentHash: "hash-m1",
    });
    expect(result.current.navigator[0]?.status).toBe("Not answered");
  });

  it("a partial pick that was never saved sends nothing", () => {
    const { result } = renderSession(600, [sessionQuestion("m1", null, 2)]);

    act(() => result.current.toggle("A"));
    act(() => result.current.toggle("A"));

    expect(answerStormQuestion).not.toHaveBeenCalled();
  });

  it("an MF013 refusal (time is up) locks the session and finishes it", async () => {
    answerStormQuestion.mockResolvedValue({
      ok: false,
      error: {
        message: "Time is up: this storm has ended.",
        isStormOver: true,
      },
    });
    const { result } = renderSession();

    act(() => result.current.toggle("A"));

    await waitFor(() => expect(result.current.isLocked).toBe(true));
    expect(result.current.error).toBe("Time is up: this storm has ended.");
    await waitFor(() => expect(finishStorm).toHaveBeenCalledTimes(1));

    act(() => result.current.toggle("B"));
    expect(answerStormQuestion).toHaveBeenCalledTimes(1);
  });

  it("a changed question (55000) shows why and keeps the session open", async () => {
    answerStormQuestion.mockResolvedValue({
      ok: false,
      error: {
        message: "This question changed during the storm; it will not count.",
        isStormOver: false,
      },
    });
    const { result } = renderSession();

    act(() => result.current.toggle("A"));

    await waitFor(() =>
      expect(result.current.error).toBe(
        "This question changed during the storm; it will not count.",
      ),
    );
    expect(result.current.isLocked).toBe(false);
    expect(finishStorm).not.toHaveBeenCalled();
  });

  it("Finish asks once even when clicked twice, and a failed finish can be retried", async () => {
    finishStorm.mockRejectedValueOnce(new Error("offline"));
    const { result } = renderSession();

    act(() => {
      result.current.finish();
      result.current.finish();
    });
    await waitFor(() =>
      expect(result.current.error).toBe(
        "Could not reach the server. Try again.",
      ),
    );
    expect(finishStorm).toHaveBeenCalledTimes(1);

    act(() => result.current.finish());
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(finishStorm).toHaveBeenCalledTimes(2);
  });
});
