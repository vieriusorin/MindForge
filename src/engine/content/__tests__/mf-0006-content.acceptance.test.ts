import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadPackFile, parsePack } from "../../pack/load-pack";
import { contentHash } from "../hash";
import { loadPackContent, parseContent } from "../load-content";
import { emptyReviewContext, isPlayable, reviewStateOf } from "../review";
import type { ContentFile, ReviewState } from "../types";

const ROOT = process.cwd();
const AUTHOR = "vlad.parvana@ddroidd.com";

const PACK = parsePack(`
slug: tiny
name: Tiny
kind: course
version: 1
domains:
  - code: D1
    name: One
    weight: 100
    skills:
      - { code: S1, name: A, weight: 60 }
      - { code: S2, name: B, weight: 40 }
`);

const QUESTIONS = `
skill: S1
questions:
  - id: tiny.S1.q1
    origin: ai
    author: ${AUTHOR}
    stem: "Which?"
    select: 1
    options:
      - { id: A, text: "a", correct: false, rationale: "no" }
      - { id: B, text: "b", correct: true, rationale: "yes" }
    source: { title: "Doc", url: "https://example.com/doc" }
`;

const CARDS = `
skill: S1
cards:
  - id: tiny.S1.card-1
    concept: Temperature
    origin: human
    author: ${AUTHOR}
    simply: "Plain words."
    inNature: "Seeds in the wind."
    whereItBreaks:
      - "Wind has a direction."
    contrast: "Top-p cuts the tail."
    whyTheName: "Boltzmann."
    diagram: tiny.S1.diagram-1
    sources:
      - https://example.com/temperature
`;

const DIAGRAMS = `
skill: S1
diagrams:
  - id: tiny.S1.diagram-1
    title: "Wind and seeds"
    origin: human
    author: ${AUTHOR}
    direction: LR
    nodes:
      - { id: L, label: "Logits" }
      - { id: T, label: "Temperature", shape: decision }
    edges:
      - { from: L, to: T }
    sources:
      - https://example.com/temperature
`;

const f = (name: string, text: string): ContentFile => ({ name, text });
const files = (over: {
  questions?: string;
  cards?: string;
  diagrams?: string;
}) => ({
  questions: [f("questions/S1.yaml", over.questions ?? QUESTIONS)],
  cards: [f("cards/S1.yaml", over.cards ?? CARDS)],
  diagrams: [f("diagrams/S1.yaml", over.diagrams ?? DIAGRAMS)],
});

describe("MF-0006 content contract", () => {
  it("SC-1: nature card schema; missing or empty whereItBreaks and non-https sources name their path", () => {
    const content = parseContent(files({}), PACK);
    expect(content.cards).toHaveLength(1);
    expect(content.cards[0]).toMatchObject({
      id: "tiny.S1.card-1",
      skill: "S1",
      concept: "Temperature",
      origin: "human",
      author: AUTHOR,
      whereItBreaks: ["Wind has a direction."],
      diagram: "tiny.S1.diagram-1",
      sources: ["https://example.com/temperature"],
    });

    const noBreaks = CARDS.replace(
      / {4}whereItBreaks:\n {6}- "Wind has a direction."\n/,
      "",
    );
    expect(() => parseContent(files({ cards: noBreaks }), PACK)).toThrow(
      /cards\/S1\.yaml: cards\.0\.whereItBreaks/,
    );

    const emptyBreak = CARDS.replace('- "Wind has a direction."', '- "   "');
    expect(() => parseContent(files({ cards: emptyBreak }), PACK)).toThrow(
      /cards\/S1\.yaml: cards\.0\.whereItBreaks\.0/,
    );

    const httpSource = CARDS.replace(
      "      - https://example.com/temperature",
      "      - http://example.com/temperature",
    );
    expect(() => parseContent(files({ cards: httpSource }), PACK)).toThrow(
      /cards\/S1\.yaml: cards\.0\.sources\.0/,
    );

    const noSources = CARDS.replace(
      "    sources:\n      - https://example.com/temperature\n",
      "",
    );
    expect(() => parseContent(files({ cards: noSources }), PACK)).toThrow(
      /cards\/S1\.yaml: cards\.0\.sources/,
    );
  });

  // Re-frozen 2026-11-04 (MF-0010, user decision, ADR 0003): diagrams are graphs, not Mermaid text.
  it("SC-2: diagram schema; an edge to an unknown node, or an unknown direction, names its path", () => {
    const content = parseContent(files({}), PACK);
    expect(content.diagrams).toHaveLength(1);
    expect(content.diagrams[0]).toMatchObject({
      id: "tiny.S1.diagram-1",
      skill: "S1",
      title: "Wind and seeds",
      origin: "human",
      direction: "LR",
      nodes: [
        { id: "L", label: "Logits" },
        { id: "T", label: "Temperature", shape: "decision" },
      ],
      edges: [{ from: "L", to: "T" }],
    });

    const dangling = DIAGRAMS.replace(
      "{ from: L, to: T }",
      "{ from: L, to: X }",
    );
    expect(() => parseContent(files({ diagrams: dangling }), PACK)).toThrow(
      /diagrams\/S1\.yaml: diagrams\.0\.edges\.0\.to: unknown node "X"/,
    );

    const sideways = DIAGRAMS.replace("direction: LR", "direction: RL");
    expect(() => parseContent(files({ diagrams: sideways }), PACK)).toThrow(
      /diagrams\/S1\.yaml: diagrams\.0\.direction/,
    );

    const twice = DIAGRAMS.replace(
      'id: T, label: "Temperature"',
      'id: L, label: "Temperature"',
    );
    expect(() => parseContent(files({ diagrams: twice }), PACK)).toThrow(
      /diagrams\/S1\.yaml: diagrams\.0\.nodes\.1\.id: duplicate node id "L"/,
    );
  });

  it("SC-3: questions carry origin + author; a file still using status fails with a clear message", () => {
    const content = parseContent(files({}), PACK);
    expect(content.questions[0]).toMatchObject({
      id: "tiny.S1.q1",
      skillCode: "S1",
      origin: "ai",
      author: AUTHOR,
    });

    const legacy = QUESTIONS.replace(
      `    origin: ai\n    author: ${AUTHOR}\n`,
      "    status: unreviewed\n",
    );
    expect(() => parseContent(files({ questions: legacy }), PACK)).toThrow(
      /questions\/S1\.yaml: questions\.0\.status: .*origin/,
    );

    const aiWithoutAuthor = QUESTIONS.replace(`    author: ${AUTHOR}\n`, "");
    expect(() =>
      parseContent(files({ questions: aiWithoutAuthor }), PACK),
    ).toThrow(/questions\/S1\.yaml: questions\.0\.author/);
  });

  it("SC-3: all 53 CCDV-F questions migrate: 3 official without author, 50 ai by the author", async () => {
    const pack = await loadPackFile(join(ROOT, "packs/ccdv-f/pack.yaml"));
    const { questions } = await loadPackContent(
      pack,
      join(ROOT, "packs/ccdv-f"),
    );
    expect(questions).toHaveLength(53);
    const official = questions.filter((q) => q.origin === "official");
    expect(official.map((q) => q.id).sort()).toEqual([
      "ccdv-f.D2.S3.official-1",
      "ccdv-f.D7.S1.official-1",
      "ccdv-f.D8.S3.official-1",
    ]);
    expect(official.every((q) => q.author === undefined)).toBe(true);
    const rest = questions.filter((q) => q.origin !== "official");
    expect(rest).toHaveLength(50);
    expect(rest.every((q) => q.origin === "ai" && q.author === AUTHOR)).toBe(
      true,
    );
  });

  it("SC-4: duplicate id across types, unknown skill, card → missing diagram each name their path", () => {
    const dupId = CARDS.replace("id: tiny.S1.card-1", "id: tiny.S1.q1");
    expect(() => parseContent(files({ cards: dupId }), PACK)).toThrow(
      /cards\/S1\.yaml: cards\.0\.id: .*tiny\.S1\.q1/,
    );

    const unknownSkill = DIAGRAMS.replace("skill: S1", "skill: S9");
    expect(() =>
      parseContent(
        files({
          diagrams: unknownSkill,
          cards: CARDS.replace(/ {4}diagram: .*\n/, ""),
        }),
        PACK,
      ),
    ).toThrow(/diagrams\/S1\.yaml: skill: .*S9/);

    const missingDiagram = CARDS.replace(
      "diagram: tiny.S1.diagram-1",
      "diagram: tiny.S1.diagram-404",
    );
    expect(() => parseContent(files({ cards: missingDiagram }), PACK)).toThrow(
      /cards\/S1\.yaml: cards\.0\.diagram: .*tiny\.S1\.diagram-404/,
    );
  });

  it("SC-5: contentHash is stable across key order and changes when any field changes", () => {
    const a = { id: "x", nested: { b: 2, a: 1 }, list: [1, 2] };
    const b = { list: [1, 2], nested: { a: 1, b: 2 }, id: "x" };
    expect(contentHash(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(contentHash(a)).toBe(contentHash(b));
    expect(contentHash({ ...a, id: "y" })).not.toBe(contentHash(a));
    expect(contentHash({ ...a, nested: { a: 1, b: 3 } })).not.toBe(
      contentHash(a),
    );
    expect(contentHash({ ...a, list: [2, 1] })).not.toBe(contentHash(a));
    expect(contentHash({ ...a, extra: undefined, more: "z" })).not.toBe(
      contentHash(a),
    );
  });

  it("SC-6: CCDV-F ships the Temperature card → its D5.S1 diagram, and the D1.S3 bee loop; the sample pack still loads", async () => {
    const pack = await loadPackFile(join(ROOT, "packs/ccdv-f/pack.yaml"));
    const { cards, diagrams } = await loadPackContent(
      pack,
      join(ROOT, "packs/ccdv-f"),
    );

    const temperature = cards.find(
      (c) => c.skill === "D5.S1" && /temperature/i.test(c.concept),
    );
    expect(temperature).toBeDefined();
    expect(temperature?.whereItBreaks.length).toBeGreaterThanOrEqual(1);
    expect(temperature?.sources.length).toBeGreaterThanOrEqual(1);

    const linked = diagrams.find((d) => d.id === temperature?.diagram);
    expect(linked?.skill).toBe("D5.S1");

    const bee = diagrams.find(
      (d) => d.skill === "D1.S3" && /bee/i.test(d.title),
    );
    expect(bee).toBeDefined();

    const sample = await loadPackFile(
      join(ROOT, "packs/team-onboarding-sample/pack.yaml"),
    );
    const sampleContent = await loadPackContent(
      sample,
      join(ROOT, "packs/team-onboarding-sample"),
    );
    expect(sampleContent).toEqual({ questions: [], cards: [], diagrams: [] });
  });

  it("SC-8: review seam — isPlayable never serves flagged/rejected; an empty context serves all 53", async () => {
    const states: ReviewState[] = [
      "unreviewed",
      "approved",
      "flagged",
      "rejected",
    ];
    const table = states.flatMap((s) =>
      (["practice", "storm"] as const).map((m) => [s, m, isPlayable(s, m)]),
    );
    expect(table).toEqual([
      ["unreviewed", "practice", true],
      ["unreviewed", "storm", true],
      ["approved", "practice", true],
      ["approved", "storm", true],
      ["flagged", "practice", false],
      ["flagged", "storm", false],
      ["rejected", "practice", false],
      ["rejected", "storm", false],
    ]);

    const ctx = emptyReviewContext();
    expect(ctx.states.size).toBe(0);
    expect(ctx.rejected.size).toBe(0);
    expect(ctx.spoiledBy.size).toBe(0);
    expect(reviewStateOf(ctx, { id: "a", origin: "official" })).toBe(
      "approved",
    );
    expect(reviewStateOf(ctx, { id: "b", origin: "ai" })).toBe("unreviewed");

    const pack = await loadPackFile(join(ROOT, "packs/ccdv-f/pack.yaml"));
    const { questions } = await loadPackContent(
      pack,
      join(ROOT, "packs/ccdv-f"),
    );
    const served = questions.filter((q) =>
      isPlayable(reviewStateOf(ctx, q), "practice"),
    );
    expect(served).toHaveLength(53);
  });
});
