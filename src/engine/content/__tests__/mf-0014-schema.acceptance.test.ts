/**
 * MF-0014 acceptance (frozen): optional `generatedBy: { model, prompt }` on `ai` nature cards and
 * diagrams only (SC-2, the MF-0008 C-3 rule for questions). The real pack is read at runtime.
 */
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import YAML from "yaml";
import { loadPackFile } from "../../pack";
import { loadPackContent, parseContent } from "..";

const ROOT = process.cwd();
const PACK_DIR = join(ROOT, "packs/ccdv-f");
const GENERATED_BY = { model: "claude-sonnet-5-5", prompt: "nature-card@1" };

const card = (over: Record<string, unknown> = {}) => ({
  id: "ccdv-f.D2.S1.card-ai-1",
  concept: "Prompt caching",
  origin: "ai",
  author: "runner@example.com",
  simply: "Reuse a processed prefix.",
  inNature: "A squirrel caching nuts.",
  whereItBreaks: ["A cache entry expires after its TTL."],
  sources: [
    "https://platform.claude.com/docs/en/build-with-claude/prompt-caching",
  ],
  ...over,
});

const diagram = (over: Record<string, unknown> = {}) => ({
  id: "ccdv-f.D2.S1.diagram-ai-1",
  title: "Cache hit or write",
  origin: "ai",
  author: "runner@example.com",
  direction: "LR",
  nodes: [
    { id: "P", label: "Prefix" },
    { id: "R", label: "Read from cache" },
  ],
  edges: [{ from: "P", to: "R" }],
  sources: [
    "https://platform.claude.com/docs/en/build-with-claude/prompt-caching",
  ],
  ...over,
});

const files = ({
  cards = [],
  diagrams = [],
}: {
  cards?: Record<string, unknown>[];
  diagrams?: Record<string, unknown>[];
}) => ({
  questions: [],
  cards: cards.length
    ? [
        {
          name: "cards/D2.S1.t.yaml",
          text: YAML.stringify({ skill: "D2.S1", cards }),
        },
      ]
    : [],
  diagrams: diagrams.length
    ? [
        {
          name: "diagrams/D2.S1.t.yaml",
          text: YAML.stringify({ skill: "D2.S1", diagrams }),
        },
      ]
    : [],
});

describe("MF-0014 generatedBy on cards and diagrams", () => {
  it("SC-2: accepted on ai items, rejected on human/official items, strict inside, existing files still load", async () => {
    const pack = await loadPackFile(join(PACK_DIR, "pack.yaml"));

    const ok = parseContent(
      files({
        cards: [card({ generatedBy: GENERATED_BY })],
        diagrams: [diagram({ generatedBy: GENERATED_BY })],
      }),
      pack,
    );
    expect(ok.cards[0]).toMatchObject({ generatedBy: GENERATED_BY });
    expect(ok.diagrams[0]).toMatchObject({ generatedBy: GENERATED_BY });

    const without = parseContent(
      files({ cards: [card()], diagrams: [diagram()] }),
      pack,
    );
    expect(without.cards).toHaveLength(1);
    expect(without.diagrams).toHaveLength(1);

    for (const bad of [
      files({ cards: [card({ origin: "human", generatedBy: GENERATED_BY })] }),
      files({
        cards: [
          card({
            origin: "official",
            author: undefined,
            generatedBy: GENERATED_BY,
          }),
        ],
      }),
      files({
        diagrams: [diagram({ origin: "human", generatedBy: GENERATED_BY })],
      }),
      files({
        cards: [card({ generatedBy: { ...GENERATED_BY, temperature: 1 } })],
      }),
      files({ cards: [card({ generatedBy: { model: "", prompt: "x@1" } })] }),
      files({ diagrams: [diagram({ generatedBy: { model: "m" } })] }),
      files({ cards: [card({ generator: "claude" })] }),
    ])
      expect(() => parseContent(bad, pack)).toThrow(/generatedBy|generator/);

    const content = await loadPackContent(pack, PACK_DIR);
    expect(content.cards.length).toBeGreaterThanOrEqual(1);
    expect(content.diagrams.length).toBeGreaterThanOrEqual(2);
  });
});
