/**
 * MF-0065 acceptance (SC-8, script part) — frozen. `pnpm check:packs` validates every pack's optional
 * `misconceptions.yaml` (GOAL DQ-7), corpus-free so CI runs it, prints a `misconceptions:` summary and exits
 * 1 naming the file on a broken tag. Runs the real script over fixture packs (`MF_PACKS_DIR`, with an empty
 * `MF_PATHS_DIR`), as mf-0044 does, and once over the shipped packs.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../../..");
const SCRIPT = join(ROOT, "scripts/check-pack-grounding.mjs");

const roots: string[] = [];
afterAll(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});

const PACK_YAML = `slug: fx
name: Fixture
kind: course
version: 1
domains:
  - code: D1
    name: Domain
    weight: 100
    skills:
      - code: D1.S1
        name: Skill one
        weight: 50
      - code: D1.S2
        name: Skill two
        weight: 50
`;

// Equal-length options, so the key-length rule has nothing to say.
const QUESTIONS = `skill: D1.S1
questions:
  - id: fx.D1.S1.q1
    origin: ai
    author: author@example.com
    stem: "A stem?"
    select: 1
    options:
      - id: A
        text: "aaaaaaaaaa"
        correct: true
        rationale: "Why A."
      - id: B
        text: "bbbbbbbbbb"
        correct: false
        rationale: "Why B."
      - id: C
        text: "cccccccccc"
        correct: false
        rationale: "Why C."
    source:
      title: "Fixture"
      url: "https://example.test/mf-0065"
`;

const misconceptions = (tags: string): string => `misconceptions:
  - id: mixes-skill-two
    label: "Thinks skill two applies here"
    skill: D1.S2
tags:
  fx.D1.S1.q1:
${tags}
`;

function packsDir(misconceptionsYaml: string | null): string {
  const dir = mkdtempSync(join(tmpdir(), "mf0065-"));
  roots.push(dir);
  mkdirSync(join(dir, "fx", "questions"), { recursive: true });
  writeFileSync(join(dir, "fx", "pack.yaml"), PACK_YAML);
  writeFileSync(join(dir, "fx", "questions", "D1.S1.yaml"), QUESTIONS);
  if (misconceptionsYaml !== null)
    writeFileSync(join(dir, "fx", "misconceptions.yaml"), misconceptionsYaml);
  return dir;
}

function run(packs: string | null) {
  const paths = mkdtempSync(join(tmpdir(), "mf0065-paths-"));
  roots.push(paths);
  return spawnSync(process.execPath, [SCRIPT], {
    cwd: ROOT,
    env: {
      ...process.env,
      MF_PACKS_DIR: packs ?? "",
      MF_PATHS_DIR: packs === null ? "" : paths,
    },
    encoding: "utf8",
  });
}

describe("MF-0065 SC-8: check:packs validates misconception tags", () => {
  it("SC-8: a valid file passes and is counted", () => {
    const result = run(packsDir(misconceptions("    B: mixes-skill-two")));
    expect(result.stderr).not.toContain("misconceptions.yaml");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "misconceptions: 1 file(s), 1 tag(s), 0 problem(s)",
    );
  });

  it("SC-8: a pack without the file is fine (the file is optional)", () => {
    const result = run(packsDir(null));
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "misconceptions: 0 file(s), 0 tag(s), 0 problem(s)",
    );
  });

  it("SC-8: a tag on the correct option fails, naming the file", () => {
    const result = run(packsDir(misconceptions("    A: mixes-skill-two")));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("fx/misconceptions.yaml");
    expect(result.stderr).toMatch(/option "A" .*is correct/);
    expect(result.stdout).toContain(
      "misconceptions: 1 file(s), 1 tag(s), 1 problem(s)",
    );
  });

  it("SC-8: a tag naming an undeclared misconception fails", () => {
    const result = run(packsDir(misconceptions("    B: no-such-thing")));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('undeclared misconception "no-such-thing"');
  });

  it("SC-8: the shipped packs pass, with at least one tagged pack", () => {
    const result = run(null);
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(
      /misconceptions: [1-9]\d* file\(s\), [1-9]\d* tag\(s\), 0 problem\(s\)/,
    );
  });
});
