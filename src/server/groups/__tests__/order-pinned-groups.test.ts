import { describe, expect, it } from "vitest";
import { orderPinnedGroups } from "../order-pinned-groups";

const groups = [{ id: "a" }, { id: "b" }, { id: "c" }];

describe("orderPinnedGroups", () => {
  it("orders by pinnedAt, newest first, whatever the input order", () => {
    expect(
      orderPinnedGroups({
        groups,
        pins: [
          { groupId: "a", pinnedAt: "2026-11-01T00:00:00.000Z" },
          { groupId: "c", pinnedAt: "2026-11-03T00:00:00.000Z" },
          { groupId: "b", pinnedAt: "2026-11-02T00:00:00.000Z" },
        ],
      }).map((g) => g.id),
    ).toEqual(["c", "b", "a"]);
  });

  it("compares instants, not strings (an offset that sorts lower as text is later in time)", () => {
    expect(
      orderPinnedGroups({
        groups,
        pins: [
          { groupId: "a", pinnedAt: "2026-11-01T10:00:00.000Z" },
          { groupId: "b", pinnedAt: "2026-11-01T09:30:00.000-01:00" },
        ],
      }).map((g) => g.id),
    ).toEqual(["b", "a"]);
  });

  it("breaks a tie by group id, greater first, and drops pins with no group", () => {
    const at = "2026-11-01T00:00:00.000Z";
    expect(
      orderPinnedGroups({
        groups,
        pins: [
          { groupId: "a", pinnedAt: at },
          { groupId: "zz", pinnedAt: at },
          { groupId: "c", pinnedAt: at },
        ],
      }).map((g) => g.id),
    ).toEqual(["c", "a"]);
    expect(orderPinnedGroups({ groups, pins: [] })).toEqual([]);
  });
});
