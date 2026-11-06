import { describe, expect, it } from "vitest";
import { evictionMessage } from "../utils";

describe("evictionMessage", () => {
  it("names the group whose pin was replaced", () => {
    expect(evictionMessage({ id: "g1", name: "Night owls" })).toBe(
      'Unpinned "Night owls" to make room.',
    );
  });

  it("says nothing when no pin was replaced", () => {
    expect(evictionMessage(null)).toBeNull();
  });
});
