import { describe, expect, it } from "vitest";
import type { Pack } from "@/engine/pack";
import {
  READINESS_THRESHOLDS,
  readiness,
  weatherFor,
} from "@/engine/readiness";

const PACK: Pack = {
  slug: "readiness-unit",
  name: "Readiness unit",
  kind: "exam",
  version: 1,
  exam: {
    code: "FX",
    questions: 10,
    minutes: 30,
    passScaled: 720,
    scaleMin: 100,
    scaleMax: 1000,
    date: "2026-12-07",
  },
  domains: [
    {
      code: "D1",
      name: "One",
      weight: 100,
      skills: [{ code: "D1.A", name: "A", weight: 100 }],
    },
  ],
};

describe("weatherFor", () => {
  it("maps the CONTEXT.md bands on the whole percent", () => {
    expect(weatherFor(null)).toBe("fog");
    expect(weatherFor(0)).toBe("rain");
    expect(weatherFor(71)).toBe("rain");
    expect(weatherFor(72)).toBe("cloudy");
    expect(weatherFor(84)).toBe("cloudy");
    expect(weatherFor(85)).toBe("sunny");
    expect(weatherFor(100)).toBe("sunny");
  });

  it("keeps the pass mark reference at 72%", () => {
    expect(READINESS_THRESHOLDS.passMarkPercent).toBe(72);
  });
});

describe("readiness", () => {
  it("projects to today once the exam date has passed", () => {
    // One correct answer on exam day (S = 2.3065), read 10 days later: R = 0.77437 → 77%.
    // Had the horizon stayed on the (past) exam day, R would be 1 → 100%.
    const r = readiness({
      pack: PACK,
      attempts: [
        {
          questionId: "q",
          skillCode: "D1.A",
          correct: true,
          answeredAt: new Date("2026-12-07T00:00:00Z"),
        },
      ],
      storms: [],
      now: new Date("2026-12-17T00:00:00Z"),
    });
    expect(r?.domains[0]?.forecastPercent).toBe(77);
  });

  it("ignores a storm for a domain the pack does not have", () => {
    const r = readiness({
      pack: PACK,
      attempts: [],
      storms: [{ domainCode: "ZZ", percent: 90, finishedAt: new Date(0) }],
      now: new Date("2026-11-01T00:00:00Z"),
    });
    expect(r?.domains[0]?.weather).toBe("fog");
    expect(r?.overallPercent).toBeNull();
  });

  it("gives a course pack no readiness even if it carries exam metadata", () => {
    const r = readiness({
      pack: { ...PACK, kind: "course" },
      attempts: [],
      storms: [],
      now: new Date("2026-11-01T00:00:00Z"),
    });
    expect(r).toBeNull();
  });
});
