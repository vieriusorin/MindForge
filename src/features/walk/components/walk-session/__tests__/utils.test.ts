import { describe, expect, it } from "vitest";
import { reasonLabel } from "../utils";

describe("reasonLabel", () => {
  it("names why each skill is in the walk", () => {
    expect(reasonLabel("water")).toBe("Needs water");
    expect(reasonLabel("new")).toBe("New seed");
    expect(reasonLabel("strengthen")).toBe("Strengthen");
  });
});
