import { describe, expect, it } from "vitest";
import YAML from "yaml";
import { contentHash } from "../hash";
import { itemHashes } from "../item-hashes";

const question = {
  id: "p.S1.q1",
  origin: "ai",
  author: "a@example.com",
  stem: "Which one?",
  select: 1,
  options: [{ id: "A", text: "a", correct: true, rationale: "r" }],
  source: { title: "Doc", url: "https://example.com" },
};
const card = { id: "p.S1.card-x", concept: "Temperature", origin: "human" };

describe("itemHashes", () => {
  it("hashes every raw item exactly as the sync script does (contentHash of the YAML item)", () => {
    const hashes = itemHashes({
      questions: [
        {
          name: "questions/S1.yaml",
          text: YAML.stringify({ skill: "S1", questions: [question] }),
        },
      ],
      cards: [
        {
          name: "cards/S1.yaml",
          text: YAML.stringify({ skill: "S1", cards: [card] }),
        },
      ],
      diagrams: [],
    });
    expect(hashes).toEqual({
      "p.S1.q1": contentHash(question),
      "p.S1.card-x": contentHash(card),
    });
  });

  it("changes when any field of the item changes, including fields the app does not show", () => {
    const hashOf = (q: object) =>
      itemHashes({
        questions: [
          { name: "q", text: YAML.stringify({ skill: "S1", questions: [q] }) },
        ],
        cards: [],
        diagrams: [],
      })["p.S1.q1"];
    expect(hashOf({ ...question, author: "b@example.com" })).not.toBe(
      hashOf(question),
    );
  });

  it("skips a file that is not a list of items", () => {
    expect(
      itemHashes({
        questions: [{ name: "q", text: "skill: S1\nquestions: nope\n" }],
        cards: [],
        diagrams: [],
      }),
    ).toEqual({});
  });
});

describe("itemHashes, MF-0016 cuckoos", () => {
  it("hashes raw cuckoo items like every other kind", () => {
    const cuckoo = { id: "p.S1.cuckoo-1", title: "A hook", flawLine: 2 };
    const hashes = itemHashes({
      questions: [],
      cards: [],
      diagrams: [],
      cuckoos: [
        {
          name: "cuckoos/S1.yaml",
          text: YAML.stringify({ skill: "S1", cuckoos: [cuckoo] }),
        },
      ],
    });
    expect(hashes).toEqual({ "p.S1.cuckoo-1": contentHash(cuckoo) });
  });
});
