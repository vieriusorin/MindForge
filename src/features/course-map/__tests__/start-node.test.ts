import { describe, expect, it } from "vitest";
import { packDuelHref } from "@/features/course-map/utils/start-node";

describe("packDuelHref", () => {
  it("opens the pack's Scenario Duel, with no skill in the URL", () => {
    expect(packDuelHref("subagents")).toBe("/play/subagents/duel");
  });
});
