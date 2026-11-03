import { describe, expect, it } from "vitest";
import { safeNextPath } from "../safe-next";

describe("safeNextPath", () => {
  it("keeps same-origin relative paths with query and hash", () => {
    expect(safeNextPath("/groups")).toBe("/groups");
    expect(safeNextPath("/join/abc123?x=1#top")).toBe("/join/abc123?x=1#top");
  });

  it("rejects anything that could leave the site", () => {
    for (const hostile of [
      "//evil.example",
      "/\\evil.example",
      "\\\\evil.example",
      "https://evil.example/groups",
      "javascript:alert(1)",
      "groups",
      "/%2F%2Fevil.example",
      " /groups",
      "/groups\n//evil",
    ]) {
      expect(safeNextPath(hostile), hostile).toBeNull();
    }
  });

  it("returns null for empty input", () => {
    expect(safeNextPath(null)).toBeNull();
    expect(safeNextPath(undefined)).toBeNull();
    expect(safeNextPath("")).toBeNull();
  });
});
