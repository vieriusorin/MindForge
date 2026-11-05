import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { ManifestFile, toSeedManifest } from "../manifest";

const STORM = "6f1c0d3e-2b7a-4c55-9e1a-0a2b3c4d5e6f";

describe("toSeedManifest", () => {
  it("keeps a manifest written before MF-0052 valid, with no storm ids", () => {
    expect(
      toSeedManifest(
        { youEmail: "You@x.test", youId: "u1", youAttemptIds: [1, 2] },
        "you@x.test",
      ),
    ).toEqual({ youId: "u1", youAttemptIds: [1, 2] });
  });

  it("returns the storm ids an MF-0052 manifest recorded", () => {
    expect(
      toSeedManifest(
        {
          youEmail: "you@x.test",
          youId: "u1",
          youAttemptIds: [],
          youStormIds: [STORM],
        },
        "you@x.test",
      ),
    ).toEqual({ youId: "u1", youAttemptIds: [], youStormIds: [STORM] });
  });

  it("returns null for a manifest written for another email", () => {
    expect(
      toSeedManifest(
        { youEmail: "other@x.test", youId: "u1", youAttemptIds: [] },
        "you@x.test",
      ),
    ).toBeNull();
  });

  it("refuses an unknown key or a storm id that is not a uuid", () => {
    expect(() =>
      toSeedManifest(
        { youEmail: "you@x.test", youId: "u1", youAttemptIds: [], extra: 1 },
        "you@x.test",
      ),
    ).toThrow(ZodError);
    expect(
      ManifestFile.safeParse({
        youEmail: "you@x.test",
        youId: "u1",
        youAttemptIds: [],
        youStormIds: ["42"],
      }).success,
    ).toBe(false);
  });
});
