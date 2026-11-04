import { describe, expect, it } from "vitest";
import { START_MESSAGE, stormRpcError } from "../rpc-errors";

describe("stormRpcError", () => {
  it("MF013 (deadline passed) says time is up and locks the session", () => {
    expect(stormRpcError({ code: "MF013" })).toEqual({
      message: "Time is up: this storm has ended.",
      isStormOver: true,
    });
  });

  it("55000 says the question changed and does not lock", () => {
    expect(stormRpcError({ code: "55000" })).toEqual({
      message: "This question changed during the storm; it will not count.",
      isStormOver: false,
    });
  });

  it("42501, 22023 and P0002 each get their own message", () => {
    const messages = ["42501", "22023", "P0002"].map(
      (code) => stormRpcError({ code }).message,
    );
    expect(new Set(messages).size).toBe(3);
    expect(messages).not.toContain("Could not save. Try again.");
  });

  it("an unknown or missing code falls back without locking", () => {
    expect(stormRpcError({ code: "XX000" })).toEqual({
      message: "Could not save. Try again.",
      isStormOver: false,
    });
    expect(stormRpcError({}).isStormOver).toBe(false);
  });
});

describe("START_MESSAGE", () => {
  it("words every start refusal", () => {
    // start-storm.ts is server-only, so the closed set is restated here; `satisfies` in the
    // source is what keeps the two in step.
    const errors = [
      "no-questions",
      "already-running",
      "content-changed",
      "not-ready",
    ] as const;
    expect(Object.keys(START_MESSAGE).sort()).toEqual([...errors].sort());
    expect(START_MESSAGE["already-running"]).toBe(
      "You already have a storm running. Finish it first.",
    );
  });
});
