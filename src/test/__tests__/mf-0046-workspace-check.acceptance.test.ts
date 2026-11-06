/**
 * MF-0046 acceptance (frozen): `pnpm gate:workspace` (scripts/check-workspace.mjs) fails on pnpm's
 * `allowBuilds` placeholder and on any `allowBuilds` value that is not literally true or false, and fails closed
 * on shapes it cannot read. Runs the real script over fixture files (`MF_WORKSPACE_FILE`). Expected values come
 * from GOAL.md SC-1…SC-5, never from the checker. Proof case: merge 71ac090 (MF-0019 retro).
 */
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { isRelevantSource } from "../../../.claude/hooks/lib/gate-core.mjs";

const ROOT = resolve(__dirname, "../../..");
const SCRIPT = join(ROOT, "scripts/check-workspace.mjs");
const dir = mkdtempSync(join(tmpdir(), "mf0046-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

let n = 0;
function workspace(text: string): string {
  const path = join(dir, `pnpm-workspace-${n++}.yaml`);
  writeFileSync(path, text);
  return path;
}

function run(file?: string) {
  return spawnSync(process.execPath, [SCRIPT], {
    cwd: ROOT,
    env: { ...process.env, MF_WORKSPACE_FILE: file ?? "" },
    encoding: "utf8",
  });
}

const allowBuilds = (...lines: string[]): string =>
  `packages:\n  - .\nallowBuilds:\n${lines.join("\n")}\nminimumReleaseAgeExclude:\n  - next@16.4.4\n`;

describe("MF-0046 gate:workspace", () => {
  it("SC-1: the allowBuilds placeholder fails, naming the package and the file", () => {
    const file = workspace(
      allowBuilds("  supabase: true", "  esbuild: set this to true or false"),
    );
    const result = run(file);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("esbuild");
    expect(result.stderr).toContain(file);
  });

  it("SC-2: fails closed on non-boolean values, flow style, unreadable lines and a stray placeholder; a valid file passes", () => {
    const bad: [string, string][] = [
      [allowBuilds("  esbuild: yes"), "esbuild"],
      [allowBuilds('  esbuild: "true"'), "esbuild"],
      [allowBuilds("  esbuild:"), "esbuild"],
      ["allowBuilds: { esbuild: true }\n", "allowBuilds"],
      [allowBuilds("  esbuild:", "    nested: true"), "esbuild"],
      [allowBuilds("\tesbuild: true"), "allowBuilds"],
      [
        `${allowBuilds("  esbuild: false")}# pnpm: set this to true or false\n`,
        "set this to true or false",
      ],
    ];
    for (const [text, named] of bad) {
      const result = run(workspace(text));
      expect(result.status, text).toBe(1);
      expect(result.stderr, text).toContain(named);
    }

    expect(run(join(dir, "does-not-exist.yaml")).status).toBe(1);

    const valid = workspace(
      allowBuilds(
        "  supabase: true    # postinstall downloads the CLI",
        "",
        "  # a comment line",
        "  sharp: false",
        "  '@scope/pkg': true",
        '  "unrs-resolver": false',
      ),
    );
    const ok = run(valid);
    expect(ok.status).toBe(0);
    expect(ok.stdout).toContain("gate:workspace: 4 allowBuilds entries, ok");
  });

  it("SC-3: proof case 71ac090 fails; this repo's pnpm-workspace.yaml passes", () => {
    const proof = workspace(
      execFileSync("git", ["show", "71ac090:pnpm-workspace.yaml"], {
        cwd: ROOT,
        encoding: "utf8",
      }),
    );
    const red = run(proof);
    expect(red.status).toBe(1);
    expect(red.stderr).toContain("esbuild");

    const current = run();
    expect(current.status).toBe(0);
    expect(current.stdout).toMatch(
      /gate:workspace: [1-9]\d* allowBuilds entries, ok/,
    );
  });

  it("SC-5: pnpm-workspace.yaml is a relevant source for the Stop gate", () => {
    expect(isRelevantSource("pnpm-workspace.yaml")).toBe(true);
    expect(isRelevantSource("docs/notes.yaml")).toBe(false);
  });
});
