import { describe, expect, it } from "vitest";
import { isActivePath, isStormActive } from "../utils";

// MF-0054: which groups the section shows moved to src/server/groups/sidebar-group-section.ts
// (frozen in mf-0054-sidebar-section.acceptance.test.ts); the sidebar renders what it is given.

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

describe("isStormActive", () => {
  const href = "/play/ccdv-f/storm/full";
  it("covers the Full and Boss start pages of the pack", () => {
    expect(isStormActive("/play/ccdv-f/storm/full", href)).toBe(true);
    expect(isStormActive("/play/ccdv-f/storm/boss/D2", href)).toBe(true);
  });
  it("covers every running or finished storm", () => {
    expect(
      isStormActive("/storms/6f1c1c1e-8a52-4a8e-9a39-1c1d2f3b4a5c", href),
    ).toBe(true);
  });
  it("does not light up on other play modes or look-alike paths", () => {
    expect(isStormActive("/play/ccdv-f/walk", href)).toBe(false);
    expect(isStormActive("/stormsettings", href)).toBe(false);
  });
  it("is never active when the pack has no Storm (MF-0052 SC-2)", () => {
    expect(isStormActive("/play/prod-prompting/storm/full", null)).toBe(false);
    expect(isStormActive("/storms/abc", null)).toBe(false);
  });
});
