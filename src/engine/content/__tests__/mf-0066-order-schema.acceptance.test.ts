/**
 * MF-0066 acceptance (frozen): SC-1, the order item schema and its second-stage loader. Fixtures are
 * inline (a two-skill pack, one diagram per skill), so the file does not depend on shipped content.
 * Expected values come from GOAL.md SC-1, not from the loader.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import YAML from "yaml";
import { parsePack } from "../../pack";
import {
  ContentValidationError,
  type LoadedPackContent,
  loadPackOrders,
  type OrderItem,
  parseContent,
  parseOrders,
} from "..";

const A = "https://example.com/a";
const B = "https://example.com/b";
const C = "https://example.com/c";

const pack = parsePack(
  YAML.stringify({
    slug: "mf66",
    name: "MF-0066 fixture",
    kind: "course",
    version: 1,
    domains: [
      {
        code: "D",
        name: "Domain",
        weight: 100,
        skills: [
          { code: "D.S1", name: "One", weight: 60, sources: [A, B] },
          { code: "D.S2", name: "Two", weight: 40, sources: [A, C] },
        ],
      },
    ],
  }),
);

const DIAGRAM = "mf66.D.S1.diagram-loop";
const OTHER_DIAGRAM = "mf66.D.S2.diagram-other";

const content: LoadedPackContent = parseContent(
  {
    questions: [],
    cards: [],
    cuckoos: [],
    diagrams: [
      {
        name: "diagrams/D.S1.yaml",
        text: YAML.stringify({
          skill: "D.S1",
          diagrams: [
            {
              id: DIAGRAM,
              title: "The loop",
              origin: "human",
              author: "a@example.com",
              direction: "TB",
              nodes: [
                { id: "REQ", label: "Send the request" },
                { id: "STOP", label: "Is it tool_use?", shape: "decision" },
                { id: "RUN", label: "Run the tool" },
                { id: "RES", label: "Send the result" },
                { id: "DONE", label: "Final answer" },
                { id: "LONGNODE9", label: "A node with a long id" },
              ],
              edges: [
                { from: "REQ", to: "STOP" },
                { from: "STOP", to: "RUN", label: "yes" },
                { from: "STOP", to: "DONE", label: "no" },
                { from: "RUN", to: "RES" },
                { from: "RES", to: "REQ" },
                { from: "RES", to: "LONGNODE9" },
              ],
              sources: [A, B],
            },
          ],
        }),
      },
      {
        name: "diagrams/D.S2.yaml",
        text: YAML.stringify({
          skill: "D.S2",
          diagrams: [
            {
              id: OTHER_DIAGRAM,
              title: "Other",
              origin: "human",
              author: "a@example.com",
              direction: "LR",
              nodes: [
                { id: "X", label: "x" },
                { id: "Y", label: "y" },
                { id: "Z", label: "z" },
              ],
              edges: [
                { from: "X", to: "Y" },
                { from: "Y", to: "Z" },
              ],
              sources: [A],
            },
          ],
        }),
      },
    ],
  },
  pack,
);

const ID = "mf66.D.S1.order-turn";

const STEPS = [
  { node: "REQ", label: "Send the request" },
  { node: "STOP", label: "Is it tool_use?" },
  { node: "RUN", label: "Run the tool" },
  { node: "RES", label: "Send the result" },
];

const raw = (over: Record<string, unknown> = {}) => ({
  id: ID,
  title: "Put one turn in order",
  origin: "ai",
  author: "runner@example.com",
  generatedBy: { model: "claude-opus-5-5", prompt: "mf0066-hand-session" },
  level: "practitioner",
  diagram: DIAGRAM,
  steps: STEPS,
  orderedBy: ["First send the request, then run the tool."],
  explanation: "The request comes first; the result goes back last.",
  source: { title: "Page A", url: A },
  ...over,
});

const file = (orders: unknown[], skill = "D.S1") => [
  { name: `orders/${skill}.yaml`, text: YAML.stringify({ skill, orders }) },
];

/** The issues of the ContentValidationError `fn` throws; fails the test if it doesn't throw one. */
function issuesOf(fn: () => unknown): readonly string[] {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(ContentValidationError);
    return (error as ContentValidationError).issues;
  }
  throw new Error("expected a ContentValidationError, nothing was thrown");
}

describe("MF-0066 SC-1: order schema", () => {
  it("SC-1: a valid order file loads, tagged with its skill, steps in file order", () => {
    const orders = parseOrders(file([raw()]), pack, content);
    const expected: OrderItem = { ...raw(), skill: "D.S1" } as OrderItem;
    expect(orders).toEqual([expected]);
  });

  it.each([
    ["an unknown diagram id", { diagram: "mf66.D.S1.diagram-gone" }, "diagram"],
    ["a diagram of another skill", { diagram: OTHER_DIAGRAM }, "diagram"],
    [
      "a step node not in the diagram",
      {
        steps: [
          ...STEPS.slice(0, 3),
          { node: "GONE", label: "Send the result" },
        ],
      },
      "steps.3.node",
    ],
    [
      "a label that is not the node's label",
      {
        steps: [STEPS[0], STEPS[1], { node: "RUN", label: "Run it" }, STEPS[3]],
      },
      "steps.2.label",
    ],
    [
      "a consecutive pair with no edge from the first to the second",
      { steps: [STEPS[0], STEPS[2], STEPS[3]] },
      "steps.1",
    ],
    [
      "a pair joined only by an edge in the other direction",
      { steps: [STEPS[3], STEPS[2], STEPS[1]] },
      "steps.1",
    ],
    ["a repeated node", { steps: [...STEPS, STEPS[0], STEPS[1]] }, "steps.4"],
    ["fewer than 3 steps", { steps: STEPS.slice(0, 2) }, "steps"],
    [
      "a node id longer than 8 characters",
      {
        steps: [
          STEPS[2],
          STEPS[3],
          { node: "LONGNODE9", label: "A node with a long id" },
        ],
      },
      "steps.2.node",
    ],
    [
      "a source not among the skill's sources",
      { source: { title: "Page C", url: C } },
      "source.url",
    ],
    [
      "a non-https source",
      { source: { title: "Page A", url: "http://example.com/a" } },
      "source.url",
    ],
    ["an empty orderedBy", { orderedBy: [] }, "orderedBy"],
    ["a foreign id prefix", { id: "other.D.S1.order-turn" }, "id"],
  ])("SC-1: rejects %s", (_name, over, path) => {
    const issues = issuesOf(() =>
      parseOrders(file([raw(over)]), pack, content),
    );
    expect(issues.length).toBeGreaterThan(0);
    expect(
      issues.some((i) => i.startsWith(`orders/D.S1.yaml: orders.0.${path}`)),
      issues.join("\n"),
    ).toBe(true);
  });

  it("SC-1: rejects more than 8 steps", () => {
    // A 9-node chain in its own diagram, so only the step count is wrong.
    const nodes = Array.from({ length: 9 }, (_, i) => ({
      id: `N${i}`,
      label: `Step ${i}`,
    }));
    const long = parseContent(
      {
        questions: [],
        cards: [],
        cuckoos: [],
        diagrams: [
          {
            name: "diagrams/D.S1.yaml",
            text: YAML.stringify({
              skill: "D.S1",
              diagrams: [
                {
                  id: "mf66.D.S1.diagram-chain",
                  title: "Chain",
                  origin: "human",
                  author: "a@example.com",
                  direction: "LR",
                  nodes,
                  edges: nodes
                    .slice(1)
                    .map((n, i) => ({ from: `N${i}`, to: n.id })),
                  sources: [A],
                },
              ],
            }),
          },
        ],
      },
      pack,
    );
    const steps = nodes.map((n) => ({ node: n.id, label: n.label }));
    const issues = issuesOf(() =>
      parseOrders(
        file([raw({ diagram: "mf66.D.S1.diagram-chain", steps })]),
        pack,
        long,
      ),
    );
    expect(
      issues.some((i) => i.startsWith("orders/D.S1.yaml: orders.0.steps")),
    ).toBe(true);
    // 8 of the same chain is fine.
    expect(
      parseOrders(
        file([
          raw({ diagram: "mf66.D.S1.diagram-chain", steps: steps.slice(0, 8) }),
        ]),
        pack,
        long,
      ),
    ).toHaveLength(1);
  });

  it("SC-1: rejects a source the diagram does not cite, even when the skill lists it", () => {
    // Skill D.S2 lists C; its diagram cites only A.
    const issues = issuesOf(() =>
      parseOrders(
        file(
          [
            raw({
              id: "mf66.D.S2.order-xyz",
              diagram: OTHER_DIAGRAM,
              steps: [
                { node: "X", label: "x" },
                { node: "Y", label: "y" },
                { node: "Z", label: "z" },
              ],
              source: { title: "Page C", url: C },
            }),
          ],
          "D.S2",
        ),
        pack,
        content,
      ),
    );
    expect(
      issues.some((i) => i.startsWith("orders/D.S2.yaml: orders.0.source.url")),
    ).toBe(true);
  });

  it("SC-1: rejects an id used by any other item of the pack, and by another order", () => {
    const diagramClash = issuesOf(() =>
      parseOrders(file([raw({ id: DIAGRAM })]), pack, content),
    );
    expect(
      diagramClash.some((i) => i.includes(`duplicate item id "${DIAGRAM}"`)),
    ).toBe(true);

    const orderClash = issuesOf(() =>
      parseOrders(file([raw(), raw()]), pack, content),
    );
    expect(
      orderClash.some((i) => i.startsWith("orders/D.S1.yaml: orders.1.id")),
    ).toBe(true);
  });

  it("SC-1: an unknown skill or a stray key is refused", () => {
    expect(
      issuesOf(() => parseOrders(file([raw()], "D.S9"), pack, content)).some(
        (i) => i.includes('unknown skill "D.S9"'),
      ),
    ).toBe(true);
    expect(
      issuesOf(() => parseOrders(file([raw({ key: ["REQ"] })]), pack, content))
        .length,
    ).toBeGreaterThan(0);
  });

  it("SC-1: loadPackOrders reads <packDir>/orders/*.yaml; a missing folder means none", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mf0066-orders-"));
    try {
      expect(await loadPackOrders(pack, dir, content)).toEqual([]);
      mkdirSync(join(dir, "orders"));
      writeFileSync(
        join(dir, "orders", "D.S1.yaml"),
        YAML.stringify({ skill: "D.S1", orders: [raw()] }),
      );
      const orders = await loadPackOrders(pack, dir, content);
      expect(orders.map((o) => [o.id, o.skill])).toEqual([[ID, "D.S1"]]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
