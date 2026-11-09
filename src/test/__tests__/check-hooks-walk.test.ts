/**
 * MF-0051 review B-1: `.claude/skills/brag-slim` is a tracked symlink to the untracked `.agents/`. On Linux CI it
 * dangles, and a walk that `stat`s it throws ENOENT. check-hooks must skip links (their targets live outside the
 * scanned tree) instead of crashing. A dangling junction stands in for the link on Windows.
 */
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../../..");
const roots: string[] = [];
afterAll(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});

describe("check-hooks walk", () => {
  it("skips a dangling symlinked skill instead of crashing", () => {
    const dir = mkdtempSync(join(tmpdir(), "mf0051-walk-"));
    roots.push(dir);
    mkdirSync(join(dir, ".claude/hooks"), { recursive: true });
    mkdirSync(join(dir, ".claude/skills"), { recursive: true });
    writeFileSync(join(dir, "package.json"), JSON.stringify({ scripts: {} }));
    writeFileSync(join(dir, ".claude/settings.json"), "{}");
    symlinkSync(
      join(dir, ".agents/skills/gone"),
      join(dir, ".claude/skills/gone"),
      "junction",
    );
    const r = spawnSync(
      process.execPath,
      [join(ROOT, "scripts/check-hooks.mjs")],
      {
        cwd: ROOT,
        env: { ...process.env, MF_CHECK_ROOT: dir },
        encoding: "utf8",
      },
    );
    expect(r.stderr).not.toContain("ENOENT");
    expect(r.status).toBe(0);
  });
});
