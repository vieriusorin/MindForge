import { describe, expect, it } from "vitest";
import { formatMinutes } from "../utils";

describe("formatMinutes", () => {
  it("rounds a part minute up, so the learner never expects more time than they get", () => {
    expect(formatMinutes(1630)).toBe("28 minutes");
    expect(formatMinutes(1620)).toBe("27 minutes");
  });

  it("uses the singular for one minute", () => {
    expect(formatMinutes(45)).toBe("1 minute");
    expect(formatMinutes(60)).toBe("1 minute");
  });

  it("formats a Full Storm's 120 minutes", () => {
    expect(formatMinutes(7200)).toBe("120 minutes");
  });
});
