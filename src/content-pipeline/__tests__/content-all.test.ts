import { describe, expect, it } from "vitest";
import { parseEstimate } from "../content-all";

describe("parseEstimate", () => {
  it("reads the items CLI's last estimate line", () => {
    const out = [
      "cards: D1.S1     2       2  0.25",
      "cards: 24 skill(s), writer batch 48 request(s), upper-bound estimate $6.00 (verifier batch extra)",
    ].join("\n");
    expect(parseEstimate(out)).toBe(6);
  });

  it("reads the questions CLI's estimate line", () => {
    expect(
      parseEstimate(
        "writer batch: 69 request(s), upper-bound estimate $6.74 (verifier batch extra)\n",
      ),
    ).toBe(6.74);
  });

  it("reads an empty plan as zero", () => {
    expect(
      parseEstimate(
        "writer batch: 0 request(s), upper-bound estimate $0.00 (verifier batch extra)",
      ),
    ).toBe(0);
  });

  it("throws when no estimate line is printed (never a silent $0)", () => {
    expect(() => parseEstimate("something else\n")).toThrow(/estimate/);
  });

  it("throws when the CLI printed two estimates", () => {
    const line = "upper-bound estimate $1.00 (verifier batch extra)";
    expect(() => parseEstimate(`${line}\n${line}`)).toThrow(/estimate/);
  });
});
