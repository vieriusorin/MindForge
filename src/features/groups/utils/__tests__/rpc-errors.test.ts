import { describe, expect, it } from "vitest";
import {
  advanceGroupCourseRpcError,
  createGroupRpcError,
  createPathGroupRpcError,
  discussionLinkRpcError,
  joinGroupRpcError,
  MAX_GROUPS_PER_USER,
  pinRpcError,
  rotateInviteRpcError,
} from "../rpc-errors";

describe("createGroupRpcError", () => {
  it("puts an unknown pack (22023) on the pack field", () => {
    expect(createGroupRpcError({ code: "22023" })).toEqual({
      message: "Pick a learning pack.",
      fieldErrors: { packSlug: "Pick a learning pack." },
    });
  });

  it("explains the group limit (54000) with the cap of 10", () => {
    expect(MAX_GROUPS_PER_USER).toBe(10);
    expect(createGroupRpcError({ code: "54000" })).toEqual({
      message: "You can create up to 10 groups.",
    });
  });

  it("falls back to a retry message for anything else", () => {
    expect(createGroupRpcError({ code: "XX000" })).toEqual({
      message: "Could not create the group. Try again.",
    });
    expect(createGroupRpcError({})).toEqual({
      message: "Could not create the group. Try again.",
    });
  });
});

describe("rotateInviteRpcError", () => {
  it("tells a non-admin (42501) who may reset the link", () => {
    expect(rotateInviteRpcError({ code: "42501" })).toBe(
      "Only the group admin can reset the link.",
    );
  });

  it("falls back to a retry message", () => {
    expect(rotateInviteRpcError({ code: "08006" })).toBe(
      "Could not reset the link. Try again.",
    );
  });
});

describe("pinRpcError", () => {
  it("explains a refused pin on a group you are not in (42501)", () => {
    expect(pinRpcError({ code: "42501" })).toBe(
      "You can only pin groups you belong to.",
    );
  });

  it("falls back to a retry message for anything else", () => {
    expect(pinRpcError({ code: "XX000" })).toBe(
      "Could not update your pins. Try again.",
    );
    expect(pinRpcError({})).toBe("Could not update your pins. Try again.");
  });
});

describe("createPathGroupRpcError", () => {
  it("puts an unknown path (22023) on the path field", () => {
    expect(createPathGroupRpcError({ code: "22023" })).toEqual({
      message: "Pick a path.",
      fieldErrors: { pathSlug: "Pick a path." },
    });
  });

  it("explains the group limit (54000) with the cap of 10", () => {
    expect(createPathGroupRpcError({ code: "54000" })).toEqual({
      message: "You can create up to 10 groups.",
    });
  });

  it("falls back to a retry message for anything else", () => {
    expect(createPathGroupRpcError({ code: "XX000" })).toEqual({
      message: "Could not create the group. Try again.",
    });
    expect(createPathGroupRpcError({})).toEqual({
      message: "Could not create the group. Try again.",
    });
  });
});

describe("joinGroupRpcError", () => {
  it("explains an invalid or reset invite (P0002)", () => {
    expect(joinGroupRpcError({ code: "P0002" })).toBe(
      "This invite link is invalid or has been reset. Ask a group member for a new one.",
    );
  });

  it("falls back to a retry message for anything else", () => {
    expect(joinGroupRpcError({ code: "42501" })).toBe(
      "Could not join the group. Try again.",
    );
    expect(joinGroupRpcError({})).toBe("Could not join the group. Try again.");
  });
});

describe("advanceGroupCourseRpcError", () => {
  it("tells a non-admin (42501) who may move the group", () => {
    expect(advanceGroupCourseRpcError({ code: "42501" })).toBe(
      "Only the group admin can move the group to the next course.",
    );
  });

  it("asks for a refresh when the group already moved (40001)", () => {
    expect(advanceGroupCourseRpcError({ code: "40001" })).toBe(
      "The group has already moved. Refresh to see its course.",
    );
  });

  it("says there is no next course (P0001)", () => {
    expect(advanceGroupCourseRpcError({ code: "P0001" })).toBe(
      "This group has no next course to move to.",
    );
  });

  it("falls back to a retry message for anything else", () => {
    expect(advanceGroupCourseRpcError({ code: "XX000" })).toBe(
      "Could not move the group. Try again.",
    );
    expect(advanceGroupCourseRpcError({})).toBe(
      "Could not move the group. Try again.",
    );
  });
});

describe("discussionLinkRpcError", () => {
  it("42501 (not the admin) → a form message naming who may change it", () => {
    expect(discussionLinkRpcError({ code: "42501" })).toEqual({
      message: "Only the group admin can change the discussion link.",
    });
  });

  it("23514 (the DB CHECK) → the url field error", () => {
    expect(discussionLinkRpcError({ code: "23514" })).toEqual({
      message: "Use an https:// link, up to 500 characters.",
      fieldErrors: { url: "Use an https:// link, up to 500 characters." },
    });
  });

  it("anything else → try again", () => {
    expect(discussionLinkRpcError({})).toEqual({
      message: "Could not save the link. Try again.",
    });
  });
});
