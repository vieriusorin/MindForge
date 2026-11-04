import { describe, expect, it } from "vitest";
import { WEATHER } from "@/engine/readiness";
import {
  forecastLabel,
  overallLabel,
  stormLabel,
  WEATHER_DISPLAY,
} from "../utils";

describe("readiness-card utils", () => {
  it("gives every weather a word and an icon", () => {
    for (const weather of WEATHER) {
      expect(WEATHER_DISPLAY[weather].label.length).toBeGreaterThan(0);
      expect(WEATHER_DISPLAY[weather].icon).toBeTruthy();
    }
    expect(WEATHER_DISPLAY.fog.label).toBe("Fog");
  });

  it("says 'No storm yet' without a storm, the score with one", () => {
    expect(stormLabel(null)).toBe("No storm yet");
    expect(stormLabel(60)).toBe("Last storm 60%");
  });

  it("labels the forecast or its absence", () => {
    expect(forecastLabel(null)).toBe("Not studied yet");
    expect(forecastLabel(52)).toBe("Memory forecast 52%");
  });

  it("labels the overall figure or its absence", () => {
    expect(overallLabel(null)).toBe("No data yet");
    expect(overallLabel(51)).toBe("51%");
  });
});
