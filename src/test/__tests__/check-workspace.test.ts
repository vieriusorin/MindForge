/**
 * MF-0046 review follow-ups (REVIEW.md): shapes of pnpm-workspace.yaml that the frozen acceptance test does not
 * cover. Each expected result is what YAML (and so pnpm) reads, checked with yaml@2.9.1 in the review.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const SCRIPT = join(
  resolve(__dirname, "../../.."),
  "scripts/check-workspace.mjs",
);
const dir = mkdtempSync(join(tmpdir(), "mf0046-review-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

let n = 0;
function check(text: string) {
  const path = join(dir, `ws-${n++}.yaml`);
  writeFileSync(path, text);
  return spawnSync(process.execPath, [SCRIPT], {
    env: { ...process.env, MF_WORKSPACE_FILE: path },
    encoding: "utf8",
  });
}

describe("check-workspace review follow-ups", () => {
  it("B1: a # with no space before it is part of the value, not a comment", () => {
    const result = check("allowBuilds:\n  esbuild: true#x\n");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("esbuild");
  });

  it("B2: finds the block behind a BOM or a quoted key, never reads it as none found", () => {
    for (const text of [
      "\uFEFFallowBuilds:\n  esbuild: yes\n",
      '"allowBuilds":\n  esbuild: yes\n',
      "'allowBuilds':\n  esbuild: yes\n",
    ]) {
      const result = check(text);
      expect(result.status, text).toBe(1);
      expect(result.stderr, text).toContain("esbuild");
    }
  });

  it("B2: any other top-level line naming allowBuilds fails closed", () => {
    const result = check("? allowBuilds\n: { esbuild: yes }\n");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("allowBuilds");
  });

  it("B3: a second allowBuilds block and a document marker fail", () => {
    const duplicate = check(
      "allowBuilds:\n  esbuild: true\npackages:\n  - .\nallowBuilds:\n  sharp: yes\n",
    );
    expect(duplicate.status).toBe(1);
    expect(duplicate.stderr).toContain("allowBuilds");
    const documents = check("allowBuilds:\n---\n  esbuild: yes\n");
    expect(documents.status).toBe(1);
    expect(documents.stderr).toContain("---");
  });

  it("minor: a consistent four-space indent is valid; a deeper line under an entry is not", () => {
    const four = check("allowBuilds:\n    esbuild: true\n    sharp: false\n");
    expect(four.status).toBe(0);
    expect(four.stdout).toContain("gate:workspace: 2 allowBuilds entries, ok");
    const mixed = check("allowBuilds:\n  esbuild: true\n    sharp: false\n");
    expect(mixed.status).toBe(1);
    expect(mixed.stderr).toContain("sharp");
  });

  it("R2-B1: a list at column 0 under the header is not a map", () => {
    const result = check("allowBuilds:\n- esbuild\n");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("allowBuilds");
  });

  it("R2-B2: allowBuilds reached any other way fails closed (JSON style, complex key, merge key, escaped key)", () => {
    for (const text of [
      '{\n  "packages": ["."],\n  "allowBuilds": {"esbuild": "yes"}\n}\n',
      "?\n  allowBuilds\n:\n  esbuild: maybe\n",
      "x: &x\n  allowBuilds:\n    esbuild: maybe\n<<: *x\n",
      '"allow\\u0042uilds":\n  esbuild: maybe\n',
    ]) {
      expect(check(text).status, text).toBe(1);
    }
    const commented = check(
      "packages: # allowBuilds is below\n  - .\nallowBuilds:\n  esbuild: true\n",
    );
    expect(commented.status).toBe(0);
  });

  it("R2-B3: a package named twice fails", () => {
    const result = check("allowBuilds:\n  esbuild: true\n  esbuild: false\n");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("esbuild");
  });

  it("R2-B4: a bare name starting with @ is not valid YAML", () => {
    const result = check("allowBuilds:\n  @swc/core: true\n");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("@swc/core");
  });

  it("minor: a trailing U+FEFF is part of the value", () => {
    const result = check("allowBuilds:\n  esbuild: true\uFEFF\n");
    expect(result.status).toBe(1);
  });

  it("R3-B1: anything outside the supported line shapes fails (anchored, tagged, indented or explicit-key roots; escaped keys; duplicate top-level keys)", () => {
    // Backslash built at runtime: these fixtures need a literal `B` escape inside the YAML text.
    const esc = `${String.fromCharCode(92)}u0042`;
    const fold = `${String.fromCharCode(92)}\n`;
    for (const text of [
      '&a {"x #": 1, allowBuilds: {esbuild: maybe}}\n',
      '!!map {"x #": 1, allowBuilds: {esbuild: maybe}}\n',
      ' {"x #": 1, allowBuilds: {esbuild: maybe}}\n',
      ` {? "allow${esc}uilds"\n : {esbuild: maybe}}\n`,
      ` ? "allow${esc}uilds"\n : {esbuild: maybe}\n`,
      ` ? "allow${fold}   Builds"\n : {esbuild: maybe}\n`,
      '&a {\n  "x #": 1, allowBuilds: {esbuild: maybe}}\n',
      `!!map\n? "allow${esc}uilds"\n: {esbuild: maybe}\n`,
      `!!map {"allow${esc}uilds" : {esbuild: maybe}}\n`,
      `&a {"allow${esc}uilds"\n : {esbuild: maybe}}\n`,
      "packages:\n  - .\npackages:\n  - b\nallowBuilds:\n  esbuild: true\n",
    ]) {
      expect(check(text).status, text).toBe(1);
    }
  });

  it("R3: the supported shapes pass (one-level maps and lists under other keys, quoted items)", () => {
    const result = check(
      "packages:\n  - .\n  - 'apps/*'\ncatalog:\n  react: ^19.0.0\n  '@types/node': 24.0.0\nnodeLinker: isolated\nallowBuilds:\n  esbuild: false\nminimumReleaseAgeExclude:\n  - '@next/env@16.4.4' # pinned\n  - next@16.4.4\n",
    );
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
  });

  it("nit: a directory path is a named problem, not a stack trace", () => {
    const path = join(dir, "a-directory");
    mkdirSync(path);
    const result = spawnSync(process.execPath, [SCRIPT], {
      env: { ...process.env, MF_WORKSPACE_FILE: path },
      encoding: "utf8",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("cannot read");
    expect(result.stderr).not.toContain("    at ");
  });
});
