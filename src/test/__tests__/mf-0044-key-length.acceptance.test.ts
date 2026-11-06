/**
 * MF-0044 acceptance (frozen): `pnpm check:packs` fails a `select: 1` question whose key is at least 1.15× its
 * longest distractor in characters, skips the grandfathered packs, and fails closed on questions it cannot read.
 * Runs the real script over fixture packs (`MF_PACKS_DIR`), as mf-0041 SC-5 does. Expected values come from
 * GOAL.md SC-1…SC-6, never from the checker.
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

interface Option {
  id: string;
  length: number;
  correct: boolean;
}

/** One question YAML entry with options of exact character lengths. */
function question(id: string, options: Option[], select = 1): string {
  const opts = options
    .map(
      (o) =>
        `      - id: ${o.id}\n        text: "${o.id.toLowerCase().repeat(o.length)}"\n        correct: ${o.correct}\n        rationale: "Why."`,
    )
    .join("\n");
  return `  - id: ${id}\n    origin: ai\n    level: foundation\n    stem: "A stem?"\n    select: ${select}\n    options:\n${opts}\n    source:\n      title: "Fixture"\n      url: "https://example.test/mf-0044"`;
}

/** key of `key` chars against distractors of 100, 90 and 80 chars. */
const keyed = (id: string, key: number): string =>
  question(id, [
    { id: "A", length: key, correct: true },
    { id: "B", length: 100, correct: false },
    { id: "C", length: 90, correct: false },
    { id: "D", length: 80, correct: false },
  ]);

/** A packs dir: { slug: { "S1.yaml": text } } under <slug>/questions/. */
function packs(files: Record<string, Record<string, string>>): string {
  const dir = mkdtempSync(join(tmpdir(), "mf0044-"));
  roots.push(dir);
  for (const [slug, byName] of Object.entries(files)) {
    const qdir = join(dir, slug, "questions");
    mkdirSync(qdir, { recursive: true });
    for (const [name, text] of Object.entries(byName))
      writeFileSync(join(qdir, name), text);
  }
  return dir;
}

const file = (...entries: string[]): string =>
  `skill: S1\nquestions:\n${entries.join("\n")}\n`;

function run(packsDir?: string) {
  return spawnSync(process.execPath, [SCRIPT], {
    cwd: ROOT,
    env: packsDir
      ? { ...process.env, MF_PACKS_DIR: packsDir }
      : { ...process.env, MF_PACKS_DIR: "" },
    encoding: "utf8",
  });
}

describe("MF-0044 key-length rule in check:packs", () => {
  it("SC-1: a key 1.20× its longest distractor fails, naming the id and both lengths", () => {
    const result = run(
      packs({ fixture: { "S1.yaml": file(keyed("fixture.S1.q1", 120)) } }),
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "fixture.S1.q1: key is 120 chars, longest distractor 100 (1.20×, limit 1.15×)",
    );
  });

  it("SC-2: 1.10× passes and exactly 1.15× fails", () => {
    const passing = run(
      packs({ fixture: { "S1.yaml": file(keyed("fixture.S1.q1", 110)) } }),
    );
    expect(passing.stderr).not.toContain("fixture.S1.q1");
    expect(passing.stdout).toContain("key-length: 1 checked, 0 problem(s)");

    const boundary = run(
      packs({ fixture: { "S1.yaml": file(keyed("fixture.S1.q2", 115)) } }),
    );
    expect(boundary.status).toBe(1);
    expect(boundary.stderr).toContain(
      "fixture.S1.q2: key is 115 chars, longest distractor 100 (1.15×, limit 1.15×)",
    );
  });

  it("SC-3: a grandfathered pack is skipped and counted in the summary", () => {
    const result = run(
      packs({
        "prod-prompting": {
          "S1.yaml": file(keyed("prod-prompting.S1.q1", 150)),
        },
      }),
    );
    expect(result.stderr).not.toContain("prod-prompting.S1.q1");
    expect(result.stdout).toContain(
      "key-length: 0 checked, 0 problem(s), 1 skipped (grandfathered), 0 multi-select not checked",
    );
  });

  it("SC-4: fails closed on unreadable YAML and on a select: 1 question without exactly one key; select: 2 is counted, not checked", () => {
    const twoKeys = question("fixture.S1.q2", [
      { id: "A", length: 50, correct: true },
      { id: "B", length: 50, correct: true },
      { id: "C", length: 50, correct: false },
    ]);
    const noKey = question("fixture.S1.q3", [
      { id: "A", length: 50, correct: false },
      { id: "B", length: 50, correct: false },
    ]);
    const multi = question(
      "fixture.S1.q4",
      [
        { id: "A", length: 300, correct: true },
        { id: "B", length: 300, correct: true },
        { id: "C", length: 10, correct: false },
      ],
      2,
    );
    const result = run(
      packs({
        fixture: {
          "S1.yaml": file(twoKeys, noKey, multi),
          "S2.yaml": "skill: S2\nquestions:\n  - id: [unclosed\n",
        },
      }),
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "fixture.S1.q2: select: 1 needs exactly one correct option, found 2",
    );
    expect(result.stderr).toContain(
      "fixture.S1.q3: select: 1 needs exactly one correct option, found 0",
    );
    expect(result.stderr).not.toContain("fixture.S1.q4");
    expect(result.stderr).toMatch(/S2\.yaml: key-length: cannot parse YAML/);
    expect(result.stdout).toContain("1 multi-select not checked");
  });

  it("SC-6: every shipped pack outside the grandfather set passes; check:packs exits 0 on this repo", () => {
    const result = run();
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(
      /key-length: [1-9]\d* checked, 0 problem\(s\), [1-9]\d* skipped \(grandfathered\)/,
    );
  });
});
