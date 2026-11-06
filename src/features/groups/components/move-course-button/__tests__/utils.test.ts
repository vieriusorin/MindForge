import { describe, expect, it } from "vitest";
import { moveDialogCopy } from "../utils";

describe("moveDialogCopy", () => {
  it("names the next course and warns that a running expedition ends", () => {
    const copy = moveDialogCopy({
      nextCourseName: "Platform Foundations",
      hasRunningExpedition: true,
    });
    expect(copy.title).toBe("Move to Platform Foundations?");
    expect(copy.description).toContain("This ends the running expedition.");
  });

  it("says nothing about an expedition when none runs", () => {
    const copy = moveDialogCopy({
      nextCourseName: "Platform Foundations",
      hasRunningExpedition: false,
    });
    expect(copy.description).not.toContain("expedition");
  });
});
