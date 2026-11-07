/**
 * MF-0068 acceptance (frozen) SC-9: the runbook names every new demo account and both path groups, so a
 * reviewer can sign in as the state they want without reading the seed.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RUNBOOK = join(process.cwd(), "docs", "runbook", "dev-seed.md");

describe("MF-0068 runbook", () => {
  it("SC-9: every path persona's account and both path groups are listed", async () => {
    const text = await readFile(RUNBOOK, "utf8");
    for (const persona of [
      "fresh",
      "halfway",
      "midpath",
      "finisher",
      "lapsed-path",
      "crammer-path",
    ])
      expect(text).toContain(`${persona}@mindforge-demo.test`);
    expect(text).toContain("Demo path group · Claude Developer");
    expect(text).toContain("Demo path trio · Claude Developer");
  });
});
