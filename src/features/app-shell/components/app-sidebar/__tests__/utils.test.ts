import { describe, expect, it } from "vitest";
import { isActivePath, MAX_PINNED_GROUPS, pinnedGroups } from "../utils";

describe("pinnedGroups", () => {
  it("pins at most three groups, in the given order", () => {
    expect(MAX_PINNED_GROUPS).toBe(3);
    expect(pinnedGroups(["a", "b", "c", "d"])).toEqual(["a", "b", "c"]);
    expect(pinnedGroups([])).toEqual([]);
  });
});

describe("isActivePath", () => {
  it("matches the exact path", () => {
    expect(isActivePath("/today", "/today")).toBe(true);
  });
  it("matches sub-paths", () => {
    expect(isActivePath("/groups/abc", "/groups")).toBe(true);
  });
  it("does not match a sibling that shares a prefix", () => {
    expect(isActivePath("/groupsettings", "/groups")).toBe(false);
  });
  it("root matches only itself", () => {
    expect(isActivePath("/today", "/")).toBe(false);
    expect(isActivePath("/", "/")).toBe(true);
  });
});
