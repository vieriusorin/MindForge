import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Attempt } from "@/engine/memory";
import { loadPackFile, type Pack } from "@/engine/pack";
import { readiness } from "@/engine/readiness";

/**
 * MF-0015 acceptance (frozen). Expected values are hand-computed from the requirement, never
 * from the code.
 *
 * FSRS-6 forgetting curve (ts-fsrs defaults, decay w20 = 0.1542, elapsed days floored):
 *   R(t, S) = (1 + F · t / S) ^ -0.1542,  F = 0.9 ^ (-1 / 0.1542) - 1 = 0.98049
 * One correct answer on a new card gives S = w2 = 2.3065 days. Ten days later:
 *   R(10, 2.3065) = (1 + 0.98049 · 4.33557) ^ -0.1542 = 5.25099 ^ -0.1542 = 0.77437
 * Answered at the horizon itself (t = 0): R = 1.
 */

const ROOT = process.cwd();

const PACK: Pack = {
  slug: "readiness-fixture",
  name: "Readiness fixture",
  kind: "exam",
  version: 1,
  exam: {
    code: "FX",
    questions: 50,
    minutes: 90,
    passScaled: 720,
    scaleMin: 100,
    scaleMax: 1000,
    date: "2026-12-07",
  },
  domains: [
    {
      code: "D1",
      name: "Domain one",
      weight: 60,
      skills: [
        { code: "D1.A", name: "A", weight: 40 },
        { code: "D1.B", name: "B", weight: 20 },
      ],
    },
    {
      code: "D2",
      name: "Domain two",
      weight: 25,
      skills: [{ code: "D2.C", name: "C", weight: 25 }],
    },
    {
      code: "D3",
      name: "Domain three",
      weight: 15,
      skills: [{ code: "D3.E", name: "E", weight: 15 }],
    },
  ],
};

const TEN_DAYS_OUT = new Date("2026-11-27T00:00:00Z");
const EXAM_DAY = new Date("2026-12-07T00:00:00Z");

const attempt = (skillCode: string, at: Date, correct = true): Attempt => ({
  questionId: `${skillCode}-q`,
  skillCode,
  correct,
  answeredAt: at,
});

const byCode = (r: ReturnType<typeof readiness>, code: string) =>
  r?.domains.find((d) => d.domainCode === code);

describe("MF-0015 readiness weather", () => {
  it("SC-1: per-domain forecast, last storm, weather and overall, ten days before the exam", () => {
    const r = readiness({
      pack: PACK,
      attempts: [attempt("D1.A", TEN_DAYS_OUT)],
      // Out of order on purpose: "last" is by finishedAt, not array position.
      storms: [
        {
          domainCode: "D1",
          percent: 60,
          finishedAt: new Date("2026-11-25T10:00:00Z"),
        },
        {
          domainCode: "D1",
          percent: 90,
          finishedAt: new Date("2026-11-20T10:00:00Z"),
        },
        {
          domainCode: "D2",
          percent: 80,
          finishedAt: new Date("2026-11-26T10:00:00Z"),
        },
      ],
      now: TEN_DAYS_OUT,
    });
    expect(r).not.toBeNull();
    expect(r?.examDate).toBe("2026-12-07");
    expect(r?.passMarkPercent).toBe(72);
    // D1: (40 · 0.77437 + 20 · 0) / 60 = 0.51624 → 52%; last storm 60; min 51.6 → rain.
    expect(byCode(r, "D1")).toMatchObject({
      forecastPercent: 52,
      stormPercent: 60,
      weather: "rain",
    });
    // D2: never attempted, storm 80 → cloudy from the storm alone.
    expect(byCode(r, "D2")).toMatchObject({
      forecastPercent: null,
      stormPercent: 80,
      weather: "cloudy",
    });
    // D3: nothing → fog.
    expect(byCode(r, "D3")).toMatchObject({
      forecastPercent: null,
      stormPercent: null,
      weather: "fog",
    });
    // Overall: (60 · 51.624 + 25 · 80 + 15 · 0) / 100 = 50.97 → 51% → rain.
    expect(r?.overallPercent).toBe(51);
    expect(r?.overallWeather).toBe("rain");
  });

  it("SC-1: on exam day the lower of forecast and storm decides; 72 is cloudy, 88 is sunny", () => {
    const r = readiness({
      pack: PACK,
      attempts: [
        attempt("D1.A", EXAM_DAY),
        attempt("D1.B", EXAM_DAY),
        attempt("D2.C", EXAM_DAY),
        attempt("D3.E", EXAM_DAY),
      ],
      storms: [
        { domainCode: "D1", percent: 88, finishedAt: EXAM_DAY },
        { domainCode: "D3", percent: 72, finishedAt: EXAM_DAY },
      ],
      now: EXAM_DAY,
    });
    expect(byCode(r, "D1")).toMatchObject({
      forecastPercent: 100,
      stormPercent: 88,
      weather: "sunny",
    });
    expect(byCode(r, "D3")).toMatchObject({
      forecastPercent: 100,
      stormPercent: 72,
      weather: "cloudy",
    });
    // (60 · 88 + 25 · 100 + 15 · 72) / 100 = 88.6 → 89% → sunny.
    expect(r?.overallPercent).toBe(89);
    expect(r?.overallWeather).toBe("sunny");
  });

  it("SC-1: weather follows the whole percent shown (84.6 shows 85 → sunny; 71.4 shows 71 → rain)", () => {
    const r = readiness({
      pack: PACK,
      attempts: [attempt("D2.C", EXAM_DAY), attempt("D3.E", EXAM_DAY)],
      storms: [
        { domainCode: "D2", percent: 84.6, finishedAt: EXAM_DAY },
        { domainCode: "D3", percent: 71.4, finishedAt: EXAM_DAY },
      ],
      now: EXAM_DAY,
    });
    expect(byCode(r, "D2")).toMatchObject({
      stormPercent: 85,
      weather: "sunny",
    });
    expect(byCode(r, "D3")).toMatchObject({
      stormPercent: 71,
      weather: "rain",
    });
  });

  it("SC-2: no storm and no memory is fog; memory without a storm uses the forecast (no storm yet)", () => {
    const r = readiness({
      pack: PACK,
      attempts: [attempt("D2.C", EXAM_DAY)],
      storms: [],
      now: EXAM_DAY,
    });
    expect(byCode(r, "D1")).toMatchObject({
      forecastPercent: null,
      stormPercent: null,
      weather: "fog",
    });
    expect(byCode(r, "D2")).toMatchObject({
      forecastPercent: 100,
      stormPercent: null,
      weather: "sunny",
    });
    // Fog counts as 0: (60 · 0 + 25 · 100 + 15 · 0) / 100 = 25 → rain.
    expect(r?.overallPercent).toBe(25);
    expect(r?.overallWeather).toBe("rain");
  });

  it("SC-2: with nothing at all, every domain and the overall line are fog", () => {
    const r = readiness({
      pack: PACK,
      attempts: [],
      storms: [],
      now: EXAM_DAY,
    });
    expect(r?.domains.map((d) => d.weather)).toEqual(["fog", "fog", "fog"]);
    expect(r?.overallPercent).toBeNull();
    expect(r?.overallWeather).toBe("fog");
  });

  it("SC-4: the non-exam sample pack gets no readiness", async () => {
    const pack = await loadPackFile(
      join(ROOT, "packs/team-onboarding-sample/pack.yaml"),
    );
    expect(pack.kind).not.toBe("exam");
    expect(
      readiness({ pack, attempts: [], storms: [], now: EXAM_DAY }),
    ).toBeNull();
  });

  it("SC-4: an exam pack without an exam date gets no readiness", () => {
    const undated: Pack = {
      ...PACK,
      exam: {
        code: "FX",
        questions: 50,
        minutes: 90,
        passScaled: 720,
        scaleMin: 100,
        scaleMax: 1000,
      },
    };
    expect(
      readiness({ pack: undated, attempts: [], storms: [], now: EXAM_DAY }),
    ).toBeNull();
  });
});
