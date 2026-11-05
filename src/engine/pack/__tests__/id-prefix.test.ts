import { describe, expect, it } from "vitest";
import { idPrefixIssue } from "../id-prefix";

describe("idPrefixIssue", () => {
  it("accepts an id that starts with the slug and a dot", () => {
    expect(idPrefixIssue("tiny.S1.q1", "tiny")).toBeNull();
    expect(idPrefixIssue("a-b.D1.S1.q1", "a-b")).toBeNull();
  });

  it("refuses another pack's slug", () => {
    expect(idPrefixIssue("other.S1.q1", "tiny")).toBe(
      'id "other.S1.q1" must start with "tiny."',
    );
  });

  it("refuses a slug that only shares a prefix, either way round", () => {
    expect(idPrefixIssue("tiny-x.S1.q1", "tiny")).toBe(
      'id "tiny-x.S1.q1" must start with "tiny."',
    );
    expect(idPrefixIssue("tiny.S1.q1", "tiny-x")).toBe(
      'id "tiny.S1.q1" must start with "tiny-x."',
    );
  });

  it("refuses the bare slug with no dot", () => {
    expect(idPrefixIssue("tiny", "tiny")).toBe(
      'id "tiny" must start with "tiny."',
    );
  });
});
