// MF-0013 (hook fix, approved 2026-11-04): the agent-scope hook turns tool paths into repo paths with
// `toRel`. On Windows a tool path is `C:\…`, which `startsWith("/")` did not treat as absolute, so
// every role agent's write resolved outside the project and was denied.
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ROOT, toRel } from "../../../.claude/hooks/lib/gate-io.mjs";

describe("gate-io toRel", () => {
  it("maps an absolute path inside the repo to a repo-relative POSIX path (any platform)", () => {
    expect(toRel(join(ROOT, "src", "engine", "storm", "types.ts"))).toBe(
      "src/engine/storm/types.ts",
    );
  });

  it("maps a relative path from the repo root", () => {
    expect(toRel("src/engine/storm/types.ts")).toBe(
      "src/engine/storm/types.ts",
    );
  });

  it("returns null outside the repo", () => {
    expect(toRel(resolve(ROOT, "..", "elsewhere.ts"))).toBeNull();
    expect(toRel("")).toBeNull();
  });
});
