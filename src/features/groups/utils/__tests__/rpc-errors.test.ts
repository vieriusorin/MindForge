import { describe, expect, it } from "vitest";
import {
  createGroupRpcError,
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
