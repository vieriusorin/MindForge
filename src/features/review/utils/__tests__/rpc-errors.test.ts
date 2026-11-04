import { describe, expect, it } from "vitest";
import { reviewRpcError } from "../rpc-errors";

describe("reviewRpcError", () => {
  it("says the user may not act on a permission refusal", () => {
    expect(reviewRpcError({ code: "42501" })).toBe(
      "You can't do this for this item.",
    );
  });

  it("asks for a reload when the item's state or existence changed", () => {
    expect(reviewRpcError({ code: "55000" })).toMatch(/Reload the page/);
    expect(reviewRpcError({ code: "P0002" })).toMatch(/Reload the page/);
  });

  it("falls back to a retry message for anything else", () => {
    expect(reviewRpcError({})).toBe("Could not save your review. Try again.");
  });
});
