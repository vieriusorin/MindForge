import { describe, expect, it } from "vitest";
import {
  completeLine,
  continueHref,
  courseCountLabel,
  courseLine,
  formatCompletedDate,
  trophyLine,
} from "../path-display";

describe("formatCompletedDate", () => {
  it("prints the UTC day, not the server's local day", () => {
    expect(formatCompletedDate("2026-11-05T23:30:00Z")).toBe("5 Nov 2026 UTC");
    expect(formatCompletedDate("2026-11-06T00:30:00+02:00")).toBe(
      "5 Nov 2026 UTC",
    );
  });
});

describe("courseLine", () => {
  it("names the position of the Continue course", () => {
    expect(courseLine({ nextPosition: 2, total: 5 })).toBe("Course 2 of 5");
  });

  it("is absent once the path is complete", () => {
    expect(courseLine({ nextPosition: null, total: 5 })).toBeNull();
  });
});

describe("completeLine", () => {
  it("counts recorded completes against the path length", () => {
    expect(completeLine({ completedCount: 0, total: 5 })).toBe(
      "0 of 5 complete",
    );
    expect(completeLine({ completedCount: 3, total: 5 })).toBe(
      "3 of 5 complete",
    );
  });
});

describe("continueHref", () => {
  it("sends Continue to the course's Walk", () => {
    expect(continueHref("platform-foundations")).toBe(
      "/play/platform-foundations/walk",
    );
  });
});

describe("trophyLine", () => {
  it("dates the trophy by the latest course and never says certified", () => {
    const line = trophyLine("2026-11-04T10:00:00Z");
    expect(line).toBe("Path complete · 4 Nov 2026 UTC");
    expect(line.toLowerCase()).not.toContain("certif");
  });

  it("still reads as a trophy without a date", () => {
    expect(trophyLine(null)).toBe("Path complete");
  });
});

describe("courseCountLabel", () => {
  it("pluralises the course count", () => {
    expect(courseCountLabel(1)).toBe("1 course");
    expect(courseCountLabel(5)).toBe("5 courses");
  });
});
