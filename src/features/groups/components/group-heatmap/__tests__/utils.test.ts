import { describe, expect, it } from "vitest";
import { BAND_LEGEND, bandLook, notEnoughDataLine, statusLook } from "../utils";

describe("group-heatmap utils", () => {
  it("bandLook names every band in words with its own swatch, lightest to darkest", () => {
    expect(bandLook("few")).toEqual({
      label: "Few healthy trees",
      range: "under a third",
      swatch: "bg-chart-1",
    });
    expect(bandLook("some")).toEqual({
      label: "Some healthy trees",
      range: "a third to two thirds",
      swatch: "bg-chart-3",
    });
    expect(bandLook("most")).toEqual({
      label: "Most healthy trees",
      range: "two thirds or more",
      swatch: "bg-chart-5",
    });
  });

  it("BAND_LEGEND lists the three bands in order, with no percent anywhere (MF-0021)", () => {
    expect(BAND_LEGEND.map((b) => b.label)).toEqual([
      "Few healthy trees",
      "Some healthy trees",
      "Most healthy trees",
    ]);
    expect(JSON.stringify(BAND_LEGEND)).not.toContain("%");
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

  it("notEnoughDataLine names the threshold and no count", () => {
    expect(notEnoughDataLine(3)).toBe(
      "Not enough data yet. The heatmap appears once at least 3 other members have answered questions.",
    );
  });
});
