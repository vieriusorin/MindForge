/**
 * MF-0061 acceptance (frozen): the three packs MF-0044 grandfathered are length-checked, `origin: official` items
 * (verbatim Exam Guide copies, CONTEXT.md) are structure-checked but not length-checked, and the 68 rewritten
 * questions keep their keys. Runs the real script, as mf-0044 does. Expected values come from GOAL.md SC-1…SC-4.
 */
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import YAML from "yaml";

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

/** One question entry with options of exact character lengths; `origin: official` carries no author. */
function question(id: string, origin: "ai" | "official", options: Option[]) {
  const opts = options
    .map(
      (o) =>
        `      - id: ${o.id}\n        text: "${o.id.toLowerCase().repeat(o.length)}"\n        correct: ${o.correct}\n        rationale: "Why."`,
    )
    .join("\n");
  const author = origin === "ai" ? "    author: a@example.test\n" : "";
  return `  - id: ${id}\n    origin: ${origin}\n${author}    stem: "A stem?"\n    select: 1\n    options:\n${opts}\n    source:\n      title: "Fixture"\n      url: "https://example.test/mf-0061"`;
}

/** A 120-char key against distractors of 100, 90 and 80 chars (1.20×). */
const keyed = (id: string, origin: "ai" | "official") =>
  question(id, origin, [
    { id: "A", length: 120, correct: true },
    { id: "B", length: 100, correct: false },
    { id: "C", length: 90, correct: false },
    { id: "D", length: 80, correct: false },
  ]);

const file = (...entries: string[]): string =>
  `skill: S1\nquestions:\n${entries.join("\n")}\n`;

/** A packs dir: { slug: { "S1.yaml": text } } under <slug>/questions/. */
function packs(files: Record<string, Record<string, string>>): string {
  const dir = mkdtempSync(join(tmpdir(), "mf0061-"));
  roots.push(dir);
  for (const [slug, byName] of Object.entries(files)) {
    const qdir = join(dir, slug, "questions");
    mkdirSync(qdir, { recursive: true });
    for (const [name, text] of Object.entries(byName))
      writeFileSync(join(qdir, name), text);
  }
  return dir;
}

/** Fixture runs get an empty paths dir: the shipped paths name packs a fixture does not hold (MF-0058). */
function run(packsDir?: string) {
  const env = packsDir
    ? { ...process.env, MF_PACKS_DIR: packsDir, MF_PATHS_DIR: packs({}) }
    : { ...process.env, MF_PACKS_DIR: "", MF_PATHS_DIR: "" };
  return spawnSync(process.execPath, [SCRIPT], {
    cwd: ROOT,
    env,
    encoding: "utf8",
  });
}

/** SC-4: the key of every question rewritten by MF-0061, recorded from the files at pickup (660f1c1). */
const KEYS: Record<string, string> = {
  "ccdv-f.D1.S1.q1": "C",
  "ccdv-f.D1.S1.q2": "A",
  "ccdv-f.D1.S2.q1": "D",
  "ccdv-f.D1.S3.q1": "D",
  "ccdv-f.D1.S3.q2": "B",
  "ccdv-f.D2.S1.q1": "C",
  "ccdv-f.D2.S1.q2": "A",
  "ccdv-f.D2.S2.q2": "D",
  "ccdv-f.D2.S3.q1": "C",
  "ccdv-f.D2.S3.q2": "A",
  "ccdv-f.D2.S4.q1": "C",
  "ccdv-f.D2.S4.q2": "B",
  "ccdv-f.D2.S5.q1": "B",
  "ccdv-f.D2.S5.q2": "D",
  "ccdv-f.D2.S6.q2": "D",
  "ccdv-f.D4.S1.q1": "C",
  "ccdv-f.D4.S1.q2": "D",
  "ccdv-f.D5.S1.q1": "B",
  "ccdv-f.D5.S1.q2": "C",
  "ccdv-f.D5.S2.q1": "A",
  "ccdv-f.D5.S2.q2": "C",
  "ccdv-f.D5.S3.q1": "D",
  "ccdv-f.D5.S3.q2": "B",
  "ccdv-f.D5.S4.q1": "A",
  "ccdv-f.D6.S1.q1": "C",
  "ccdv-f.D6.S1.q2": "A",
  "ccdv-f.D6.S2.q1": "D",
  "ccdv-f.D6.S3.q2": "A",
  "ccdv-f.D7.S1.q1": "C",
  "ccdv-f.D7.S1.q2": "D",
  "ccdv-f.D7.S2.q1": "B",
  "ccdv-f.D7.S3.q1": "B",
  "ccdv-f.D7.S4.q1": "D",
  "ccdv-f.D8.S1.q1": "C",
  "ccdv-f.D8.S2.q1": "B",
  "ccdv-f.D8.S2.q2": "D",
  "ccdv-f.D8.S3.q1": "A",
  "ccdv-f.D8.S3.q2": "C",
  "prod-prompting.D1.S1.q2": "D",
  "prod-prompting.D1.S1.q3": "A",
  "prod-prompting.D1.S1.q4": "C",
  "prod-prompting.D1.S1.q5": "D",
  "prod-prompting.D1.S1.q6": "A",
  "prod-prompting.D1.S2.q2": "A",
  "prod-prompting.D1.S2.q3": "D",
  "prod-prompting.D1.S2.q4": "B",
  "prod-prompting.D1.S2.q5": "C",
  "prod-prompting.D1.S2.q6": "B",
  "prod-prompting.D1.S3.q1": "A",
  "prod-prompting.D1.S3.q2": "C",
  "prod-prompting.D1.S3.q3": "B",
  "prod-prompting.D1.S3.q4": "D",
  "prod-prompting.D1.S3.q5": "B",
  "prod-prompting.D2.S1.q2": "D",
  "prod-prompting.D2.S1.q3": "A",
  "prod-prompting.D2.S1.q5": "C",
  "prod-prompting.D2.S1.q6": "A",
  "prod-prompting.D2.S2.q1": "C",
  "prod-prompting.D2.S2.q3": "D",
  "prod-prompting.D2.S3.q6": "B",
  "prod-prompting.D3.S2.q1": "C",
  "prod-prompting.D3.S2.q2": "A",
  "prod-prompting.D3.S2.q5": "B",
  "prod-prompting.D3.S3.q1": "A",
  "prod-prompting.D3.S3.q4": "D",
  "prod-prompting.D3.S3.q5": "C",
  "platform-foundations.D1.S1.q4": "C",
  "platform-foundations.D4.S1.q2": "D",
};

const RETROFITTED = ["ccdv-f", "prod-prompting", "platform-foundations"];

interface ShippedOption {
  id: string;
  text: string;
  correct: boolean;
}
interface ShippedQuestion {
  id: string;
  select: number;
  options: ShippedOption[];
}

function shippedQuestions(): Map<string, ShippedQuestion> {
  const byId = new Map<string, ShippedQuestion>();
  for (const pack of RETROFITTED) {
    const dir = join(ROOT, "packs", pack, "questions");
    for (const name of readdirSync(dir)) {
      if (!name.endsWith(".yaml")) continue;
      const doc = YAML.parse(readFileSync(join(dir, name), "utf8")) as {
        questions: ShippedQuestion[];
      };
      for (const q of doc.questions) byId.set(q.id, q);
    }
  }
  return byId;
}

describe("MF-0061 key-length retrofit", () => {
  it("SC-1: a 1.20× ai key in a pack MF-0044 grandfathered now fails, naming the id", () => {
    const result = run(
      packs(
        Object.fromEntries(
          RETROFITTED.map((slug) => [
            slug,
            { "S1.yaml": file(keyed(`${slug}.S1.q1`, "ai")) },
          ]),
        ),
      ),
    );
    expect(result.status).toBe(1);
    for (const slug of RETROFITTED)
      expect(result.stderr).toContain(
        `${slug}.S1.q1: key is 120 chars, longest distractor 100 (1.20×, limit 1.15×)`,
      );
  });

  it("SC-2: an official key is not length-checked and is counted; a malformed official question still fails", () => {
    const skipped = run(
      packs({
        fixture: { "S1.yaml": file(keyed("fixture.S1.q1", "official")) },
      }),
    );
    expect(skipped.status).toBe(0);
    expect(skipped.stderr).not.toContain("fixture.S1.q1");
    expect(skipped.stdout).toContain(
      "key-length: 0 checked, 0 problem(s), 1 skipped (official), 0 multi-select not checked",
    );

    const twoKeys = question("fixture.S1.q2", "official", [
      { id: "A", length: 50, correct: true },
      { id: "B", length: 50, correct: true },
      { id: "C", length: 50, correct: false },
    ]);
    const malformed = run(packs({ fixture: { "S1.yaml": file(twoKeys) } }));
    expect(malformed.status).toBe(1);
    expect(malformed.stderr).toContain(
      "fixture.S1.q2: select: 1 needs exactly one correct option, found 2",
    );
  });

  it("SC-3: check:packs exits 0 on this repo with the three official samples skipped", () => {
    const result = run();
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(
      /key-length: [1-9]\d* checked, 0 problem\(s\), 3 skipped \(official\), 5 multi-select not checked/,
    );
  });

  it("SC-4: the 68 rewritten questions keep their key, ≤ 4 distinct options A–D, select 1", () => {
    const shipped = shippedQuestions();
    expect(Object.keys(KEYS)).toHaveLength(68);
    for (const [id, key] of Object.entries(KEYS)) {
      const q = shipped.get(id);
      expect(q, id).toBeDefined();
      if (!q) continue;
      expect(q.select, id).toBe(1);
      expect(q.options.length, id).toBeLessThanOrEqual(4);
      expect(
        q.options.every((o) => ["A", "B", "C", "D"].includes(o.id)),
        id,
      ).toBe(true);
      expect(
        q.options.filter((o) => o.correct).map((o) => o.id),
        id,
      ).toEqual([key]);
      expect(
        new Set(q.options.map((o) => o.text.trim().toLowerCase())).size,
        id,
      ).toBe(q.options.length);
    }
  });
});
