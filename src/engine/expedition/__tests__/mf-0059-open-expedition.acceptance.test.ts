/**
 * MF-0059 acceptance (SC-10, engine): an expedition runs at the group's own pace. With
 * `endsAt: null` (open), `summarizeExpedition` returns `timeLeft: { kind: "open" }`, is active once
 * `now >= startsAt`, and its status follows progress alone ("on-the-way" below the target, "reached"
 * at or above it); the percent is floored and capped as in MF-0017. Bounded inputs are covered,
 * unchanged, by the frozen mf-0017-expedition.acceptance.test.ts. Literals from
 * .planning/tasks/MF-0059/GOAL.md ("Expeditions at your own pace", SC-10, edge table).
 */
import { describe, expect, it } from "vitest";
import { summarizeExpedition } from "@/engine/expedition";

const startsAt = new Date("2026-11-02T10:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const after = (ms: number): Date => new Date(startsAt.getTime() + ms);

function open(progress: number, target: number, now: Date) {
  return summarizeExpedition({ progress, target, startsAt, endsAt: null, now });
}

describe("MF-0059 SC-10: an open expedition (no end date)", () => {
  it("SC-10: one hour in, 0 counted → 0%, on the way, open, active", () => {
    expect(open(0, 200, after(60 * 60 * 1000))).toEqual({
      percent: 0,
      status: "on-the-way",
      timeLeft: { kind: "open" },
      isActive: true,
    });
  });

  it("SC-10: at exactly startsAt it is already active", () => {
    expect(open(0, 100, startsAt)).toEqual({
      percent: 0,
      status: "on-the-way",
      timeLeft: { kind: "open" },
      isActive: true,
    });
  });

  it("SC-10: 30 days in (past the old 7-day window) it is still open and on the way; 199/200 floors to 99", () => {
    expect(open(199, 200, after(30 * DAY))).toEqual({
      percent: 99,
      status: "on-the-way",
      timeLeft: { kind: "open" },
      isActive: true,
    });
  });

  it("SC-10: at the target it reads reached, 100%, and keeps running (not ended)", () => {
    expect(open(200, 200, after(3 * DAY))).toEqual({
      percent: 100,
      status: "reached",
      timeLeft: { kind: "open" },
      isActive: true,
    });
  });

  it("SC-10: above the target the percent is capped at 100 and it stays reached", () => {
    expect(open(250, 200, after(10 * DAY))).toEqual({
      percent: 100,
      status: "reached",
      timeLeft: { kind: "open" },
      isActive: true,
    });
  });

  it("SC-10: before startsAt it is not active", () => {
    expect(open(0, 100, new Date(startsAt.getTime() - 1000))).toMatchObject({
      timeLeft: { kind: "open" },
      isActive: false,
    });
  });
});
