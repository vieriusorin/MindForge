import { describe, expect, it } from "vitest";
import { BLUEPRINT_CHART_CONFIG, blueprintData } from "../utils";

const domain = (code: string, weight: number, grownWeight: number) => ({
  domainCode: code,
  name: `Domain ${code}`,
  weight,
  grownWeight,
  skillCount: 3,
  grownSkillCount: 0,
});

describe("blueprintData", () => {
  it("splits each domain's exam weight into growing and not-yet", () => {
    expect(
      blueprintData([domain("D1", 14.7, 4.5), domain("D2", 33.1, 0)]),
    ).toEqual([
      { code: "D1", name: "Domain D1", growing: 4.5, notYet: 10.2 },
      { code: "D2", name: "Domain D2", growing: 0, notYet: 33.1 },
    ]);
  });

  it("never reports more growing weight than the domain has", () => {
    expect(blueprintData([domain("D1", 10, 12)])[0]).toMatchObject({
      growing: 10,
      notYet: 0,
    });
  });
});

describe("BLUEPRINT_CHART_CONFIG", () => {
  it("growing is the strong violet, not-yet the lightest step", () => {
    expect(BLUEPRINT_CHART_CONFIG.growing.color).toBe("var(--chart-4)");
    expect(BLUEPRINT_CHART_CONFIG.notYet.color).toBe("var(--chart-1)");
  });
});
