import { describe, expect, it } from "vitest";
import type { OpenFlag } from "@/server/review/types";
import { groupFlagsByItem } from "../utils";

const flag = (itemId: string, flagId: number): OpenFlag => ({
  itemId,
  flagId,
  comment: `c${flagId}`,
  reviewerName: "Ana",
  createdAt: "2026-11-02T12:00:00.000Z",
});

describe("groupFlagsByItem", () => {
  it("groups flags per item, items in first-flag order, flags in their order", () => {
    const grouped = groupFlagsByItem([
      flag("b", 1),
      flag("a", 2),
      flag("b", 3),
    ]);
    expect(
      grouped.map((g) => [g.itemId, g.flags.map((f) => f.flagId)]),
    ).toEqual([
      ["b", [1, 3]],
      ["a", [2]],
    ]);
  });

  it("returns nothing for no flags", () => {
    expect(groupFlagsByItem([])).toEqual([]);
  });
});
