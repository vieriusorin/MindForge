import { describe, expect, it } from "vitest";
import { isStaleVersionError } from "../is-stale-version-error";

describe("isStaleVersionError", () => {
  it("is true only for record_attempt's 55000 (item changed since it was read)", () => {
    expect(isStaleVersionError({ code: "55000" })).toBe(true);
    expect(isStaleVersionError({ code: "P0002" })).toBe(false);
    expect(isStaleVersionError({})).toBe(false);
    expect(isStaleVersionError(null)).toBe(false);
    expect(isStaleVersionError(undefined)).toBe(false);
  });
});
