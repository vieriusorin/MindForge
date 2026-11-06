import { describe, expect, it } from "vitest";
import { isEndedByCourseMove } from "@/engine/expedition";

describe("isEndedByCourseMove (MF-0059 C-1)", () => {
  it("an ended expedition in another pack than the group's current one ended with the move", () => {
    expect(
      isEndedByCourseMove({
        expeditionPack: "ai-capabilities",
        currentPack: "platform-foundations",
        isActive: false,
      }),
    ).toBe(true);
  });

  it("an ended expedition in the current pack did not end by a move", () => {
    expect(
      isEndedByCourseMove({
        expeditionPack: "ai-capabilities",
        currentPack: "ai-capabilities",
        isActive: false,
      }),
    ).toBe(false);
  });

  it("a running expedition is never 'ended by a move'", () => {
    expect(
      isEndedByCourseMove({
        expeditionPack: "ai-capabilities",
        currentPack: "platform-foundations",
        isActive: true,
      }),
    ).toBe(false);
  });
});
