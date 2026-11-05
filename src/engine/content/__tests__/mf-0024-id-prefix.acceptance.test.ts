// MF-0024 acceptance (frozen): an item id belongs to the pack whose slug it starts with.
// SC-1 parseContent, SC-2 parseQuestionFiles, SC-4 every shipped pack still validates (regression lock,
// frozen green: the probe on 2026-11-05 found 0 mismatches in 504 items).
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { loadPackFile } from "../../pack/load-pack";
import type { Pack } from "../../pack/types";
import { parseQuestionFiles } from "../../questions/load-questions";
import { loadPackContent, parseContent, readPackFiles } from "../load-content";
import type { ContentFiles } from "../types";

const PACKS = join(process.cwd(), "packs");
const DIR = join(PACKS, "ccdv-f");
const KINDS = ["questions", "cards", "diagrams", "cuckoos"] as const;

let pack: Pack;
let real: ContentFiles;
beforeAll(async () => {
  pack = await loadPackFile(join(DIR, "pack.yaml"));
  real = await readPackFiles(DIR);
});

/** The issues `fn` throws; fails the test if it does not throw one. */
function issuesOf(fn: () => unknown): readonly string[] {
  try {
    fn();
  } catch (error) {
    const issues = (error as { issues?: readonly string[] }).issues;
    expect(issues, String(error)).toBeDefined();
    return issues ?? [];
  }
  throw new Error("expected a validation error, nothing was thrown");
}

/** Re-prefix the first item id of the first file of `kind` with another pack's slug. */
function withForeignId(kind: (typeof KINDS)[number]): {
  files: ContentFiles;
  name: string;
  id: string;
} {
  const list = real[kind] ?? [];
  const first = list[0];
  if (!first) throw new Error(`fixture: ccdv-f has no ${kind}`);
  const match = first.text.match(/\bid: ccdv-f\.([A-Za-z0-9.]+\.[a-z0-9-]+)/);
  if (!match) throw new Error(`fixture: no item id in ${first.name}`);
  const id = `other-pack.${match[1]}`;
  const text = first.text.replace(match[0], `id: ${id}`);
  return {
    files: { ...real, [kind]: [{ ...first, text }, ...list.slice(1)] },
    name: first.name,
    id,
  };
}

describe("MF-0024 id prefix", () => {
  it("SC-1: unchanged ccdv-f content parses", () => {
    expect(() => parseContent(real, pack)).not.toThrow();
  });

  for (const kind of KINDS) {
    it(`SC-1: parseContent refuses a ${kind} id that starts with another pack's slug`, () => {
      const { files, name, id } = withForeignId(kind);
      const issues = issuesOf(() => parseContent(files, pack));
      expect(issues).toContain(
        `${name}: ${kind}.0.id: id "${id}" must start with "ccdv-f."`,
      );
    });
  }

  it("SC-1: a slug that only shares a prefix is still another pack (ccdv-f-x.… in ccdv-f)", () => {
    const first = real.questions[0];
    if (!first) throw new Error("fixture: no questions");
    const match = first.text.match(/\bid: ccdv-f\.([A-Za-z0-9.]+\.[a-z0-9-]+)/);
    if (!match) throw new Error("fixture: no question id");
    const id = `ccdv-f-x.${match[1]}`;
    const files: ContentFiles = {
      ...real,
      questions: [
        { ...first, text: first.text.replace(match[0], `id: ${id}`) },
        ...real.questions.slice(1),
      ],
    };
    expect(issuesOf(() => parseContent(files, pack))).toContain(
      `${first.name}: questions.0.id: id "${id}" must start with "ccdv-f."`,
    );
  });

  it("SC-2: parseQuestionFiles refuses the same foreign id with the same message", () => {
    const { files, name, id } = withForeignId("questions");
    const issues = issuesOf(() => parseQuestionFiles(files.questions, pack));
    expect(issues).toContain(
      `${name}: questions.0.id: id "${id}" must start with "ccdv-f."`,
    );
    expect(() => parseQuestionFiles(real.questions, pack)).not.toThrow();
  });

  it("SC-4: every shipped pack still validates, and its folder is its slug", async () => {
    const slugs = readdirSync(PACKS, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
    expect(slugs.length).toBeGreaterThanOrEqual(8);
    let items = 0;
    for (const slug of slugs) {
      const p = await loadPackFile(join(PACKS, slug, "pack.yaml"));
      expect(p.slug).toBe(slug);
      const c = await loadPackContent(p, join(PACKS, slug));
      items +=
        c.questions.length +
        c.cards.length +
        c.diagrams.length +
        c.cuckoos.length;
    }
    expect(items).toBeGreaterThanOrEqual(504);
  });
});
