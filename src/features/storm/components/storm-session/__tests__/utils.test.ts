import { describe, expect, it } from "vitest";
import type { StormSessionQuestion } from "../types";
import {
  countdownAnnouncement,
  finishWarning,
  formatCountdown,
  initialChoices,
  isAnswered,
  questionStatus,
  remainingSeconds,
  storedAnswerChange,
  unansweredCount,
} from "../utils";

const ENDS_AT = "2026-11-04T10:30:00.000Z";
const endsMs = Date.parse(ENDS_AT);

function sessionQuestion(
  id: string,
  select: number,
  chosen: string[] | null,
): StormSessionQuestion {
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
  };
}

describe("remainingSeconds", () => {
  it("is the whole seconds until ends_at, rounded up", () => {
    expect(remainingSeconds(ENDS_AT, endsMs - 408_000)).toBe(408);
    expect(remainingSeconds(ENDS_AT, endsMs - 1_500)).toBe(2);
  });

  it("is zero at and after the deadline, never negative", () => {
    expect(remainingSeconds(ENDS_AT, endsMs)).toBe(0);
    expect(remainingSeconds(ENDS_AT, endsMs + 60_000)).toBe(0);
  });
});

describe("formatCountdown", () => {
  it("shows mm:ss under an hour", () => {
    expect(formatCountdown(408)).toBe("06:48");
    expect(formatCountdown(0)).toBe("00:00");
  });

  it("shows h:mm:ss from an hour up", () => {
    expect(formatCountdown(7200)).toBe("2:00:00");
    expect(formatCountdown(3661)).toBe("1:01:01");
  });

  it("shows a placeholder before the clock is read (server render)", () => {
    expect(formatCountdown(null)).toBe("--:--");
  });
});

describe("isAnswered / questionStatus", () => {
  it("a single-select question is answered with one pick", () => {
    expect(isAnswered(["A"], 1)).toBe(true);
    expect(questionStatus(["A"], 1)).toBe("Answered");
    expect(questionStatus([], 1)).toBe("Not answered");
  });

  it("a multi-select question needs exactly `select` picks", () => {
    expect(isAnswered(["A"], 2)).toBe(false);
    expect(questionStatus(["A", "C"], 2)).toBe("Answered");
  });
});

describe("countdownAnnouncement", () => {
  it("stays silent above five minutes and before the clock is read", () => {
    expect(countdownAnnouncement(301)).toBe("");
    expect(countdownAnnouncement(null)).toBe("");
  });

  it("announces five minutes, one minute and the end", () => {
    expect(countdownAnnouncement(300)).toBe("5 minutes left.");
    expect(countdownAnnouncement(61)).toBe("5 minutes left.");
    expect(countdownAnnouncement(60)).toBe("1 minute left.");
    expect(countdownAnnouncement(1)).toBe("1 minute left.");
    expect(countdownAnnouncement(0)).toBe("Time is up.");
  });
});

describe("initialChoices", () => {
  it("resumes stored answers and starts the rest empty", () => {
    expect(
      initialChoices([
        sessionQuestion("q1", 1, ["B"]),
        sessionQuestion("q2", 1, null),
      ]),
    ).toEqual({ q1: ["B"], q2: [] });
  });
});

describe("unansweredCount", () => {
  it("counts questions without a complete answer", () => {
    const questions = [
      sessionQuestion("q1", 1, null),
      sessionQuestion("q2", 2, null),
      sessionQuestion("q3", 1, null),
    ];
    expect(unansweredCount(questions, { q1: ["A"], q2: ["A"] })).toBe(2);
  });
});

describe("finishWarning", () => {
  it("words zero, one and many unanswered questions", () => {
    expect(finishWarning(0)).toBe("Every question has an answer.");
    expect(finishWarning(1)).toBe(
      "1 question is not answered and counts as wrong.",
    );
    expect(finishWarning(4)).toBe(
      "4 questions are not answered and count as wrong.",
    );
  });
});

describe("storedAnswerChange", () => {
  it("stores a complete answer", () => {
    expect(storedAnswerChange(["A"], ["A", "B"], 2)).toEqual(["A", "B"]);
    expect(storedAnswerChange(["A"], ["B"], 1)).toEqual(["B"]);
  });

  it("clears a saved answer once it drops below `select` picks", () => {
    expect(storedAnswerChange(["A", "B"], ["A"], 2)).toEqual([]);
  });

  it("sends nothing while an unsaved answer is still partial", () => {
    expect(storedAnswerChange([], ["A"], 2)).toBeNull();
    expect(storedAnswerChange(["A"], [], 2)).toBeNull();
  });
});
