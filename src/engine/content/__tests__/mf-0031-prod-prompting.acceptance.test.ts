import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import YAML from "yaml";
import { loadPackFile, parsePack } from "../../pack/load-pack";
import { loadPackContent, parseContent } from "../load-content";
import type { ContentFile } from "../types";

// MF-0031: the "Production-Grade Prompting, Agents & Tool use" course pack.
// Expected values are literals from GOAL.md (Blueprint + SC-1…SC-6), never computed by the code under test.

const PACK_DIR = join(process.cwd(), "packs", "prod-prompting");
const AUTHOR = "sorin.vieriu@ddroidd.com";
const LEVELS = ["foundation", "practitioner", "expert"];

const BLUEPRINT = [
  {
    code: "D1",
    weight: 34,
    skills: [
      ["D1.S1", 12],
      ["D1.S2", 11],
      ["D1.S3", 11],
    ],
  },
  {
    code: "D2",
    weight: 36,
    skills: [
      ["D2.S1", 12],
      ["D2.S2", 12],
      ["D2.S3", 12],
    ],
  },
  {
    code: "D3",
    weight: 30,
    skills: [
      ["D3.S1", 10],
      ["D3.S2", 10],
      ["D3.S3", 10],
    ],
  },
] as const;
const SKILLS = BLUEPRINT.flatMap((d) => d.skills.map(([code]) => code));

type RawItem = Record<string, unknown> & { id: string };
type RawFile = { skill: string } & Record<string, RawItem[]>;

/** The raw YAML, so the test does not depend on the engine's types for `level`. */
async function rawItems(kind: "questions" | "cards" | "diagrams") {
  const dir = join(PACK_DIR, kind);
  const names = (await readdir(dir)).filter((n) => n.endsWith(".yaml"));
  const out: (RawItem & { skill: string })[] = [];
  for (const name of names) {
    const file = YAML.parse(await readFile(join(dir, name), "utf8")) as RawFile;
    for (const item of file[kind] ?? [])
      out.push({ ...item, skill: file.skill });
  }
  return out;
}

const TINY = parsePack(`
slug: tiny
name: Tiny
kind: course
version: 1
domains:
  - code: D1
    name: One
    weight: 100
    skills:
      - { code: S1, name: A, weight: 100 }
`);

const tinyFiles = (level: string | null) => {
  const lv = level === null ? "" : `    level: ${level}\n`;
  const f = (name: string, text: string): ContentFile => ({ name, text });
  return {
    questions: [
      f(
        "questions/S1.yaml",
        `skill: S1
questions:
  - id: tiny.S1.q1
    origin: ai
    author: ${AUTHOR}
${lv}    stem: "Which?"
    select: 1
    options:
      - { id: A, text: "a", correct: false, rationale: "no" }
      - { id: B, text: "b", correct: true, rationale: "yes" }
    source: { title: "Doc", url: "https://example.com/doc" }
`,
      ),
    ],
    cards: [
      f(
        "cards/S1.yaml",
        `skill: S1
cards:
  - id: tiny.S1.card-1
    concept: C
    origin: ai
    author: ${AUTHOR}
${lv}    simply: "s"
    inNature: "n"
    whereItBreaks: ["b"]
    sources: [https://example.com/doc]
`,
      ),
    ],
    diagrams: [
      f(
        "diagrams/S1.yaml",
        `skill: S1
diagrams:
  - id: tiny.S1.diagram-1
    title: "t"
    origin: ai
    author: ${AUTHOR}
${lv}    direction: LR
    nodes: [{ id: A, label: "a" }, { id: B, label: "b" }]
    edges: [{ from: A, to: B }]
    sources: [https://example.com/doc]
`,
      ),
    ],
  };
};

describe("MF-0031 prod-prompting pack", () => {
  it("SC-1: pack.yaml follows the blueprint", async () => {
    const pack = await loadPackFile(join(PACK_DIR, "pack.yaml"));
    expect(pack.slug).toBe("prod-prompting");
    expect(pack.kind).toBe("course");
    expect(pack.exam).toBeUndefined();
    expect(
      pack.domains.map((d) => ({
        code: d.code,
        weight: d.weight,
        skills: d.skills.map((s) => [s.code, s.weight]),
      })),
    ).toEqual(
      BLUEPRINT.map((d) => ({ ...d, skills: d.skills.map((s) => [...s]) })),
    );
    for (const skill of pack.domains.flatMap((d) => d.skills)) {
      expect(skill.sources?.length ?? 0, skill.code).toBeGreaterThanOrEqual(1);
      for (const url of skill.sources ?? []) expect(url).toMatch(/^https:\/\//);
    }
  });

  it("SC-2: optional level on every item type; unknown values rejected; absent still loads", () => {
    for (const level of LEVELS) {
      const content = parseContent(tinyFiles(level), TINY);
      expect(content.questions).toHaveLength(1);
      expect(content.cards).toHaveLength(1);
      expect(content.diagrams).toHaveLength(1);
    }
    expect(() => parseContent(tinyFiles(null), TINY)).not.toThrow();
    expect(() => parseContent(tinyFiles("guru"), TINY)).toThrow(/level/);
  });

  it("SC-3: content loads and every citation is one of its skill's sources", async () => {
    const pack = await loadPackFile(join(PACK_DIR, "pack.yaml"));
    await expect(loadPackContent(pack, PACK_DIR)).resolves.toBeDefined();
    const sourcesOf = new Map(
      pack.domains.flatMap((d) =>
        d.skills.map((s) => [s.code, new Set(s.sources ?? [])]),
      ),
    );
    for (const q of await rawItems("questions")) {
      const url = (q.source as { url: string }).url;
      expect(sourcesOf.get(q.skill)?.has(url), `${q.id} cites ${url}`).toBe(
        true,
      );
    }
    for (const kind of ["cards", "diagrams"] as const) {
      for (const item of await rawItems(kind)) {
        for (const url of item.sources as string[])
          expect(
            sourcesOf.get(item.skill)?.has(url),
            `${item.id} cites ${url}`,
          ).toBe(true);
      }
    }
  });

  it("SC-4: per skill ≥ 6 questions (≥ 2 per level), ≥ 1 card, ≥ 1 diagram; provenance and level on every item", async () => {
    const questions = await rawItems("questions");
    const cards = await rawItems("cards");
    const diagrams = await rawItems("diagrams");
    for (const skill of SKILLS) {
      const qs = questions.filter((q) => q.skill === skill);
      expect(qs.length, skill).toBeGreaterThanOrEqual(6);
      for (const level of LEVELS)
        expect(
          qs.filter((q) => q.level === level).length,
          `${skill} ${level}`,
        ).toBeGreaterThanOrEqual(2);
      expect(
        cards.filter((c) => c.skill === skill).length,
        skill,
      ).toBeGreaterThanOrEqual(1);
      expect(
        diagrams.filter((d) => d.skill === skill).length,
        skill,
      ).toBeGreaterThanOrEqual(1);
    }
    for (const card of cards) {
      const target = diagrams.find((d) => d.id === card.diagram);
      expect(target?.skill, `${card.id} → ${String(card.diagram)}`).toBe(
        card.skill,
      );
    }
    for (const item of [...questions, ...cards, ...diagrams]) {
      expect(item.origin, item.id).toBe("ai");
      expect(item.author, item.id).toBe(AUTHOR);
      expect(LEVELS, item.id).toContain(item.level);
      expect(item.id.startsWith(`prod-prompting.${item.skill}.`), item.id).toBe(
        true,
      );
    }
  });

  it("SC-5: 4 distinct options, select 1, no answer letter keys more than 40% of questions", async () => {
    const questions = await rawItems("questions");
    expect(questions.length).toBeGreaterThanOrEqual(54);
    const keyCount = new Map<string, number>();
    for (const q of questions) {
      const options = q.options as {
        id: string;
        text: string;
        correct: boolean;
      }[];
      expect(q.select, q.id).toBe(1);
      expect(
        options.map((o) => o.id),
        q.id,
      ).toEqual(["A", "B", "C", "D"]);
      expect(
        new Set(options.map((o) => o.text.trim().toLowerCase())).size,
        q.id,
      ).toBe(4);
      const key = options.find((o) => o.correct)?.id ?? "none";
      keyCount.set(key, (keyCount.get(key) ?? 0) + 1);
    }
    for (const [letter, n] of keyCount)
      expect(n / questions.length, `key ${letter}`).toBeLessThanOrEqual(0.4);
  });

  it("SC-6: every diagram has ≥ 4 nodes and every node is on an edge", async () => {
    for (const d of await rawItems("diagrams")) {
      const nodes = d.nodes as { id: string }[];
      const edges = d.edges as { from: string; to: string }[];
      expect(nodes.length, d.id).toBeGreaterThanOrEqual(4);
      const linked = new Set(edges.flatMap((e) => [e.from, e.to]));
      for (const n of nodes)
        expect(linked.has(n.id), `${d.id} node ${n.id}`).toBe(true);
    }
  });
});
