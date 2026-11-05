import { describe, expect, it } from "vitest";
import { formatUtcDate } from "../format-utc-date";

describe("formatUtcDate", () => {
  it("formats in UTC whatever the machine's zone", () => {
    expect(formatUtcDate("2026-11-02T12:05:00.000Z")).toBe(
      "Nov 2, 2026, 12:05 PM UTC",
    );
  });

  it("does not shift an instant near midnight into another day", () => {
    expect(formatUtcDate("2026-11-03T23:59:00.000Z")).toBe(
      "Nov 3, 2026, 11:59 PM UTC",
    );
  });
});
