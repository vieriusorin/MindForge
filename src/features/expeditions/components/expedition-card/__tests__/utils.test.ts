import { describe, expect, it } from "vitest";
import {
  goalLine,
  movedOnLine,
  noneLine,
  progressLine,
  STATUS_LOOK,
  statusLook,
  timeLeftLabel,
  tooSmallLine,
} from "../utils";

describe("expedition card copy", () => {
  it("gives every status a word (never colour alone)", () => {
    expect(statusLook("on-the-way").label).toBe("On the way");
    expect(statusLook("reached").label).toBe("Goal reached");
    expect(statusLook("not-reached").label).toBe("Not reached");
    expect(Object.keys(STATUS_LOOK)).toHaveLength(3);
  });

  it("says the time left in days, hours, under an hour, or ended", () => {
    expect(timeLeftLabel({ kind: "days", count: 3 })).toBe("3 days left");
    expect(timeLeftLabel({ kind: "days", count: 1 })).toBe("1 day left");
    expect(timeLeftLabel({ kind: "hours", count: 5 })).toBe("5 hours left");
    expect(timeLeftLabel({ kind: "hours", count: 1 })).toBe("1 hour left");
    expect(timeLeftLabel({ kind: "under-an-hour" })).toBe(
      "Less than an hour left",
    );
    expect(timeLeftLabel({ kind: "ended" })).toBe("Ended");
    // MF-0059: an expedition runs at the group's own pace
    expect(timeLeftLabel({ kind: "open" })).toBe("No end date");
  });

  // MF-0059 (user, 2026-11-06): true whether the move ended it or the admin ended it before a later move.
  it("says the group has moved on since the expedition's course (MF-0059 C-1)", () => {
    expect(movedOnLine()).toBe(
      "Ended. The group has since moved to the next course.",
    );
  });

  it("states progress with both numbers and the percent", () => {
    expect(progressLine({ progress: 140, target: 200, percent: 70 })).toBe(
      "140 of 200 correct recalls · 70%",
    );
    expect(progressLine({ progress: 212, target: 200, percent: 100 })).toBe(
      "212 of 200 correct recalls · 100%",
    );
  });

  it("invites the admin to start one and tells a member who can", () => {
    expect(noneLine(true)).toBe(
      "Set a goal: every member's correct recalls in one domain count until you end it.",
    );
    expect(noneLine(false)).toBe(
      "No expedition yet. Your group admin can start one.",
    );
  });

  it("states the goal and the member minimum", () => {
    expect(goalLine({ target: 200, domainName: "Security & Safety" })).toBe(
      "Together, make 200 correct recalls in Security & Safety.",
    );
    expect(tooSmallLine(4)).toBe("Expeditions need at least 4 members.");
  });
});
