import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import YAML from "yaml";
import { loadPackFile } from "../../pack/load-pack";
import { loadPackContent } from "../load-content";

// MF-0038: the "Claude Platform & Model Foundations" course pack.
// Expected values are literals from GOAL.md (Blueprint + SC-1…SC-7), never computed by the code under test.

const SLUG = "platform-foundations";
const PACK_DIR = join(process.cwd(), "packs", SLUG);
const AUTHOR = "sorin.vieriu@ddroidd.com";
const LEVELS = ["foundation", "practitioner", "expert"];

const BLUEPRINT = [
  { code: "D1", weight: 10, skills: [["D1.S1", 10]] },
  {
    code: "D2",
    weight: 22,
    skills: [
      ["D2.S1", 12],
      ["D2.S2", 10],
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
  { code: "D4", weight: 16, skills: [["D4.S1", 16]] },
  {
    code: "D5",
    weight: 22,
    skills: [
      ["D5.S1", 12],
      ["D5.S2", 10],
    ],
  },
] as const;
const SKILLS = BLUEPRINT.flatMap((d) => d.skills.map(([code]) => code));

type RawItem = Record<string, unknown> & { id: string };
type RawFile = { skill: string } & Record<string, RawItem[]>;
type Node = { id: string; label: string };
type Edge = { from: string; to: string };

/** The raw YAML, so the test reads the files as authored. */
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

describe("MF-0038 platform-foundations pack", () => {
  it("SC-1: pack.yaml follows the blueprint", async () => {
    const pack = await loadPackFile(join(PACK_DIR, "pack.yaml"));
    expect(pack.slug).toBe(SLUG);
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

  it("SC-2: content loads and every citation is one of its skill's sources", async () => {
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

  it("SC-3: per skill ≥ 6 questions (≥ 2 per level), ≥ 1 card, ≥ 1 diagram; provenance, level and id prefix on every item", async () => {
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
      expect(item.id.startsWith(`${SLUG}.${item.skill}.`), item.id).toBe(true);
    }
  });

  it("SC-4: ≥ 54 questions, options A–D, select 1, distinct texts, no answer letter keys more than 40%", async () => {
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

  it("SC-5: every diagram has ≥ 4 nodes and every node is on an edge", async () => {
    for (const d of await rawItems("diagrams")) {
      const nodes = d.nodes as Node[];
      const edges = d.edges as Edge[];
      expect(nodes.length, d.id).toBeGreaterThanOrEqual(4);
      const linked = new Set(edges.flatMap((e) => [e.from, e.to]));
      for (const n of nodes)
        expect(linked.has(n.id), `${d.id} node ${n.id}`).toBe(true);
    }
  });

  it("SC-6: a D2.S1 capstone diagram links the four decisions in order, with a loop back from context", async () => {
    const DECISIONS = [/entry point/i, /capabilit/i, /model/i, /context/i];
    const capstones = (await rawItems("diagrams")).filter((d) => {
      if (d.skill !== "D2.S1") return false;
      const nodes = d.nodes as Node[];
      return DECISIONS.every((re) => nodes.some((n) => re.test(n.label)));
    });
    expect(capstones.length).toBeGreaterThanOrEqual(1);
    const [capstone] = capstones;
    const label = new Map(
      (capstone.nodes as Node[]).map((n) => [n.id, n.label]),
    );
    const edges = capstone.edges as Edge[];
    const links = (from: RegExp, to: RegExp) =>
      edges.some(
        (e) =>
          from.test(label.get(e.from) ?? "") && to.test(label.get(e.to) ?? ""),
      );
    for (let i = 0; i < DECISIONS.length - 1; i++)
      expect(
        links(DECISIONS[i], DECISIONS[i + 1]),
        `${DECISIONS[i]} → ${DECISIONS[i + 1]}`,
      ).toBe(true);
    expect(
      DECISIONS.slice(0, 3).some((earlier) => links(/context/i, earlier)),
      "context loops back to an earlier decision",
    ).toBe(true);
  });

  it("SC-7: every skill has ≥ 1 expert question citing a platform.claude.com page", async () => {
    const questions = await rawItems("questions");
    for (const skill of SKILLS) {
      const developerAngle = questions.filter(
        (q) =>
          q.skill === skill &&
          q.level === "expert" &&
          new URL((q.source as { url: string }).url).hostname ===
            "platform.claude.com",
      );
      expect(developerAngle.length, skill).toBeGreaterThanOrEqual(1);
    }
  });
});
