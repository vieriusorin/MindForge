import { describe, expect, it } from "vitest";
import { needWaterLabel, walkLengthLabel } from "../utils";

describe("needWaterLabel", () => {
  it("words zero, one and many", () => {
    expect(needWaterLabel(0)).toBe("No tree needs water");
    expect(needWaterLabel(1)).toBe("1 tree needs water");
    expect(needWaterLabel(14)).toBe("14 trees need water");
  });
});

describe("walkLengthLabel", () => {
  it("words one and many", () => {
    expect(walkLengthLabel(1)).toBe("1 question");
    expect(walkLengthLabel(10)).toBe("10 questions");
  });
});
