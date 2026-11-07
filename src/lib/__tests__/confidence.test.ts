import { describe, expect, it } from "vitest";
import { confidenceField, nextConfidence } from "../confidence";

describe("nextConfidence (MF-0065 DQ-6)", () => {
  it("presses a button when nothing is pressed", () => {
    expect(nextConfidence(null, "sure")).toBe("sure");
  });
  it("tapping the pressed button clears it", () => {
    expect(nextConfidence("sure", "sure")).toBeNull();
  });
  it("tapping the other button replaces it", () => {
    expect(nextConfidence("sure", "unsure")).toBe("unsure");
  });
});

describe("confidenceField (MF-0065)", () => {
  it("no tap adds no field", () => {
    expect(confidenceField(null)).toEqual({});
    expect("confidence" in confidenceField(null)).toBe(false);
  });
  it("a tap adds it", () => {
    expect(confidenceField("unsure")).toEqual({ confidence: "unsure" });
  });
});
