// MF-0023 SC-3: the Stop gate's spawn decision per platform. Node will not spawn the `.cmd` shims
// (pnpm, biome, vitest) on Windows without a shell, and a shell joins args unquoted; macOS/Linux
// must keep the direct spawn in its own process group so a timeout can kill the whole tree.
import { describe, expect, it } from "vitest";
import { spawnSpec } from "../../../.claude/hooks/lib/gate-core.mjs";

describe("MF-0023 spawnSpec", () => {
  it.each([
    "linux",
    "darwin",
  ])("SC-3: on %s spawns the command directly, args as an array, in its own group", (platform) => {
    expect(
      spawnSpec({
        cmd: "vitest",
        args: ["run", "src/app/(app)/groups/[groupId]/page.tsx", "a b"],
        platform,
      }),
    ).toEqual({
      command: "vitest",
      args: ["run", "src/app/(app)/groups/[groupId]/page.tsx", "a b"],
      shell: false,
      detached: true,
    });
  });

  it("SC-3: on win32 builds one command line for the shell, no detached group", () => {
    expect(
      spawnSpec({ cmd: "pnpm", args: ["run", "typecheck"], platform: "win32" }),
    ).toEqual({
      command: "pnpm run typecheck",
      args: [],
      shell: true,
      detached: false,
    });
  });

  it.each([
    ["a b", '"a b"'],
    ["src/app/(app)/page.tsx", '"src/app/(app)/page.tsx"'],
    ["x&y", '"x&y"'],
    ["x|y", '"x|y"'],
    ["x<y", '"x<y"'],
    ["x>y", '"x>y"'],
    ["x^y", '"x^y"'],
    ['say"hi', '"say\\"hi"'],
  ])("SC-3: on win32 quotes %s as %s", (arg, quoted) => {
    expect(
      spawnSpec({ cmd: "biome", args: ["lint", arg], platform: "win32" })
        .command,
    ).toBe(`biome lint ${quoted}`);
  });

  it("SC-3: on win32 leaves a plain argument bare", () => {
    expect(
      spawnSpec({
        cmd: "vitest",
        args: ["--outputFile=C:\\Temp\\r.json", "src/engine/x.ts"],
        platform: "win32",
      }).command,
    ).toBe("vitest --outputFile=C:\\Temp\\r.json src/engine/x.ts");
  });
});
