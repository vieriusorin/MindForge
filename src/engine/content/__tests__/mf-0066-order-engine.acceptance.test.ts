/**
 * MF-0066 acceptance (frozen): SC-3 the pre-answer view of an order, SC-4 the grading decision, and the
 * engine half of SC-9 (an order is a findable, titled, hashed item). Expected values are literals from
 * GOAL.md, not outputs of the code.
 */
import { describe, expect, it } from "vitest";
import YAML from "yaml";
import {
  type CheckOrderAnswerInput,
  checkOrderAnswer,
  contentHash,
  findPackItem,
  isOrderServable,
  itemHashes,
  itemTitles,
  type OrderItem,
  orderSeed,
  type PackContent,
  type ReviewState,
  toPlayableOrder,
} from "..";

const order: OrderItem = {
  id: "mf66.D.S1.order-turn",
  skill: "D.S1",
  title: "Put one turn in order",
  origin: "ai",
  author: "runner@example.com",
  generatedBy: { model: "claude-opus-5-5", prompt: "mf0066-hand-session" },
  level: "practitioner",
  diagram: "mf66.D.S1.diagram-loop",
  steps: [
    { node: "REQ", label: "Send the request" },
    { node: "STOP", label: "Is it tool_use?" },
    { node: "RUN", label: "Run the tool" },
    { node: "RES", label: "Send the result" },
  ],
  orderedBy: ["First send the request, then run the tool."],
  explanation: "The request comes first; the result goes back last.",
  source: { title: "Page A", url: "https://example.com/a" },
};

describe("MF-0066 SC-3: no key before answering", () => {
  const KEY = ["REQ", "STOP", "RUN", "RES"];
  const ids = (seed: number, item: OrderItem = order) =>
    toPlayableOrder(item, "h", seed).steps.map((s) => s.id);

  it("SC-3: only id, skillCode, origin, title, steps {id,label} and contentHash; every step once", () => {
    const playable = toPlayableOrder(order, "hash-1", 7);
    expect(Object.keys(playable).sort()).toEqual([
      "contentHash",
      "id",
      "origin",
      "skillCode",
      "steps",
      "title",
    ]);
    expect(playable).toMatchObject({
      id: "mf66.D.S1.order-turn",
      skillCode: "D.S1",
      origin: "ai",
      title: "Put one turn in order",
      contentHash: "hash-1",
    });
    expect(
      [...playable.steps].sort((a, b) => a.id.localeCompare(b.id)),
    ).toEqual([
      { id: "REQ", label: "Send the request" },
      { id: "RES", label: "Send the result" },
      { id: "RUN", label: "Run the tool" },
      { id: "STOP", label: "Is it tool_use?" },
    ]);
  });

  it("SC-3: for 500 seeds the shown order is never the key, and the same seed gives the same order", () => {
    for (let seed = 0; seed < 500; seed++) {
      expect(ids(seed)).not.toEqual(KEY);
      expect(ids(seed)).toEqual(ids(seed));
    }
  });

  it("SC-3: the shown order is a seeded permutation, not one fixed layout or a rotation of the key", () => {
    const seen = new Set(
      Array.from({ length: 500 }, (_, seed) => ids(seed).join(",")),
    );
    // 4 steps have 23 non-key permutations; a fixed layout would give 1, a rotation 3.
    expect(seen.size).toBeGreaterThanOrEqual(15);
    const sorted: OrderItem = {
      ...order,
      steps: [
        { node: "P", label: "A first" },
        { node: "Q", label: "B second" },
        { node: "R", label: "C third" },
      ],
    };
    const three = new Set(
      Array.from({ length: 500 }, (_, seed) => ids(seed, sorted).join(",")),
    );
    expect(three.has("P,Q,R")).toBe(false);
    // All 5 non-key permutations of 3 steps appear.
    expect(three.size).toBe(5);
  });

  it("SC-3: orderSeed is stable per learner and item, and differs across learners and items", () => {
    expect(orderSeed("u1", "a.b.c")).toBe(orderSeed("u1", "a.b.c"));
    expect(orderSeed("u1", "a.b.c")).not.toBe(orderSeed("u2", "a.b.c"));
    expect(orderSeed("u1", "a.b.c")).not.toBe(orderSeed("u1", "a.b.d"));
    expect(Number.isInteger(orderSeed("u1", "a.b.c"))).toBe(true);
  });
});

const input = (
  over: Partial<CheckOrderAnswerInput> = {},
): CheckOrderAnswerInput => ({
  order,
  reviewState: "unreviewed",
  diagramState: "approved",
  fileHash: "hash-1",
  sentHash: "hash-1",
  chosen: ["REQ", "STOP", "RUN", "RES"],
  ...over,
});

describe("MF-0066 SC-4: grading decision", () => {
  it.each<[string, Partial<CheckOrderAnswerInput>, string]>([
    ["no order with that id", { order: null }, "not-in-pack"],
    ["the order is flagged", { reviewState: "flagged" }, "withdrawn"],
    ["the order is rejected", { reviewState: "rejected" }, "withdrawn"],
    ["the diagram is unreviewed", { diagramState: "unreviewed" }, "withdrawn"],
    ["the diagram is flagged", { diagramState: "flagged" }, "withdrawn"],
    ["the diagram is rejected", { diagramState: "rejected" }, "withdrawn"],
    ["the file moved on", { fileHash: "hash-2" }, "changed"],
    ["the file has no hash", { fileHash: undefined }, "changed"],
    ["a step is missing", { chosen: ["REQ", "STOP", "RUN"] }, "invalid-order"],
    [
      "a step is extra",
      { chosen: ["REQ", "STOP", "RUN", "RES", "DONE"] },
      "invalid-order",
    ],
    [
      "a step is repeated",
      { chosen: ["REQ", "STOP", "RUN", "RUN"] },
      "invalid-order",
    ],
    [
      "an unknown step id",
      { chosen: ["REQ", "STOP", "RUN", "XYZ"] },
      "invalid-order",
    ],
  ])("SC-4: %s -> %s", (_name, over, error) => {
    expect(checkOrderAnswer(input(over))).toEqual({ ok: false, error });
  });

  it.each<[string, Partial<CheckOrderAnswerInput>]>([
    ["the key order, unreviewed order", {}],
    ["the key order, approved order", { reviewState: "approved" }],
    // Grading the sequence is the database's job; a wrong permutation is still graded.
    ["a wrong permutation", { chosen: ["RES", "RUN", "STOP", "REQ"] }],
  ])("SC-4: %s -> ok", (_name, over) => {
    expect(checkOrderAnswer(input(over))).toEqual({ ok: true });
  });
});

describe("MF-0066 SC-5 (engine): served only with an approved diagram", () => {
  const states: ReviewState[] = [
    "unreviewed",
    "approved",
    "flagged",
    "rejected",
  ];
  it("SC-5: isOrderServable over every (order, diagram) state pair", () => {
    const servable = states.flatMap((orderState) =>
      states
        .filter((diagramState) => isOrderServable({ orderState, diagramState }))
        .map((diagramState) => `${orderState}/${diagramState}`),
    );
    expect(servable).toEqual(["unreviewed/approved", "approved/approved"]);
  });
});

describe("MF-0066 SC-9 (engine): an order is a reviewable item", () => {
  const content: PackContent = {
    questions: [],
    cards: [],
    diagrams: [],
    orders: [order],
  };

  it("SC-9: findPackItem finds it by type 'order'; not under another type", () => {
    expect(findPackItem(content, "order", order.id)).toEqual({
      kind: "order",
      item: order,
    });
    expect(findPackItem(content, "order", "mf66.D.S1.order-gone")).toBeNull();
    expect(findPackItem(content, "diagram", order.id)).toBeNull();
  });

  it("SC-9: itemTitles names it by its title", () => {
    expect(itemTitles(content)).toEqual({
      "mf66.D.S1.order-turn": "Put one turn in order",
    });
  });

  it("SC-9: itemHashes hashes the raw YAML item, as the sync does", () => {
    const { skill: _skill, ...rawItem } = order;
    const hashes = itemHashes({
      questions: [],
      cards: [],
      diagrams: [],
      orders: [
        {
          name: "orders/D.S1.yaml",
          text: YAML.stringify({ skill: "D.S1", orders: [rawItem] }),
        },
      ],
    });
    expect(hashes).toEqual({ "mf66.D.S1.order-turn": contentHash(rawItem) });
  });
});
