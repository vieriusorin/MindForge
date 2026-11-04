// MF-0012 acceptance (frozen): SC-4, where the duel's back link goes.
import { describe, expect, it } from "vitest";
import { duelBackLink } from "../back-link";

const GROUP_ID = "3f2a6c1e-8b4d-4c2a-9e1f-0a1b2c3d4e5f";

describe("MF-0012 duelBackLink", () => {
  it("SC-4: opened from a group, it goes back to that group", () => {
    expect(duelBackLink(GROUP_ID)).toEqual({
      href: `/groups/${GROUP_ID}`,
      label: "Back to the group",
    });
  });

  it("SC-4: opened without a source, it goes to Today", () => {
    expect(duelBackLink(null)).toEqual({
      href: "/today",
      label: "Back to your forest",
    });
  });

  it("SC-4: a source that is not a group id goes to Today", () => {
    for (const from of ["", "../admin", "//evil.example", `${GROUP_ID}/x`]) {
      expect(duelBackLink(from)).toEqual({
        href: "/today",
        label: "Back to your forest",
      });
    }
  });
});
