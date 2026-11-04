import { describe, expect, it } from "vitest";
import {
  HEAT_BUCKETS,
  heatBucket,
  notEnoughDataLine,
  regionFigures,
  SWATCH_CLASS,
  statusLook,
} from "../utils";

describe("group-heatmap utils", () => {
  it("heatBucket maps the healthy share onto 5 shades at 20-point steps", () => {
    expect([0, 19, 20, 39, 40, 60, 79, 80, 100].map(heatBucket)).toEqual([
      1, 1, 2, 2, 3, 4, 4, 5, 5,
    ]);
  });

  it("HEAT_BUCKETS cover 0–100 without gaps, one swatch class each", () => {
    expect(HEAT_BUCKETS.map((b) => `${b.from}-${b.to}`)).toEqual([
      "0-19",
      "20-39",
      "40-59",
      "60-79",
      "80-100",
    ]);
    expect(HEAT_BUCKETS.map((b) => SWATCH_CLASS[b.bucket])).toEqual([
      "bg-chart-1",
      "bg-chart-2",
      "bg-chart-3",
      "bg-chart-4",
      "bg-chart-5",
    ]);
  });

  it("statusLook gives every status a word, Fading in the destructive badge", () => {
    expect(statusLook("holding")).toEqual({
      label: "Holding",
      badge: "secondary",
    });
    expect(statusLook("fading")).toEqual({
      label: "Fading",
      badge: "destructive",
    });
    expect(statusLook("no-data")).toEqual({
      label: "No data yet",
      badge: "outline",
    });
  });

  it("regionFigures says both numbers, or that recall isn't measured", () => {
    const base = { domainCode: "A", name: "Alpha", status: "fading" } as const;
    expect(
      regionFigures({ ...base, healthyPercent: 33, retrievabilityPercent: 80 }),
    ).toBe("33% healthy trees · 80% average recall");
    expect(
      regionFigures({
        ...base,
        status: "no-data",
        healthyPercent: 0,
        retrievabilityPercent: null,
      }),
    ).toBe("0% healthy trees · no recall measured yet");
  });

  it("notEnoughDataLine names the threshold and no count", () => {
    expect(notEnoughDataLine(3)).toBe(
      "Not enough data yet. The heatmap appears once at least 3 other members have answered questions.",
    );
  });
});
