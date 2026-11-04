import { describe, expect, it } from "vitest";
import { formatReviewDate } from "../format-date";

describe("formatReviewDate", () => {
  it("formats in UTC whatever the machine's zone", () => {
    expect(formatReviewDate("2026-11-02T12:05:00.000Z")).toBe(
      "Nov 2, 2026, 12:05 PM UTC",
    );
  });
});
