/**
 * MF-0061 acceptance (frozen; U-6, re-frozen for U-7): `pnpm check:packs` ranks each single-select, non-official key by
 * length among its options (1 = longest … 4 = shortest; ties share the better rank) and fails a pack where any rank
 * holds more than 40% of its questions ("pick the Nth longest" must not beat chance). Packs with fewer than 10 such
 * questions are skipped. Runs the real script over fixture packs. Expected values come from GOAL.md SC-9.
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

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "mf0061-share-"));
  roots.push(dir);
  return dir;
}

interface Spec {
  key: number;
  distractors: number[];
  origin?: "ai" | "official";
  select?: number;
}

/** One question: the key is option A with `key` chars, then distractors B, C, D. */
function question(id: string, spec: Spec): string {
  const lengths = [spec.key, ...spec.distractors];
  const opts = lengths
    .map((length, i) => {
      const letter = "ABCD"[i] ?? "A";
      const correct = i === 0 || (spec.select === 2 && i === 1);
      return `      - id: ${letter}\n        text: "${letter.toLowerCase().repeat(length)}"\n        correct: ${correct}\n        rationale: "Why."`;
    })
    .join("\n");
  const origin = spec.origin ?? "ai";
  const author = origin === "ai" ? "    author: a@example.test\n" : "";
  return `  - id: ${id}\n    origin: ${origin}\n${author}    stem: "A stem?"\n    select: ${spec.select ?? 1}\n    options:\n${opts}\n    source:\n      title: "Fixture"\n      url: "https://example.test/mf-0061"`;
}

/** A packs dir holding these packs, each with one S1.yaml. */
function packs(bySlug: Record<string, Spec[]>): string {
  const dir = tempDir();
  for (const [slug, specs] of Object.entries(bySlug))
    writePack(dir, slug, specs);
  return dir;
}

function writePack(dir: string, slug: string, specs: Spec[]): void {
  const qdir = join(dir, slug, "questions");
  mkdirSync(qdir, { recursive: true });
  const entries = specs.map((s, i) => question(`${slug}.S1.q${i + 1}`, s));
  writeFileSync(
    join(qdir, "S1.yaml"),
    `skill: S1\nquestions:\n${entries.join("\n")}\n`,
  );
}

const pack = (slug: string, specs: Spec[]): string => packs({ [slug]: specs });

function run(packsDir?: string) {
  const env = packsDir
    ? { ...process.env, MF_PACKS_DIR: packsDir, MF_PATHS_DIR: tempDir() }
    : { ...process.env, MF_PACKS_DIR: "", MF_PATHS_DIR: "" };
  return spawnSync(process.execPath, [SCRIPT], {
    cwd: ROOT,
    env,
    encoding: "utf8",
  });
}

/** The key (option A) at each length rank among four options; every pair stays under the 1.15× rule. */
const LONGEST: Spec = { key: 110, distractors: [100, 90, 80] };
const SECOND: Spec = { key: 95, distractors: [100, 90, 80] };
const THIRD: Spec = { key: 85, distractors: [100, 90, 80] };
const SHORTEST: Spec = { key: 75, distractors: [100, 90, 80] };
/** Tied with the longest distractor: shares the better rank, so it counts as "longest". */
const TIED_LONGEST: Spec = { key: 100, distractors: [100, 90, 80] };

const repeat = (spec: Spec, n: number): Spec[] =>
  Array.from({ length: n }, () => spec);
/** 10 questions with ranks spread 3/3/2/2 (30% max): passes. */
const SPREAD: Spec[] = [
  ...repeat(LONGEST, 3),
  ...repeat(SECOND, 3),
  ...repeat(THIRD, 2),
  ...repeat(SHORTEST, 2),
];

describe("MF-0061 key-rank rule in check:packs (U-7)", () => {
  it("SC-9: a pack with the key 2nd longest in 5 of 10 fails, naming pack, rank, count, share and limit", () => {
    const result = run(
      pack("fixture", [
        ...repeat(SECOND, 5),
        ...repeat(LONGEST, 2),
        ...repeat(THIRD, 2),
        SHORTEST,
      ]),
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "fixture: key-rank: key is the 2nd longest option in 5 of 10 single-select questions (50%, limit 40%)",
    );
  });

  it("SC-9: the shortest rank is checked too, and a tie with the longest distractor counts as longest", () => {
    const result = run(
      packs({
        short: [
          ...repeat(SHORTEST, 5),
          ...repeat(LONGEST, 2),
          ...repeat(SECOND, 2),
          THIRD,
        ],
        tied: [
          ...repeat(TIED_LONGEST, 5),
          ...repeat(SECOND, 2),
          ...repeat(THIRD, 2),
          SHORTEST,
        ],
      }),
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "short: key-rank: key is the shortest option in 5 of 10 single-select questions (50%, limit 40%)",
    );
    expect(result.stderr).toContain(
      "tied: key-rank: key is the longest option in 5 of 10 single-select questions (50%, limit 40%)",
    );
  });

  it("SC-9: exactly 40% passes; 9 of 22 (40.9%) fails and is never printed as the limit", () => {
    const atLimit = run(
      pack("fixture", [
        ...repeat(LONGEST, 4),
        ...repeat(SECOND, 3),
        ...repeat(THIRD, 3),
      ]),
    );
    expect(atLimit.stderr).not.toContain("key-rank");
    expect(atLimit.status).toBe(0);
    expect(atLimit.stdout).toContain(
      "key-rank: 1 pack(s) checked, 0 skipped (< 10 questions), 0 problem(s)",
    );

    const over = run(
      pack("fixture", [
        ...repeat(LONGEST, 9),
        ...repeat(SECOND, 5),
        ...repeat(THIRD, 4),
        ...repeat(SHORTEST, 4),
      ]),
    );
    expect(over.status).toBe(1);
    expect(over.stderr).toContain(
      "fixture: key-rank: key is the longest option in 9 of 22 single-select questions (41%, limit 40%)",
    );
  });

  it("SC-9: official and multi-select questions are outside the count; a pack under 10 questions is skipped", () => {
    const result = run(
      packs({
        mixed: [
          ...SPREAD,
          ...repeat({ ...LONGEST, origin: "official" }, 5),
          { key: 110, distractors: [110, 10, 10], select: 2 },
        ],
        small: repeat(LONGEST, 9),
      }),
    );
    expect(result.stderr).not.toContain("key-rank");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "key-rank: 1 pack(s) checked, 1 skipped (< 10 questions), 0 problem(s)",
    );
  });

  it("SC-9: no rank holds more than 40% in any shipped pack; check:packs exits 0 on this repo", () => {
    const result = run();
    expect(result.stderr).not.toContain("key-rank");
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(
      /key-rank: [1-9]\d* pack\(s\) checked, \d+ skipped \(< 10 questions\), 0 problem\(s\)/,
    );
  });
});
