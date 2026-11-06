import { describe, expect, it } from "vitest";
import { DEFAULT_PACK_SLUG, primaryPackSlug } from "../primary-pack";

// MF-0054: the edge rows (E1–E7) are frozen in mf-0054-sidebar-section.acceptance.test.ts; these keep
// the pre-pin behaviour named where it was first stated.
describe("primaryPackSlug", () => {
  it("without pins, uses the newest group's pack", () => {
    expect(
      primaryPackSlug({
        groups: [
          { id: "g1", packSlug: "aws-saa" },
          { id: "g2", packSlug: "ccdv-f" },
        ],
        pins: [],
      }),
    ).toBe("aws-saa");
  });
  it("falls back to the default pack with no groups", () => {
    expect(DEFAULT_PACK_SLUG).toBe("ccdv-f");
    expect(primaryPackSlug({ groups: [], pins: [] })).toBe("ccdv-f");
  });
});
