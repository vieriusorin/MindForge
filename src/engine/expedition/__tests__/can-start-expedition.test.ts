import { describe, expect, it } from "vitest";
import {
  canStartExpedition,
  type ExpeditionSummary,
} from "@/engine/expedition";

const summary = (
  isActive: boolean,
  status: ExpeditionSummary["status"],
): ExpeditionSummary => ({
  percent: 0,
  status,
  timeLeft: isActive ? { kind: "open" } : { kind: "ended" },
  isActive,
});

describe("canStartExpedition (MF-0059 own pace)", () => {
  it("an ended expedition never blocks a new one", () => {
    expect(canStartExpedition(summary(false, "not-reached"))).toBe(true);
    expect(canStartExpedition(summary(false, "reached"))).toBe(true);
  });

  it("a running expedition on the way blocks a new one", () => {
    expect(canStartExpedition(summary(true, "on-the-way"))).toBe(false);
  });

  it("a running expedition that reached its target is replaced by the next one", () => {
    expect(canStartExpedition(summary(true, "reached"))).toBe(true);
  });
});
