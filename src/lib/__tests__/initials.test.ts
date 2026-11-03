import { describe, expect, it } from "vitest";
import { initials } from "../initials";

describe("initials", () => {
  it("takes first and last word", () => {
    expect(initials("Dana Whitaker")).toBe("DW");
    expect(initials("ana maria pop")).toBe("AP");
  });
  it("handles one word and blanks", () => {
    expect(initials("ana")).toBe("A");
    expect(initials("   ")).toBe("?");
  });
});
