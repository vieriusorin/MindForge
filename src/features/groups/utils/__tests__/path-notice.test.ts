import { describe, expect, it } from "vitest";
import { createNotice, joinNotice } from "../path-notice";

describe("joinNotice", () => {
  it("tells an invitee that joining starts the group's path (Q3 wording)", () => {
    expect(joinNotice("Claude Developer")).toBe(
      "This group follows the Claude Developer path. Joining starts it for you.",
    );
  });
});

describe("createNotice", () => {
  it("tells the creator that creating starts the path for them and joining for each member", () => {
    expect(createNotice("Claude Developer")).toBe(
      "This group follows the Claude Developer path. Creating it starts the path for you, and joining starts it for each member.",
    );
  });
});
