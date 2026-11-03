import { describe, expect, it } from "vitest";
import { DEFAULT_PACK_SLUG, primaryPackSlug } from "../primary-pack";

describe("primaryPackSlug", () => {
  it("uses the newest group's pack", () => {
    expect(
      primaryPackSlug([{ packSlug: "aws-saa" }, { packSlug: "ccdv-f" }]),
    ).toBe("aws-saa");
  });
  it("falls back to the default pack with no groups", () => {
    expect(DEFAULT_PACK_SLUG).toBe("ccdv-f");
    expect(primaryPackSlug([])).toBe("ccdv-f");
  });
});
