import { describe, expect, it } from "vitest";
import {
  findPackItem,
  itemSkillCode,
  itemTitle,
  itemTitles,
} from "../find-item";
import type { PackContent } from "../types";

const content: PackContent = {
  questions: [
    {
      id: "p.S1.q1",
      skillCode: "S1",
      origin: "ai",
      stem: "Which one?",
      select: 1,
      options: [{ id: "A", text: "a", correct: true, rationale: "r" }],
      source: { title: "Doc", url: "https://example.com" },
    },
  ],
  cards: [
    {
      id: "p.S1.card-x",
      skill: "S1",
      concept: "Temperature",
      origin: "human",
      simply: "s",
      inNature: "n",
      whereItBreaks: ["b"],
      sources: ["https://example.com"],
    },
  ],
  diagrams: [
    {
      id: "p.S1.diagram-x",
      skill: "S1",
      title: "Bees",
      origin: "human",
      direction: "LR",
      nodes: [
        { id: "A", label: "a" },
        { id: "B", label: "b" },
      ],
      edges: [{ from: "A", to: "B" }],
      sources: ["https://example.com"],
    },
  ],
};

describe("findPackItem", () => {
  it("finds an item of the given type by id", () => {
    expect(findPackItem(content, "question", "p.S1.q1")?.kind).toBe("question");
    expect(findPackItem(content, "card", "p.S1.card-x")?.kind).toBe("card");
    expect(findPackItem(content, "diagram", "p.S1.diagram-x")?.kind).toBe(
      "diagram",
    );
  });

  it("returns null for an id the files no longer hold, or under the wrong type", () => {
    expect(findPackItem(content, "question", "p.S1.gone")).toBeNull();
    expect(findPackItem(content, "card", "p.S1.q1")).toBeNull();
  });
});

describe("itemTitle", () => {
  it("names a question by its stem, a card by its concept, a diagram by its title", () => {
    const title = (type: "question" | "card" | "diagram", id: string) => {
      const item = findPackItem(content, type, id);
      return item ? itemTitle(item) : null;
    };
    expect(title("question", "p.S1.q1")).toBe("Which one?");
    expect(title("card", "p.S1.card-x")).toBe("Temperature");
    expect(title("diagram", "p.S1.diagram-x")).toBe("Bees");
  });
});

describe("itemTitles", () => {
  it("maps every item id of every kind to its title", () => {
    expect(itemTitles(content)).toEqual({
      "p.S1.q1": "Which one?",
      "p.S1.card-x": "Temperature",
      "p.S1.diagram-x": "Bees",
    });
  });
});

describe("itemSkillCode", () => {
  it("reads the skill of every kind of item", () => {
    for (const [type, id] of [
      ["question", "p.S1.q1"],
      ["card", "p.S1.card-x"],
      ["diagram", "p.S1.diagram-x"],
    ] as const) {
      const item = findPackItem(content, type, id);
      expect(item && itemSkillCode(item)).toBe("S1");
    }
  });
});
