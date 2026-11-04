import { describe, expect, it } from "vitest";
import { assertDemoDomain } from "../seed-demo-world";

describe("assertDemoDomain (the delete filter's safety catch)", () => {
  it("accepts a dotted domain, lower-cased", () => {
    expect(assertDemoDomain("MindForge-Demo.test")).toBe("mindforge-demo.test");
  });

  it("refuses empty, dot-less, wildcard and address-shaped values", () => {
    for (const bad of [
      "",
      "  ",
      "test",
      "%",
      "_.test",
      "a@b.test",
      "demo .test",
    ])
      expect(() => assertDemoDomain(bad)).toThrow(/demo email domain/);
  });
});
