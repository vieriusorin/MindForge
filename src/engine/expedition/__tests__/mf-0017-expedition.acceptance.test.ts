/**
 * MF-0017 acceptance (engine): percent, status word and time left of a Group Expedition follow the
 * GOAL's "Edge inputs" table; the C-2 gate allows expeditions only in groups of 4 or more members.
 * Every expected value is worked by hand from GOAL.md, never from running the code.
 */
import { describe, expect, it } from "vitest";
import {
  EXPEDITION_MIN_MEMBERS,
  EXPEDITION_TARGET,
  isExpeditionAllowed,
  summarizeExpedition,
} from "@/engine/expedition";

// A 7-day window [startsAt, endsAt), as the database sets it.
const startsAt = new Date("2026-11-02T10:00:00.000Z");
const endsAt = new Date("2026-11-09T10:00:00.000Z");
const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;

/** `ms` milliseconds before the window ends. */
const left = (ms: number): Date => new Date(endsAt.getTime() - ms);

function summary(progress: number, target: number, now: Date) {
  return summarizeExpedition({ progress, target, startsAt, endsAt, now });
}

describe("MF-0017 expedition summary (engine)", () => {
  it("SC-4: active with 0 counted shows 0%, 'On the way' and the time left", () => {
    // one hour in: 6 d 23 h left → floored to 6 days
    expect(summary(0, 200, new Date("2026-11-02T11:00:00.000Z"))).toEqual({
      percent: 0,
      status: "on-the-way",
      timeLeft: { kind: "days", count: 6 },
      isActive: true,
    });
  });

  it("SC-4: percent is floored and never shows 100 before the target is reached (199/200 → 99, 1/200 → 0)", () => {
    const now = left(3 * 24 * HOUR);
    expect(summary(199, 200, now).percent).toBe(99);
    expect(summary(199, 200, now).status).toBe("on-the-way");
    expect(summary(1, 200, now).percent).toBe(0);
    expect(summary(140, 200, now).percent).toBe(70);
  });

  it("SC-4: progress at or above the target while active is 'reached' with a full bar (212/200 → 100%)", () => {
    const now = left(3 * 24 * HOUR);
    expect(summary(212, 200, now)).toEqual({
      percent: 100,
      status: "reached",
      timeLeft: { kind: "days", count: 3 },
      isActive: true,
    });
    expect(summary(200, 200, now).status).toBe("reached");
    expect(summary(200, 200, now).percent).toBe(100);
  });

  it("SC-4: ended and reached shows 'reached' and 'Ended'", () => {
    const now = new Date("2026-11-10T10:00:00.000Z");
    expect(summary(200, 200, now)).toEqual({
      percent: 100,
      status: "reached",
      timeLeft: { kind: "ended" },
      isActive: false,
    });
    expect(summary(212, 200, now).percent).toBe(100);
  });

  it("SC-4: ended and not reached shows 140 of 200 · 70% and 'Not reached'", () => {
    const now = new Date("2026-11-10T10:00:00.000Z");
    expect(summary(140, 200, now)).toEqual({
      percent: 70,
      status: "not-reached",
      timeLeft: { kind: "ended" },
      isActive: false,
    });
  });

  it("SC-4: time left of 24 h or more is whole days, floored (exactly 24 h and 47 h 59 m → 1 day)", () => {
    expect(summary(0, 200, left(24 * HOUR)).timeLeft).toEqual({
      kind: "days",
      count: 1,
    });
    expect(summary(0, 200, left(47 * HOUR + 59 * MINUTE)).timeLeft).toEqual({
      kind: "days",
      count: 1,
    });
    expect(summary(0, 200, left(48 * HOUR)).timeLeft).toEqual({
      kind: "days",
      count: 2,
    });
  });

  it("SC-4: time left from 1 h up to under 24 h is whole hours (23 h 59 m → 23, 5 h → 5, exactly 1 h → 1)", () => {
    expect(summary(0, 200, left(23 * HOUR + 59 * MINUTE)).timeLeft).toEqual({
      kind: "hours",
      count: 23,
    });
    expect(summary(0, 200, left(5 * HOUR)).timeLeft).toEqual({
      kind: "hours",
      count: 5,
    });
    expect(summary(0, 200, left(HOUR)).timeLeft).toEqual({
      kind: "hours",
      count: 1,
    });
  });

  it("SC-4: time left above 0 and under 1 h is 'Less than an hour left' and still active", () => {
    expect(summary(0, 200, left(59 * MINUTE + 59_000))).toMatchObject({
      timeLeft: { kind: "under-an-hour" },
      isActive: true,
    });
    expect(summary(0, 200, left(1))).toMatchObject({
      timeLeft: { kind: "under-an-hour" },
      isActive: true,
    });
  });

  it("SC-4: now = endsAt exactly is 'Ended' and not active (the window is half-open)", () => {
    expect(summary(50, 200, endsAt)).toEqual({
      percent: 25,
      status: "not-reached",
      timeLeft: { kind: "ended" },
      isActive: false,
    });
  });

  it("SC-4: now = startsAt exactly is active with the full 7 days left", () => {
    expect(summary(0, 200, startsAt)).toEqual({
      percent: 0,
      status: "on-the-way",
      timeLeft: { kind: "days", count: 7 },
      isActive: true,
    });
  });

  it("SC-4 (C-2): expeditions need at least 4 members: 1, 2, 3 refused; 4, 5 allowed", () => {
    // the range the DB and the form both enforce ("Decided without a question")
    expect(EXPEDITION_TARGET).toEqual({ min: 10, max: 1000, default: 100 });
    expect(EXPEDITION_MIN_MEMBERS).toBe(4);
    expect(isExpeditionAllowed(1)).toBe(false);
    expect(isExpeditionAllowed(2)).toBe(false);
    expect(isExpeditionAllowed(3)).toBe(false);
    expect(isExpeditionAllowed(4)).toBe(true);
    expect(isExpeditionAllowed(5)).toBe(true);
  });
});
