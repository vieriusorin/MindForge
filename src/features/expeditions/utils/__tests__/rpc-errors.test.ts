import { describe, expect, it } from "vitest";
import { endExpeditionRpcError, startExpeditionRpcError } from "../rpc-errors";

describe("startExpeditionRpcError", () => {
  it("says an expedition is already running on 23P01", () => {
    expect(startExpeditionRpcError({ code: "23P01" })).toEqual({
      message: "An expedition is already running.",
    });
  });

  it("refuses a non-admin on 42501", () => {
    expect(startExpeditionRpcError({ code: "42501" })).toEqual({
      message: "Only the group admin can start an expedition.",
    });
  });

  it("explains the 4-member minimum on P0001", () => {
    expect(startExpeditionRpcError({ code: "P0001" })).toEqual({
      message: "Expeditions need at least 4 members.",
    });
  });

  it("puts a bad domain on the domain field on 22023", () => {
    expect(startExpeditionRpcError({ code: "22023" })).toEqual({
      message: "Pick a domain from this group's pack.",
      fieldErrors: { domainCode: "Pick a domain from this group's pack." },
    });
  });

  it("falls back to a retry message for anything else", () => {
    expect(startExpeditionRpcError({})).toEqual({
      message: "Couldn't start the expedition. Try again.",
    });
  });
});

describe("endExpeditionRpcError", () => {
  it("refuses a non-admin on 42501", () => {
    expect(endExpeditionRpcError({ code: "42501" })).toBe(
      "Only the group admin can end an expedition.",
    );
  });

  it("says nothing is running on P0002", () => {
    expect(endExpeditionRpcError({ code: "P0002" })).toBe(
      "No expedition is running.",
    );
  });

  it("falls back to a retry message for anything else", () => {
    expect(endExpeditionRpcError({ code: "XX000" })).toBe(
      "Couldn't end the expedition. Try again.",
    );
    expect(endExpeditionRpcError({})).toBe(
      "Couldn't end the expedition. Try again.",
    );
  });
});
